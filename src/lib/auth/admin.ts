import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserProfile } from '@/types/database';

export interface AdminAuthContext {
  user: { id: string; email?: string };
  profile: UserProfile;
}

/**
 * Server-Side Admin Guard for Next.js App Router Server Components/Pages
 * Verifies active session AND database-enforced 'admin' role.
 * Redirects unauthorized users to login or dashboard.
 */
export async function requireAdmin(): Promise<AdminAuthContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/auth/login?redirectTo=/admin');
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    redirect('/dashboard?error=unauthorized');
  }

  return {
    user: { id: user.id, email: user.email },
    profile: profile as UserProfile,
  };
}

/**
 * Server-Side Admin Guard for Next.js Route Handlers (API Routes)
 * Returns status code 401/403 instead of redirecting.
 */
export async function assertAdminAPI(): Promise<
  | { authorized: true; user: { id: string; email?: string }; profile: UserProfile }
  | { authorized: false; status: 401 | 403; message: string }
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, status: 401, message: 'Unauthorized: Authentication required.' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    return { authorized: false, status: 403, message: 'Forbidden: Administrator privileges required.' };
  }

  return {
    authorized: true,
    user: { id: user.id, email: user.email },
    profile: profile as UserProfile,
  };
}

/**
 * Retrieves the currently authenticated user and profile
 */
export async function getAuthenticatedUser(): Promise<{
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return {
    user: { id: user.id, email: user.email },
    profile: (profile as UserProfile) || null,
  };
}
