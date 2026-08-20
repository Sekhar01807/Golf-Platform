import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAPI } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidUuid } from '@/lib/validations';
import { logAdminAction } from '@/lib/services/audit.service';

export async function GET() {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, subscription_status, subscription_plan, subscription_end_date, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  return NextResponse.json(users || []);
}

export async function PATCH(request: NextRequest) {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => null);
    const { userId, role, subscription_status, subscription_plan } = body || {};

    if (!userId || !isValidUuid(userId)) {
      return NextResponse.json({ error: 'Valid user UUID is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (role && (role === 'admin' || role === 'user')) {
      updates.role = role;
    }

    if (subscription_status && ['active', 'inactive', 'cancelled', 'lapsed'].includes(subscription_status)) {
      updates.subscription_status = subscription_status;
      if (subscription_status === 'active') {
        const d = new Date();
        d.setDate(d.getDate() + (subscription_plan === 'yearly' ? 365 : 30));
        updates.subscription_end_date = d.toISOString();
      }
    }

    if (subscription_plan && ['monthly', 'yearly'].includes(subscription_plan)) {
      updates.subscription_plan = subscription_plan;
    }

    const supabase = createAdminClient();
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, full_name, email, role, subscription_status, subscription_plan, subscription_end_date')
      .single();

    if (updateError || !updatedUser) {
      return NextResponse.json({ error: updateError?.message || 'Failed to update user' }, { status: 500 });
    }

    await logAdminAction({
      actorId: auth.user.id,
      action: 'UPDATE_USER_SECURITY',
      targetType: 'users',
      targetId: userId,
      details: updates,
      failClosed: true,
    });

    return NextResponse.json(updatedUser);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update user' }, { status: 500 });
  }
}
