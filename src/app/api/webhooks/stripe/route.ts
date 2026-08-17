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
      console.warn('Stripe idempotency insert warning:', insertError);
    }
  } catch (dbErr) {
    console.warn('Stripe idempotency check warning:', dbErr);
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
            // Attempt atomic DB RPC
            const { error: rpcErr } = await supabase.rpc('record_completed_donation', {
              p_user_id: userId,
              p_charity_id: charityId,
              p_amount: donationAmount,
              p_stripe_payment_id: paymentId,
            });

            if (rpcErr) {
              // Fallback manual insert & increment
              await supabase.from('independent_donations').insert({
                user_id: userId,
                charity_id: charityId,
                amount: donationAmount,
                payment_status: 'completed',
                stripe_payment_id: paymentId,
              });

              const { data: charity } = await supabase
                .from('charities')
                .select('total_contributions')
                .eq('id', charityId)
                .single();

              const updatedTotal = (Number(charity?.total_contributions) || 0) + donationAmount;
              await supabase
                .from('charities')
                .update({ total_contributions: updatedTotal })
                .eq('id', charityId);
            }
          }
          break;
        }

        // B. Handle Subscription Checkout
        const userId = metadata.user_id;
        const plan = metadata.plan as 'monthly' | 'yearly';
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

        if (userId) {
          let endDate: string | null = null;
          let startDate: string = new Date().toISOString();

          if (subscriptionId) {
            try {
              const subObj = await stripe.subscriptions.retrieve(subscriptionId);
              if ((subObj as any).current_period_end) {
                endDate = new Date((subObj as any).current_period_end * 1000).toISOString();
              }
            } catch (subErr) {
              console.warn('Could not fetch subscription dates directly:', subErr);
            }
          }

          if (!endDate) {
            const defaultDays = plan === 'yearly' ? 365 : 30;
            const d = new Date();
            d.setDate(d.getDate() + defaultDays);
            endDate = d.toISOString();
          }

          await supabase.from('users').update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            subscription_plan: plan || 'monthly',
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
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const status = subscription.status === 'active' ? 'active' :
                       subscription.status === 'canceled' ? 'cancelled' : 'lapsed';

        const endDate = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        await supabase.from('users').update({
          stripe_subscription_id: subscription.id,
          subscription_status: status,
          subscription_end_date: endDate,
        }).eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        await supabase.from('users').update({
          subscription_status: 'cancelled',
          subscription_plan: null,
        }).eq('stripe_customer_id', customerId);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;

        if (customerId) {
          await supabase.from('users').update({
            subscription_status: 'active',
          }).eq('stripe_customer_id', customerId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;

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
