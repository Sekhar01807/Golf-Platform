import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAPI } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { simulateMonthlyDraw, publishDraw, lockDraw } from '@/lib/services/draw.service';
import { validateDrawActionInput } from '@/lib/validations';

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
  const validation = validateDrawActionInput(body);

  if (!validation.success || !validation.data) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { action, drawMonth, drawLogic, drawId, forceRegenerate, entropySeed } = validation.data;

  try {
    if (action === 'simulate' && drawMonth) {
      const result = await simulateMonthlyDraw(drawMonth, drawLogic || 'random', {
        forceRegenerate,
        entropySeed,
        actorId: auth.user.id,
      });
      return NextResponse.json(result);
    }

    if (action === 'publish' && drawId) {
      const result = await publishDraw(drawId, auth.user.id);
      return NextResponse.json(result);
    }

    if (action === 'lock' && drawId) {
      const result = await lockDraw(drawId, auth.user.id);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid draw action payload' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to execute draw operation' }, { status: 500 });
  }
}
