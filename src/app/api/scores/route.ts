import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateScoreInput } from '@/lib/validations';

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
      .select('*')
      .eq('user_id', user.id)
      .order('date_played', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Failed to fetch scores:', error);
      return NextResponse.json({ error: 'Failed to retrieve golf scores' }, { status: 500 });
    }

    return NextResponse.json(scores || []);
  } catch (error) {
    console.error('Scores fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    // First try invoking the database RPC for transactional FIFO enforcement
    const { data: rpcResult, error: rpcError } = await supabase.rpc('add_golf_score', {
      p_user_id: user.id,
      p_score: score,
      p_date_played: date_played,
    });

    if (!rpcError && rpcResult) {
      const { data: insertedScore } = await supabase
        .from('golf_scores')
        .select('*')
        .eq('id', rpcResult)
        .single();

      return NextResponse.json(insertedScore || { id: rpcResult, user_id: user.id, score, date_played });
    }

    // Fallback if RPC is not yet migrated in current DB instance
    const { data: existing } = await supabase
      .from('golf_scores')
      .select('id, date_played, created_at')
      .eq('user_id', user.id)
      .order('date_played', { ascending: true })
      .order('created_at', { ascending: true });

    // FIFO: If 5 scores exist, delete oldest
    if (existing && existing.length >= 5) {
      const toDelete = existing.slice(0, existing.length - 4).map(s => s.id);
      await supabase.from('golf_scores').delete().in('id', toDelete);
    }

    const { data: newScore, error: insertError } = await supabase
      .from('golf_scores')
      .insert({
        user_id: user.id,
        score,
        date_played,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Score insert error:', insertError);
      return NextResponse.json({ error: insertError.message || 'Failed to insert score' }, { status: 500 });
    }

    return NextResponse.json(newScore);
  } catch (error) {
    console.error('Score insert exception:', error);
    return NextResponse.json({ error: 'Failed to process score submission' }, { status: 500 });
  }
}
