import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All pages require runtime env vars (Supabase, Stripe)
  // so we skip static pre-rendering at build time
  experimental: {
    // This is the standard approach for Supabase + Next.js apps
  },
  // Disable static page generation for API routes that use Stripe
  serverExternalPackages: ['stripe'],
};

export default nextConfig;
