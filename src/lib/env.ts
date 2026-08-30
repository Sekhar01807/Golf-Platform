/**
 * Environment & Application Configuration Helper
 * Enforces fail-closed rules and strictly validates production environment settings.
 */

export function getAppUrl(request?: Request | any): string {
  if (request) {
    try {
      const origin = request.headers?.get?.('origin');
      if (origin && typeof origin === 'string' && origin.startsWith('http')) {
        return origin.replace(/\/$/, '');
      }

      const host = request.headers?.get?.('x-forwarded-host') || request.headers?.get?.('host');
      const proto = request.headers?.get?.('x-forwarded-proto') || (request.nextUrl?.protocol ? request.nextUrl.protocol.replace(':', '') : 'http');
      if (host) {
        return `${proto}://${host}`.replace(/\/$/, '');
      }
    } catch {
      // Fallback to env URL
    }
  }

  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing NEXT_PUBLIC_APP_URL: Application URL must be configured in production.');
    }
    return 'http://localhost:3000';
  }
  return url.replace(/\/$/, '');
}

export function getStripePriceId(plan: 'monthly' | 'yearly'): string {
  const envVarName = plan === 'yearly' ? 'STRIPE_YEARLY_PRICE_ID' : 'STRIPE_MONTHLY_PRICE_ID';
  const priceId = process.env[envVarName];

  if (!priceId || priceId.trim() === '' || priceId.startsWith('placeholder') || priceId === 'price_monthly' || priceId === 'price_yearly') {
    throw new Error(`Stripe price configuration error: Environment variable ${envVarName} is not configured.`);
  }

  return priceId;
}

export function getSupabaseAdminConfig(): { url: string; serviceKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || url.trim() === '' || url.includes('placeholder')) {
    throw new Error('Supabase admin configuration error: NEXT_PUBLIC_SUPABASE_URL is not configured.');
  }

  if (!serviceKey || serviceKey.trim() === '' || serviceKey.includes('placeholder')) {
    throw new Error('Supabase admin configuration error: SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return {
    url,
    serviceKey,
  };
}
