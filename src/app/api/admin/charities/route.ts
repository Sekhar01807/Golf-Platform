import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAPI } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCharityInput, isValidUuid } from '@/lib/validations';
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

  try {
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
      failClosed: true,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error('Charity creation error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to create charity' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || !isValidUuid(id)) {
      return NextResponse.json({ error: 'A valid charity UUID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Protect historical donation records: verify no donations are attached
    const { count: donationCount, error: countError } = await supabase
      .from('independent_donations')
      .select('id', { count: 'exact', head: true })
      .eq('charity_id', id);

    if (countError) {
      return NextResponse.json({ error: 'Failed to verify donation history' }, { status: 500 });
    }

    if (donationCount && donationCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete charity with existing donation history. Financial records are immutable.' },
        { status: 409 }
      );
    }

    const { error } = await supabase.from('charities').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete charity' }, { status: 500 });
    }

    await logAdminAction({
      actorId: auth.user.id,
      action: 'DELETE_CHARITY',
      targetType: 'charities',
      targetId: id,
      failClosed: true,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Charity deletion error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to delete charity' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => null);
    const { id, is_featured } = body || {};

    if (!id || !isValidUuid(id) || typeof is_featured !== 'boolean') {
      return NextResponse.json({ error: 'A valid charity UUID and is_featured boolean are required' }, { status: 400 });
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
      failClosed: true,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('Charity patch error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update charity' }, { status: 500 });
  }
}
