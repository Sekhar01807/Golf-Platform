/**
 * Environment & Application Configuration Helper
 * Enforces fail-closed rules and strictly validates production environment settings.
 */

export function getAppUrl(request?: Request | any): string {
  // 1. Prioritize dynamic caller origin / host from incoming request
  if (request) {
    try {
      const origin = request.headers?.get?.('origin');
      if (origin && typeof origin === 'string' && origin.startsWith('http') && !origin.includes('localhost:0')) {
        return origin.replace(/\/$/, '');
      }

      const host = request.headers?.get?.('x-forwarded-host') || request.headers?.get?.('host');
      const proto = request.headers?.get?.('x-forwarded-proto') || (request.nextUrl?.protocol ? request.nextUrl.protocol.replace(':', '') : 'https');
      if (host && typeof host === 'string') {
        return `${proto}://${host}`.replace(/\/$/, '');
      }
    } catch {
      // Fallback
    }
  }

  // 2. Explicit Environment Variable
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim() !== '') {
    // If deployed on Vercel/production and envUrl is localhost, prefer VERCEL_URL if available
    if (process.env.NODE_ENV === 'production' && envUrl.includes('localhost') && process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
    }
    return envUrl.replace(/\/$/, '');
  }

  // 3. Automatic Vercel deployment URL fallback
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/\/$/, '')}`;
  }

  // 4. Default for development
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing NEXT_PUBLIC_APP_URL: Application URL must be configured in production environment variables.');
  }

  return 'http://localhost:3000';
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
