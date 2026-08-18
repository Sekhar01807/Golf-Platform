import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
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
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── 1. Atomic Webhook Idempotency (Insert-First closes concurrent race windows) ──
  try {
    const { error: insertError } = await supabase
      .from('stripe_events')
      .insert({
        id: event.id,
        event_type: event.type,
      });

    if (insertError) {
      // PostgreSQL code 23505 = unique_violation on PRIMARY KEY (event.id)
      if (
        insertError.code === '23505' ||
        insertError.message?.toLowerCase().includes('duplicate') ||
        insertError.message?.toLowerCase().includes('unique')
      ) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      // Non-duplicate database failure -> FAIL CLOSED (do not process, signal Stripe to retry)
      console.error('Stripe idempotency database claim failed (failing closed):', insertError);
      return NextResponse.json({ error: 'Database idempotency claim failed' }, { status: 500 });
    }
  } catch (dbErr) {
    console.error('Stripe idempotency check exception (failing closed):', dbErr);
    return NextResponse.json({ error: 'Database idempotency check error' }, { status: 500 });
  }

  // ── 2. Handle Stripe Event Types ──
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

          if (charityId && donationAmount > 0) {
            // Strictly require atomic DB RPC
            const { error: rpcErr } = await supabase.rpc('record_completed_donation', {
              p_user_id: userId,
              p_charity_id: charityId,
              p_amount: donationAmount,
              p_stripe_payment_id: paymentId,
            });

            if (rpcErr) {
              console.error('Failed to record completed donation via atomic RPC:', rpcErr);
              throw new Error(`Atomic donation recording failed: ${rpcErr.message}`);
            }
          }
          break;
        }

        // B. Handle Subscription Checkout
        const userId = metadata.user_id;
        const plan = (metadata.plan === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly';
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
        const customerId = typeof session.customer === 'string' ? session.customer : null;

        if (userId && customerId) {
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
            } catch (subErr) {
              console.warn('Could not fetch subscription dates directly from Stripe:', subErr);
            }
          }

          if (!endDate) {
            const defaultDays = plan === 'yearly' ? 365 : 30;
            const d = new Date();
            d.setDate(d.getDate() + defaultDays);
            endDate = d.toISOString();
          }

          await supabase.from('users').update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            subscription_plan: plan,
            subscription_start_date: startDate,
            subscription_end_date: endDate,
          }).eq('id', userId);

          const { data: user } = await supabase.from('users').select('email, full_name').eq('id', userId).single();
          if (user?.email) {
            await sendEmail({
              to: user.email,
              subject: 'Welcome to GolfCharity — Subscription Confirmed!',
              html: `<h1>Thank you for joining GolfCharity, ${user.full_name || 'Member'}!</h1><p>Your ${plan} membership is now active. Enter your scores and support causes making real impact.</p>`,
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
        if (!customerId) break;

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

        await supabase.from('users').update(updatePayload).eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
        if (!customerId) break;

        await supabase.from('users').update({
          subscription_status: 'cancelled',
          subscription_plan: null,
        }).eq('stripe_customer_id', customerId);
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
            } catch (err) {
              console.warn('Could not retrieve subscription on invoice payment:', err);
            }
          }

          const updatePayload: Record<string, unknown> = {
            subscription_status: 'active',
          };
          if (endDate) {
            updatePayload.subscription_end_date = endDate;
          }

          await supabase.from('users').update(updatePayload).eq('stripe_customer_id', customerId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;

        if (customerId) {
          await supabase.from('users').update({
            subscription_status: 'lapsed',
          }).eq('stripe_customer_id', customerId);
        }
        break;
      }
    }
  } catch (handlerErr) {
    console.error('Webhook event handler processing error:', handlerErr);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
