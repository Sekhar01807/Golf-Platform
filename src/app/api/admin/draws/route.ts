import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAPI } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { simulateMonthlyDraw, publishDraw, lockDraw } from '@/lib/services/draw.service';

export async function GET() {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data: draws, error } = await supabase
    .from('draws')
    .select('*')
    .order('draw_month', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch draws' }, { status: 500 });
  }

  return NextResponse.json(draws || []);
}

export async function POST(request: NextRequest) {
  const auth = await assertAdminAPI();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const { action, drawMonth, drawLogic, drawId } = body || {};

  try {
    if (action === 'simulate') {
      const month = drawMonth || new Date().toISOString().slice(0, 7) + '-01';
      const result = await simulateMonthlyDraw(month, drawLogic || 'random');
      return NextResponse.json(result);
    }

    if (action === 'publish') {
      if (!drawId) return NextResponse.json({ error: 'drawId is required to publish' }, { status: 400 });
      const result = await publishDraw(drawId, auth.user.id);
      return NextResponse.json(result);
    }

    if (action === 'lock') {
      if (!drawId) return NextResponse.json({ error: 'drawId is required to lock' }, { status: 400 });
      const result = await lockDraw(drawId, auth.user.id);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action. Supported: simulate, publish, lock' }, { status: 400 });
  } catch (err: any) {
    console.error('Draw operation error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to execute draw operation' }, { status: 500 });
  }
}
