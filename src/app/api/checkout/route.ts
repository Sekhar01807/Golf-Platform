import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { validateCheckoutInput } from '@/lib/validations';
import { getAppUrl, getStripePriceId } from '@/lib/env';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const validation = validateCheckoutInput(body);

    if (!validation.success || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { plan } = validation.data;
    const stripe = getStripe();

    // Get user profile and verify subscription status
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id, email, full_name, subscription_status')
      .eq('id', user.id)
      .single();

    if (profile?.subscription_status === 'active') {
      return NextResponse.json(
        { error: 'User already has an active subscription. Manage billing via the customer portal.' },
        { status: 400 }
      );
    }

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.full_name || '',
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase.from('users').update({
        stripe_customer_id: customerId,
      }).eq('id', user.id);
    }

    // Fail closed if Stripe price ID is unconfigured or placeholder
    const priceId = getStripePriceId(plan);
    const appUrl = getAppUrl();

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?subscription=success`,
      cancel_url: `${appUrl}/dashboard/subscription?cancelled=true`,
      metadata: {
        user_id: user.id,
        plan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create checkout session' }, { status: 500 });
  }
}
