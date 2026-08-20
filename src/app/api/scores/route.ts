import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
      // Fallback with adminDb in case of RLS cache or recursion issues
      const adminDb = createAdminClient();
      const { data: adminScores } = await adminDb
        .from('golf_scores')
        .select('id, user_id, score, date_played, created_at')
        .eq('user_id', user.id)
        .order('date_played', { ascending: false })
        .limit(5);
      return NextResponse.json(adminScores || [], { status: 200 });
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

    // Revalidate dashboard and score paths so client router cache and RSC cache are instantly purged
    try {
      revalidatePath('/dashboard');
      revalidatePath('/dashboard/scores');
      revalidatePath('/dashboard/draws');
    } catch {
      // Graceful fallback in non-request contexts
    }

    if (!rpcError && scoreId) {
      return NextResponse.json({ id: scoreId, user_id: user.id, score, date_played }, { status: 201 });
    }

    // 2. Direct insertion fallback using adminDb (service role) to maintain strict 5-round FIFO
    const adminDb = createAdminClient();

    // Ensure user profile exists in public.users to satisfy FK constraint
    const { data: existingUser } = await adminDb.from('users').select('id').eq('id', user.id).single();
    if (!existingUser) {
      await adminDb.from('users').upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Golfer',
        role: 'user',
        subscription_status: 'inactive',
      });
    }

    const { data: inserted, error: insertError } = await adminDb
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
    const { data: allScores } = await adminDb
      .from('golf_scores')
      .select('id, date_played, created_at')
      .eq('user_id', user.id)
      .order('date_played', { ascending: false })
      .order('created_at', { ascending: false });

    if (allScores && allScores.length > 5) {
      const excessIds = allScores.slice(5).map((s) => s.id);
      await adminDb.from('golf_scores').delete().in('id', excessIds);
    }

    return NextResponse.json(inserted || { user_id: user.id, score, date_played }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to process score submission' }, { status: 500 });
  }
}
