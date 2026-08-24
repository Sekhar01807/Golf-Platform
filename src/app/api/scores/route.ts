import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
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
      return NextResponse.json({ error: `Failed to fetch golf scores: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json(scores || [], { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
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

    // Execute atomic single-transaction score insertion & 5-round FIFO enforcement via database RPC
    const { data: scoreId, error: rpcError } = await supabase.rpc('add_golf_score', {
      p_user_id: user.id,
      p_score: score,
      p_date_played: date_played,
    });

    // Fail-Closed: Strictly require transactional database procedure to succeed
    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('Authentication required')) {
        return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
      }
      if (msg.includes('Unauthorized')) {
        return NextResponse.json({ error: msg }, { status: 403 });
      }
      if (
        msg.includes('Score must be between') ||
        msg.includes('Date played') ||
        msg.includes('User profile not found')
      ) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      return NextResponse.json(
        { error: `Database transaction error recording score: ${msg}` },
        { status: 500 }
      );
    }

    if (!scoreId) {
      return NextResponse.json(
        { error: 'Failed to record golf score: No ID returned from transaction procedure.' },
        { status: 500 }
      );
    }

    // Purge Next.js client router cache and RSC cache for affected paths
    try {
      revalidatePath('/dashboard');
      revalidatePath('/dashboard/scores');
      revalidatePath('/dashboard/draws');
    } catch {
      // Graceful fallback in non-request contexts
    }

    return NextResponse.json(
      { id: scoreId, user_id: user.id, score, date_played },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to process score submission' },
      { status: 500 }
    );
  }
}
