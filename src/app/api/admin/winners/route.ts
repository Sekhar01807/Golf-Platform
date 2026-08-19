import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAPI } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateWinnerUpdateInput, isValidUuid } from '@/lib/validations';
import { logAdminAction } from '@/lib/services/audit.service';

export async function GET() {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data: winners, error } = await supabase
    .from('draw_winners')
    .select('id, match_type, prize_amount, verification_status, payout_status, winner_proof_url, created_at, users(id, full_name, email), draws(id, draw_month)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch winners' }, { status: 500 });
  }

  return NextResponse.json(winners || []);
}

export async function PATCH(request: NextRequest) {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => null);
    const { id, ...updates } = body || {};

    if (!id || !isValidUuid(id)) {
      return NextResponse.json({ error: 'A valid winner UUID is required' }, { status: 400 });
    }

    const validation = validateWinnerUpdateInput(updates);
    if (!validation.success || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Server-side boundary check: fetch existing record to ensure approved verification before paying out
    const { data: existingWinner, error: fetchErr } = await supabase
      .from('draw_winners')
      .select('id, verification_status, payout_status')
      .eq('id', id)
      .single();

    if (fetchErr || !existingWinner) {
      return NextResponse.json({ error: 'Winner record not found' }, { status: 404 });
    }

    const targetVerification = validation.data.verification_status || existingWinner.verification_status;
    const targetPayout = validation.data.payout_status || existingWinner.payout_status;

    if (targetPayout === 'paid' && targetVerification !== 'approved') {
      return NextResponse.json(
        { error: 'Cannot mark payout as paid unless verification status is approved.' },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from('draw_winners')
      .update(validation.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update winner' }, { status: 500 });
    }

    await logAdminAction({
      actorId: auth.user.id,
      action: 'UPDATE_WINNER_STATUS',
      targetType: 'draw_winners',
      targetId: id,
      details: validation.data,
      failClosed: true,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update winner' }, { status: 500 });
  }
}
