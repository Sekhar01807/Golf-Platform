import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in.' }, { status: 401 });
    }

    // Fetch user profile from public.users via authenticated client (RLS policy: Users can read own profile)
    const { data: profile, error: profileErr } = await supabase
      .from('users')
      .select('full_name, email, role, subscription_status, subscription_plan, subscription_start_date, subscription_end_date, selected_charity_id, charity_contribution_percentage, created_at')
      .eq('id', user.id)
      .single();

    if (profileErr && profileErr.code !== 'PGRST116') {
      return NextResponse.json({ error: `Failed to load profile: ${profileErr.message}` }, { status: 500 });
    }

    // Fetch selected charity details if any via authenticated client (RLS policy: Public read charities)
    let charityName = null;
    if (profile?.selected_charity_id) {
      const { data: charity } = await supabase
        .from('charities')
        .select('name')
        .eq('id', profile.selected_charity_id)
        .single();
      if (charity) charityName = charity.name;
    }

    // Fetch verified scores count and records via authenticated client (RLS policy: Users read own scores)
    const { data: scores } = await supabase
      .from('golf_scores')
      .select('id, score, date_played, created_at')
      .eq('user_id', user.id)
      .order('date_played', { ascending: false })
      .limit(5);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata,
      },
      profile: profile || {
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Golfer',
        subscription_status: 'inactive',
        subscription_plan: null,
      },
      charityName,
      scores: scores || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rateLimitRes = enforceRateLimit(request, { limit: 15, windowMs: 60000, keyPrefix: 'profile' });
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

    const body = await request.json().catch(() => ({}));
    const { fullName, phone, golfProfile, preferences, notifications, profileVisibility } = body;

    // 1. Update public.users record via authenticated client (RLS & trigger protected)
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof fullName === 'string' && fullName.trim().length > 0) {
      updates.full_name = fullName.trim().slice(0, 100);
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (updateErr) {
      return NextResponse.json(
        { error: `Failed to update profile in database: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // 2. Update Supabase Auth metadata for seamless client-side session sync
    const metadataUpdates: Record<string, any> = { ...user.user_metadata };
    if (fullName) metadataUpdates.full_name = fullName.trim();
    if (phone !== undefined) metadataUpdates.phone = phone;
    if (golfProfile !== undefined) metadataUpdates.golf_profile = golfProfile;
    if (preferences !== undefined) metadataUpdates.preferences = preferences;
    if (notifications !== undefined) metadataUpdates.notifications = notifications;
    if (profileVisibility !== undefined) metadataUpdates.profile_visibility = profileVisibility;

    const { error: metaErr } = await supabase.auth.updateUser({
      data: metadataUpdates,
    });

    if (metaErr) {
      return NextResponse.json(
        { error: `Failed to sync user session metadata: ${metaErr.message}` },
        { status: 500 }
      );
    }

    // 3. Purge all Next.js server caches for affected dashboard pages
    try {
      revalidatePath('/dashboard');
      revalidatePath('/dashboard/profile');
      revalidatePath('/dashboard/settings');
      revalidatePath('/dashboard/charity');
    } catch {
      // Best-effort cache invalidation
    }

    return NextResponse.json({
      success: true,
      fullName: updates.full_name || user.user_metadata?.full_name,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update profile' }, { status: 500 });
  }
}
