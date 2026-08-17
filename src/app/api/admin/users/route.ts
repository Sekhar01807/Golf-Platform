import { NextResponse } from 'next/server';
import { assertAdminAPI } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

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
