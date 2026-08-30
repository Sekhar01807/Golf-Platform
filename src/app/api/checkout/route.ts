import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCheckoutInput } from '@/lib/validations';
import { getAppUrl, getStripePriceId } from '@/lib/env';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimitRes = enforceRateLimit(request, { limit: 5, windowMs: 60000, keyPrefix: 'checkout' });
  if (rateLimitRes) return rateLimitRes;

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
    const adminDb = createAdminClient();

    // 1. Atomic Concurrency Lock: Checks active status & claims lock under row-lock to prevent race conditions
    const { error: lockError } = await supabase.rpc('claim_checkout_lock', { p_user_id: user.id });
    if (lockError) {
      const isAlreadyActive = lockError.message?.toLowerCase().includes('already has an active subscription');
      const isAlreadyInProgress = lockError.message?.toLowerCase().includes('already in progress');

      if (isAlreadyActive) {
        return NextResponse.json(
          { error: 'You already have an active subscription. Please manage your plan in the Billing Portal.' },
          { status: 400 }
        );
      }

      if (isAlreadyInProgress) {
        return NextResponse.json(
          { error: 'A checkout session is already in progress. Please complete your payment or try again in a few minutes.' },
          { status: 409 }
        );
      }

      // Fail-Closed: Strictly reject checkout initiation if atomic lock cannot be acquired
      return NextResponse.json(
        { error: `Database error acquiring checkout lock: ${lockError.message}` },
        { status: 500 }
      );
    }

    // 2. Fetch user profile for customer binding
    const { data: profile, error: profileErr } = await adminDb
      .from('users')
      .select('stripe_customer_id, email, full_name')
      .eq('id', user.id)
      .single();

    if (profileErr) {
      throw new Error(`Failed to load user profile: ${profileErr.message}`);
    }

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.full_name || '',
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      const { error: customerUpdateErr } = await adminDb.from('users').update({
        stripe_customer_id: customerId,
      }).eq('id', user.id);

      if (customerUpdateErr) {
        throw new Error(`Failed to bind Stripe customer ID: ${customerUpdateErr.message}`);
      }
    }

    // Fail closed if Stripe price ID is unconfigured or placeholder
    let priceId = getStripePriceId(plan);
    const appUrl = getAppUrl(request);

    // If a product ID (prod_...) was provided, resolve its active price automatically
    if (priceId.startsWith('prod_')) {
      const prices = await stripe.prices.list({ product: priceId, active: true, limit: 1 });
      if (prices.data.length > 0) {
        priceId = prices.data[0].id;
      } else {
        throw new Error(`No active price found for Stripe product ${priceId}. Please create a recurring price in Stripe.`);
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard?cancelled=true`,
      metadata: {
        user_id: user.id,
        plan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    // Release checkout lock on session creation failure so the user is not locked out
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const adminDb = createAdminClient();
        await adminDb.from('users').update({ checkout_lock_until: null }).eq('id', user.id);
      }
    } catch {
      // Best-effort cleanup
    }

    return NextResponse.json({ error: error?.message || 'Failed to create checkout session' }, { status: 500 });
  }
}
