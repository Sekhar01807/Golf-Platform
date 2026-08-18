import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminConfig } from '@/lib/env';

// Admin client with service role key — use ONLY in server-side code
export function createAdminClient() {
  const { url, serviceKey } = getSupabaseAdminConfig();

  return createClient(
    url,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
