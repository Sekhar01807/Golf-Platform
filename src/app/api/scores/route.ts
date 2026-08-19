import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateScoreInput } from '@/lib/validations';
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

    const { data: scores, error } = await supabase
      .from('golf_scores')
      .select('id, user_id, score, date_played, created_at')
      .eq('user_id', user.id)
      .order('date_played', { ascending: false })
      .limit(5);

    if (error) {
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(scores || [], { status: 200 });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const rateLimitRes = enforceRateLimit(request, { limit: 10, windowMs: 60000, keyPrefix: 'scores' });
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

    const body = await request.json().catch(() => null);
    const validation = validateScoreInput(body);

    if (!validation.success || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { score, date_played } = validation.data;

    // 1. Attempt transactional FIFO function
    const { data: scoreId, error: rpcError } = await supabase.rpc('add_golf_score', {
      p_user_id: user.id,
      p_score: score,
      p_date_played: date_played,
    });

    if (!rpcError && scoreId) {
      return NextResponse.json({ id: scoreId, user_id: user.id, score, date_played }, { status: 201 });
    }

    // 2. Direct insertion fallback
    const { data: inserted, error: insertError } = await supabase
      .from('golf_scores')
      .insert({
        user_id: user.id,
        score,
        date_played,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Maintain 5 FIFO
    const { data: allScores } = await supabase
      .from('golf_scores')
      .select('id, date_played')
      .eq('user_id', user.id)
      .order('date_played', { ascending: false });

    if (allScores && allScores.length > 5) {
      const excessIds = allScores.slice(5).map((s) => s.id);
      await supabase.from('golf_scores').delete().in('id', excessIds);
    }

    return NextResponse.json(inserted || { user_id: user.id, score, date_played }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to process score submission' }, { status: 500 });
  }
}
