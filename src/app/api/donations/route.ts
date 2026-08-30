import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { validateDonationInput } from '@/lib/validations';
import { getAppUrl } from '@/lib/env';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimitRes = enforceRateLimit(request, { limit: 5, windowMs: 60000, keyPrefix: 'donations' });
  if (rateLimitRes) return rateLimitRes;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await request.json().catch(() => null);
    const validation = validateDonationInput(body);

    if (!validation.success || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { charity_id, amount } = validation.data;

    // Verify charity exists
    const { data: charity, error: charityError } = await supabase
      .from('charities')
      .select('id, name')
      .eq('id', charity_id)
      .single();

    if (charityError || !charity) {
      return NextResponse.json({ error: 'Charity not found' }, { status: 404 });
    }

    const stripe = getStripe();
    const appUrl = getAppUrl(request);

    // Create a one-off Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            unit_amount: amount * 100, // in paise / cents
            product_data: {
              name: `Charity Donation: ${charity.name}`,
              description: `One-time direct contribution to ${charity.name} via GolfCharity.`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/charities?donation=success&charity=${encodeURIComponent(charity.name)}`,
      cancel_url: `${appUrl}/charities?donation=cancelled`,
      metadata: {
        type: 'independent_donation',
        user_id: user?.id || null,
        charity_id: charity.id,
        amount: String(amount),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: 'Failed to initiate donation checkout' }, { status: 500 });
  }
}
