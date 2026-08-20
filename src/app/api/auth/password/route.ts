import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit password change attempts (5 per minute per IP)
  const rateLimitRes = enforceRateLimit(request, { limit: 5, windowMs: 60000, keyPrefix: 'pwd-change' });
  if (rateLimitRes) return rateLimitRes;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in to update your password.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { currentPassword, newPassword } = body;

    // 1. Strict validation: prevent update without entering previous password
    if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.trim() === '') {
      return NextResponse.json(
        { error: 'Current password is required. You must verify your previous password before setting a new one.' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    if (newPassword.length > 100) {
      return NextResponse.json(
        { error: 'New password is too long (maximum 100 characters).' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password cannot be identical to your current password. Please choose a different password.' },
        { status: 400 }
      );
    }

    // 2. Cryptographically verify current (previous) password
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Authentication service configuration missing.' }, { status: 500 });
    }

    const authVerifier = createSupabaseClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error: verifyError } = await authVerifier.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      return NextResponse.json(
        { error: 'Incorrect previous password. Please enter your existing password correctly.' },
        { status: 400 }
      );
    }

    // 3. Update password via admin client to guarantee encrypted hashing and avoid session loss
    const adminDb = createAdminClient();
    const { error: updateError } = await adminDb.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password in authentication system.' },
        { status: 500 }
      );
    }

    // 4. Update user's timestamp in database
    await adminDb.from('users').update({
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    return NextResponse.json({
      success: true,
      message: 'Your password has been securely updated.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to process password update' }, { status: 500 });
  }
}
