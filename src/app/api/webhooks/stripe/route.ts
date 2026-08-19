import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { isValidUuid } from '@/lib/validations';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing webhook signature or configuration' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── 1. Stateful Webhook Idempotency Claim ──
  // The event is claimed in 'processing' state. It is ONLY marked 'completed' after the business operation succeeds.
  try {
    const { data: claimStatus, error: claimErr } = await supabase.rpc('claim_stripe_event', {
      p_event_id: event.id,
      p_event_type: event.type,
    });

    if (claimErr) {
      // Fallback to direct table stateful check if RPC is not yet provisioned
      const { data: existingEvent, error: selectErr } = await supabase
        .from('stripe_events')
        .select('id, status, created_at')
        .eq('id', event.id)
        .single();

      if (!selectErr && existingEvent) {
        if (existingEvent.status === 'completed') {
          return NextResponse.json({ received: true, duplicate: true });
        }
        const isRecent = existingEvent.created_at && (Date.now() - new Date(existingEvent.created_at).getTime()) < 300000;
        if (existingEvent.status === 'processing' && isRecent) {
          return NextResponse.json({ received: true, in_flight: true });
        }
        // Stale or failed attempt: re-claim for retry
        const { error: reclaimErr } = await supabase
          .from('stripe_events')
          .update({ status: 'processing', created_at: new Date().toISOString() })
          .eq('id', event.id);

        if (reclaimErr) {
          return NextResponse.json({ error: 'Database idempotency claim failed' }, { status: 500 });
        }
      } else {
        const { error: insertErr } = await supabase.from('stripe_events').insert({
          id: event.id,
          event_type: event.type,
          status: 'processing',
        });

        if (insertErr) {
          if (insertErr.code === '23505') {
            const { data: dupRecord } = await supabase.from('stripe_events').select('status').eq('id', event.id).single();
            if (dupRecord?.status === 'completed') {
              return NextResponse.json({ received: true, duplicate: true });
            }
          }
          return NextResponse.json({ error: 'Database idempotency claim failed' }, { status: 500 });
        }
      }
    } else {
      if (claimStatus === 'DUPLICATE_COMPLETED') {
        return NextResponse.json({ received: true, duplicate: true });
      }
      if (claimStatus === 'IN_FLIGHT') {
        return NextResponse.json({ received: true, in_flight: true });
      }
    }
  } catch {
    return NextResponse.json({ error: 'Database idempotency claim exception' }, { status: 500 });
  }

  // ── 2. Execute Financial & Business Operations (Fail-Closed) ──
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        // A. Handle One-off Independent Donation
        if (metadata.type === 'independent_donation') {
          const charityId = metadata.charity_id;
          const donationAmount = Number(metadata.amount) || 0;
          const userId = metadata.user_id && metadata.user_id !== 'null' ? metadata.user_id : null;
          const paymentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.id;

          if (!charityId || donationAmount <= 0) {
            throw new Error(`Invalid independent donation metadata: charity_id=${charityId}, amount=${donationAmount}`);
          }

          // Strictly require atomic DB RPC
          const { error: rpcErr } = await supabase.rpc('record_completed_donation', {
            p_user_id: userId,
            p_charity_id: charityId,
            p_amount: donationAmount,
            p_stripe_payment_id: paymentId,
          });

          if (rpcErr) {
            throw new Error(`Atomic donation recording failed: ${rpcErr.message}`);
          }
          break;
        }

        // B. Handle Subscription Checkout
        const userId = metadata.user_id;
        const plan = (metadata.plan === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly';
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
        const customerId = typeof session.customer === 'string' ? session.customer : null;

        if (!userId || !customerId || !isValidUuid(userId)) {
          throw new Error(`Invalid user/customer payload in checkout session: userId=${userId}, customerId=${customerId}`);
        }

        // Authoritative user cross-validation
        const { data: userRecord, error: userFetchErr } = await supabase
          .from('users')
          .select('id, stripe_customer_id')
          .eq('id', userId)
          .single();

        if (userFetchErr || !userRecord) {
          throw new Error(`User ${userId} not found: ${userFetchErr?.message || 'record missing'}`);
        }

        if (userRecord.stripe_customer_id && userRecord.stripe_customer_id !== customerId) {
          throw new Error('Stripe customer ID binding mismatch');
        }

        let endDate: string | null = null;
        let startDate: string = new Date().toISOString();

        if (subscriptionId) {
          try {
            const subObj = await stripe.subscriptions.retrieve(subscriptionId);
            if ((subObj as any).current_period_end) {
              endDate = new Date((subObj as any).current_period_end * 1000).toISOString();
            }
            if ((subObj as any).current_period_start) {
              startDate = new Date((subObj as any).current_period_start * 1000).toISOString();
            }
          } catch {
            // Subscription retrieve fallback to default period
          }
        }

        if (!endDate) {
          const defaultDays = plan === 'yearly' ? 365 : 30;
          const d = new Date();
          d.setDate(d.getDate() + defaultDays);
          endDate = d.toISOString();
        }

        const { error: userUpdateErr } = await supabase.from('users').update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
          subscription_plan: plan,
          subscription_start_date: startDate,
          subscription_end_date: endDate,
          checkout_lock_until: null, // Clear checkout lock on successful activation
        }).eq('id', userId);

        if (userUpdateErr) {
          throw new Error(`Failed to activate subscription in database: ${userUpdateErr.message}`);
        }

        const { data: user } = await supabase.from('users').select('email, full_name').eq('id', userId).single();
        if (user?.email) {
          sendEmail({
            to: user.email,
            subject: 'Welcome to GolfCharity — Subscription Confirmed!',
            html: `<h1>Thank you for joining GolfCharity, ${user.full_name || 'Member'}!</h1><p>Your ${plan} membership is now active. Enter your scores and support causes making real impact.</p>`,
          }).catch(() => {});
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
        if (!customerId) throw new Error('Missing customer ID on subscription.updated event');

        // Authoritative user verification by customer ID
        const { data: targetUser, error: userLookupErr } = await supabase
          .from('users')
          .select('id, stripe_customer_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (userLookupErr || !targetUser) {
          throw new Error(`No user found for customer ${customerId}: ${userLookupErr?.message || 'not found'}`);
        }

        const stripeStatus = subscription.status;
        const status = (stripeStatus === 'active' || stripeStatus === 'trialing') ? 'active' :
                       stripeStatus === 'canceled' ? 'cancelled' : 'lapsed';

        const endDate = (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null;
        const startDate = (subscription as any).current_period_start
          ? new Date((subscription as any).current_period_start * 1000).toISOString()
          : null;

        const updatePayload: Record<string, unknown> = {
          stripe_subscription_id: subscription.id,
          subscription_status: status,
        };
        if (endDate) updatePayload.subscription_end_date = endDate;
        if (startDate) updatePayload.subscription_start_date = startDate;

        const { error: subUpdateErr } = await supabase.from('users').update(updatePayload).eq('id', targetUser.id);
        if (subUpdateErr) {
          throw new Error(`Failed to update subscription in database: ${subUpdateErr.message}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
        if (!customerId) throw new Error('Missing customer ID on subscription.deleted event');

        const { error: delUpdateErr } = await supabase.from('users').update({
          subscription_status: 'cancelled',
          subscription_plan: null,
        }).eq('stripe_customer_id', customerId);

        if (delUpdateErr) {
          throw new Error(`Failed to cancel subscription in database: ${delUpdateErr.message}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
        const subscriptionId = typeof (invoice as any).subscription === 'string' ? (invoice as any).subscription : null;

        if (customerId) {
          let endDate: string | null = null;
          if (subscriptionId) {
            try {
              const subObj = await stripe.subscriptions.retrieve(subscriptionId);
              if ((subObj as any).current_period_end) {
                endDate = new Date((subObj as any).current_period_end * 1000).toISOString();
              }
            } catch {
              // Gracefully handle subscription retrieval
            }
          }

          const updatePayload: Record<string, unknown> = {
            subscription_status: 'active',
          };
          if (endDate) {
            updatePayload.subscription_end_date = endDate;
          }

          const { error: invUpdateErr } = await supabase.from('users').update(updatePayload).eq('stripe_customer_id', customerId);
          if (invUpdateErr) {
            throw new Error(`Failed to record invoice payment success in database: ${invUpdateErr.message}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;

        if (customerId) {
          const { error: failUpdateErr } = await supabase.from('users').update({
            subscription_status: 'lapsed',
          }).eq('stripe_customer_id', customerId);

          if (failUpdateErr) {
            throw new Error(`Failed to update subscription status to lapsed in database: ${failUpdateErr.message}`);
          }
        }
        break;
      }
    }

    // ── 3. Mark Event Completed Only After Business Operation Succeeded ──
    const { error: completeErr } = await supabase.rpc('complete_stripe_event', { p_event_id: event.id });
    if (completeErr) {
      const { error: directUpdateErr } = await supabase.from('stripe_events').update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      }).eq('id', event.id);

      if (directUpdateErr) {
        throw new Error(`Failed to record stripe event completion: ${directUpdateErr.message}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (handlerErr: any) {
    // Mark event as failed in database so subsequent Stripe retry will re-claim and re-execute
    try {
      const { error: failErr } = await supabase.rpc('fail_stripe_event', { p_event_id: event.id });
      if (failErr) {
        await supabase.from('stripe_events').update({ status: 'failed' }).eq('id', event.id);
      }
    } catch {
      // Best-effort cleanup
    }

    // Fail closed: return HTTP 500 to trigger safe Stripe retry
    return NextResponse.json(
      { error: handlerErr?.message || 'Webhook processing error' },
      { status: 500 }
    );
  }
}
