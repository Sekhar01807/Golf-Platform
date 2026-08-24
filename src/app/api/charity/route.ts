import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimitRes = enforceRateLimit(request, { limit: 10, windowMs: 60000, keyPrefix: 'charity' });
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

    const body = await request.json().catch(() => ({}));
    const { selectedCharityId, percentage } = body;

    if (!selectedCharityId || typeof selectedCharityId !== 'string') {
      return NextResponse.json({ error: 'Please select a valid partner charity' }, { status: 400 });
    }

    const pctNumber = Number(percentage);
    if (isNaN(pctNumber) || pctNumber < 10 || pctNumber > 50) {
      return NextResponse.json({ error: 'Charity contribution rate must be between 10% and 50%' }, { status: 400 });
    }

    // Verify charity exists via authenticated client (RLS policy: Public read charities)
    const { data: charity, error: charityErr } = await supabase
      .from('charities')
      .select('id, name')
      .eq('id', selectedCharityId)
      .single();

    if (charityErr || !charity) {
      return NextResponse.json({ error: 'Selected charity was not found in active directory' }, { status: 404 });
    }

    // Update public.users record via authenticated client (RLS & trigger protected)
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        selected_charity_id: selectedCharityId,
        charity_contribution_percentage: pctNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message || 'Failed to update charity preference in database' },
        { status: 500 }
      );
    }

    // Purge caches
    try {
      revalidatePath('/dashboard');
      revalidatePath('/dashboard/charity');
      revalidatePath('/dashboard/profile');
    } catch {
      // Best-effort
    }

    return NextResponse.json({
      success: true,
      charityName: charity.name,
      percentage: pctNumber,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update charity preferences' }, { status: 500 });
  }
}
