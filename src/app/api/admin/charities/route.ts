import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAPI } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCharityInput } from '@/lib/validations';
import { logAdminAction } from '@/lib/services/audit.service';

export async function GET() {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data: charities, error } = await supabase
    .from('charities')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch charities' }, { status: 500 });
  }

  return NextResponse.json(charities || []);
}

export async function POST(request: NextRequest) {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const validation = validateCharityInput(body);

  if (!validation.success || !validation.data) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: created, error } = await supabase
    .from('charities')
    .insert(validation.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to create charity' }, { status: 500 });
  }

  await logAdminAction({
    actorId: auth.user.id,
    action: 'CREATE_CHARITY',
    targetType: 'charities',
    targetId: created.id,
    details: { name: created.name },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Charity ID is required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('charities').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete charity' }, { status: 500 });
  }

  await logAdminAction({
    actorId: auth.user.id,
    action: 'DELETE_CHARITY',
    targetType: 'charities',
    targetId: id,
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const { id, is_featured } = body || {};

  if (!id || typeof is_featured !== 'boolean') {
    return NextResponse.json({ error: 'Charity ID and is_featured boolean required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: updated, error } = await supabase
    .from('charities')
    .update({ is_featured })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update charity' }, { status: 500 });
  }

  await logAdminAction({
    actorId: auth.user.id,
    action: 'TOGGLE_FEATURED_CHARITY',
    targetType: 'charities',
    targetId: id,
    details: { is_featured },
  });

  return NextResponse.json(updated);
}
