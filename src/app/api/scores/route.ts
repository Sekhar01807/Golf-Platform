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
      return NextResponse.json({ error: error.message || 'Failed to retrieve golf scores' }, { status: 500 });
    }

    return NextResponse.json(scores || []);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
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

    // Strict transactional FIFO insertion via PostgreSQL stored function
    const { data: scoreId, error: rpcError } = await supabase.rpc('add_golf_score', {
      p_user_id: user.id,
      p_score: score,
      p_date_played: date_played,
    });

    if (rpcError) {
      return NextResponse.json(
        { error: 'Failed to record score transactionally. Ensure database functions are migrated.' },
        { status: 500 }
      );
    }

    const { data: insertedScore } = await supabase
      .from('golf_scores')
      .select('*')
      .eq('id', scoreId)
      .single();

    return NextResponse.json(insertedScore || { id: scoreId, user_id: user.id, score, date_played }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to process score submission' }, { status: 500 });
  }
}
