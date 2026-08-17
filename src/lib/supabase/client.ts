import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Return a mock client for local development without env vars
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured. Set env vars.' } }),
        signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured. Set env vars.' } }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({ data: null, error: { message: 'Supabase not configured' }, eq: () => ({ data: null, error: null, single: () => ({ data: null, error: null }) }) }),
        insert: () => ({ data: null, error: { message: 'Supabase not configured' }, select: () => ({ single: () => ({ data: null, error: null }) }) }),
        update: () => ({ data: null, error: { message: 'Supabase not configured' }, eq: () => ({ data: null, error: null }) }),
        delete: () => ({ data: null, error: { message: 'Supabase not configured' }, eq: () => ({ data: null, error: null }) }),
      }),
    } as ReturnType<typeof createBrowserClient>;
  }

  return createBrowserClient(url, key);
}
