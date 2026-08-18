import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from './audit.service';
import { MatchType } from '@/types/database';
import { randomInt, createHash } from 'crypto';

export interface EvaluatedWinner {
  userId: string;
  matchType: MatchType;
  matchCount: number;
  prizeAmount: number;
  entryNumbers: number[];
}

export interface PrizeBreakdown {
  tier5Match: { count: number; poolShare: number; individualPrize: number };
  tier4Match: { count: number; poolShare: number; individualPrize: number };
  tier3Match: { count: number; poolShare: number; individualPrize: number };
  totalPrizePool: number;
  totalDistributed: number;
  rolloverAmount: number;
}

export interface DrawSimulationResult {
  drawId: string;
  drawMonth: string;
  winningNumbers: number[];
  eligibleSubscribersCount: number;
  winners: EvaluatedWinner[];
  prizeBreakdown: PrizeBreakdown;
}

/**
 * Generates 5 distinct winning numbers between 1 and 45 using Cryptographically Secure Pseudo-Random Number Generation (CSPRNG)
 */
export function generateWinningNumbers(count = 5, min = 1, max = 45): number[] {
  const numbers = new Set<number>();
  while (numbers.size < count) {
    const num = randomInt(min, max + 1);
    numbers.add(num);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

/**
 * Generates 5 distinct winning numbers deterministically derived from a verifiable SHA-256 hash digest
 */
export function generateAlgorithmicWinningNumbers(
  drawMonth: string,
  seedData = 'golf_charity_draw_seed',
  count = 5,
  min = 1,
  max = 45
): number[] {
  const numbers = new Set<number>();
  let counter = 0;
  const range = max - min + 1;

  while (numbers.size < count) {
    const hash = createHash('sha256')
      .update(`${drawMonth}:${seedData}:${counter}`)
      .digest('hex');
    const subInt = parseInt(hash.substring(0, 8), 16);
    const num = (subInt % range) + min;
    numbers.add(num);
    counter++;
  }

  return Array.from(numbers).sort((a, b) => a - b);
}

/**
 * Compares entry numbers with winning numbers and determines match tier.
 * Enforces set deduplication so repeated identical numbers in an entry cannot inflate the match count.
 */
export function evaluateEntry(
  entryNumbers: number[],
  winningNumbers: number[]
): { matchCount: number; matchType: MatchType | null } {
  const winSet = new Set(winningNumbers);
  const uniqueEntries = Array.from(new Set(entryNumbers));
  const matched = uniqueEntries.filter(num => winSet.has(num));
  const matchCount = matched.length;

  if (matchCount >= 5) return { matchCount, matchType: '5-match' };
  if (matchCount === 4) return { matchCount, matchType: '4-match' };
  if (matchCount === 3) return { matchCount, matchType: '3-match' };

  return { matchCount, matchType: null };
}

/**
 * Calculates mathematical prize breakdown and per-winner distributions:
 * 5-match: 40% (Jackpot)
 * 4-match: 35%
 * 3-match: 25%
 * Explicitly conserves all division residuals and unawarded tier shares into the rollover pool.
 */
export function calculatePrizePoolDistribution(
  totalPrizePool: number,
  tierCounts: { '5-match': number; '4-match': number; '3-match': number }
): PrizeBreakdown {
  const pool5 = Math.round(totalPrizePool * 0.40);
  const pool4 = Math.round(totalPrizePool * 0.35);
  const pool3 = Math.round(totalPrizePool * 0.25);

  const count5 = tierCounts['5-match'];
  const count4 = tierCounts['4-match'];
  const count3 = tierCounts['3-match'];

  const prize5 = count5 > 0 ? Math.floor(pool5 / count5) : 0;
  const prize4 = count4 > 0 ? Math.floor(pool4 / count4) : 0;
  const prize3 = count3 > 0 ? Math.floor(pool3 / count3) : 0;

  const distributed5 = count5 * prize5;
  const distributed4 = count4 * prize4;
  const distributed3 = count3 * prize3;
  const totalDistributed = distributed5 + distributed4 + distributed3;

  // Mathematically conserved: any unawarded pools + integer division residuals roll over
  const rolloverAmount = Math.max(totalPrizePool - totalDistributed, 0);

  return {
    tier5Match: { count: count5, poolShare: pool5, individualPrize: prize5 },
    tier4Match: { count: count4, poolShare: pool4, individualPrize: prize4 },
    tier3Match: { count: count3, poolShare: pool3, individualPrize: prize3 },
    totalPrizePool,
    totalDistributed,
    rolloverAmount,
  };
}

/**
 * Simulates a monthly draw:
 * 1. Collects active subscribers who have logged exactly 5 scores (strictly eligible).
 * 2. Carries forward any unawarded rollover from the previous published/locked draw.
 * 3. Generates verified winning numbers.
 * 4. Evaluates entries and allocates tier prizes.
 */
export async function simulateMonthlyDraw(
  drawMonth: string,
  drawLogic: 'random' | 'algorithmic' = 'random'
): Promise<DrawSimulationResult> {
  const supabase = createAdminClient();

  // 1. Fetch active subscribers
  const { data: subscribers, error: subError } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('subscription_status', 'active');

  if (subError) throw new Error(`Failed to load subscribers: ${subError.message}`);

  const activeUsers = subscribers || [];

  // Query previous published or locked draw to carry forward rollover jackpot
  let previousRollover = 0;
  const { data: previousDraws } = await supabase
    .from('draws')
    .select('rollover_amount')
    .lt('draw_month', drawMonth)
    .in('status', ['published', 'locked'])
    .order('draw_month', { ascending: false })
    .limit(1);

  if (previousDraws && previousDraws.length > 0) {
    previousRollover = Number(previousDraws[0].rollover_amount) || 0;
  }

  // Estimated prize pool: ₹200 per active subscriber + prior unawarded rollover (min ₹10,000)
  const basePrizePool = Math.max(activeUsers.length * 200, 10000) + previousRollover;

  // Check if draw for this month already exists
  const { data: existingDraw } = await supabase
    .from('draws')
    .select('*')
    .eq('draw_month', drawMonth)
    .single();

  let drawId = existingDraw?.id;
  let winningNumbers: number[];

  if (existingDraw) {
    if (existingDraw.status === 'published' || existingDraw.status === 'locked') {
      throw new Error(`Cannot simulate a draw that is already ${existingDraw.status}.`);
    }
    winningNumbers = drawLogic === 'algorithmic'
      ? generateAlgorithmicWinningNumbers(drawMonth)
      : generateWinningNumbers();

    await supabase
      .from('draws')
      .update({
        winning_numbers: winningNumbers,
        total_prize_pool: basePrizePool,
        draw_logic: drawLogic,
      })
      .eq('id', drawId);
  } else {
    winningNumbers = drawLogic === 'algorithmic'
      ? generateAlgorithmicWinningNumbers(drawMonth)
      : generateWinningNumbers();

    const { data: newDraw, error: createError } = await supabase
      .from('draws')
      .insert({
        draw_month: drawMonth,
        status: 'simulated',
        draw_logic: drawLogic,
        winning_numbers: winningNumbers,
        total_prize_pool: basePrizePool,
      })
      .select()
      .single();

    if (createError) throw new Error(`Failed to create draw: ${createError.message}`);
    drawId = newDraw.id;
  }

  // 2. Evaluate only strictly eligible members (must have 5 logged rounds)
  const rawWinners: { userId: string; matchType: MatchType; matchCount: number; entryNumbers: number[] }[] = [];
  let eligibleCount = 0;

  for (const user of activeUsers) {
    const { data: scores } = await supabase
      .from('golf_scores')
      .select('score')
      .eq('user_id', user.id)
      .order('date_played', { ascending: false })
      .limit(5);

    // Business Rule: Member must have logged 5 valid scores to be entered into the draw
    if (!scores || scores.length < 5) {
      continue;
    }

    eligibleCount++;
    const entryNumbers: number[] = scores.map(s => s.score);

    // Upsert draw entry
    await supabase.from('draw_entries').upsert({
      draw_id: drawId,
      user_id: user.id,
      entry_numbers: entryNumbers,
    }, { onConflict: 'draw_id,user_id' });

    const evaluation = evaluateEntry(entryNumbers, winningNumbers);
    if (evaluation.matchType) {
      rawWinners.push({
        userId: user.id,
        matchType: evaluation.matchType,
        matchCount: evaluation.matchCount,
        entryNumbers,
      });
    }
  }

  // 3. Calculate prize allocations
  const tierCounts = {
    '5-match': rawWinners.filter(w => w.matchType === '5-match').length,
    '4-match': rawWinners.filter(w => w.matchType === '4-match').length,
    '3-match': rawWinners.filter(w => w.matchType === '3-match').length,
  };

  const prizeBreakdown = calculatePrizePoolDistribution(basePrizePool, tierCounts);

  const evaluatedWinners: EvaluatedWinner[] = rawWinners.map(w => {
    let prize = 0;
    if (w.matchType === '5-match') prize = prizeBreakdown.tier5Match.individualPrize;
    else if (w.matchType === '4-match') prize = prizeBreakdown.tier4Match.individualPrize;
    else if (w.matchType === '3-match') prize = prizeBreakdown.tier3Match.individualPrize;

    return {
      userId: w.userId,
      matchType: w.matchType,
      matchCount: w.matchCount,
      prizeAmount: prize,
      entryNumbers: w.entryNumbers,
    };
  });

  return {
    drawId,
    drawMonth,
    winningNumbers,
    eligibleSubscribersCount: eligibleCount,
    winners: evaluatedWinners,
    prizeBreakdown,
  };
}

/**
 * Transitions a draw from simulated to published:
 * Uses the authoritative simulated numbers and stored draw entries without recalculating or regenerating winning numbers.
 */
export async function publishDraw(drawId: string, actorId?: string): Promise<{ success: boolean; winnersCount: number }> {
  const supabase = createAdminClient();

  const { data: draw, error: drawError } = await supabase
    .from('draws')
    .select('*')
    .eq('id', drawId)
    .single();

  if (drawError || !draw) throw new Error('Draw not found');
  if (draw.status !== 'simulated') {
    throw new Error(`Cannot publish a draw with status "${draw.status}". Only simulated draws can be published.`);
  }

  const winningNumbers: number[] = draw.winning_numbers || [];
  if (winningNumbers.length !== 5) {
    throw new Error('Draw does not have valid 5 winning numbers. Please simulate first.');
  }

  // Fetch persisted draw entries for this draw
  const { data: entries, error: entriesError } = await supabase
    .from('draw_entries')
    .select('user_id, entry_numbers')
    .eq('draw_id', drawId);

  if (entriesError) throw new Error(`Failed to load draw entries: ${entriesError.message}`);

  const rawWinners: { userId: string; matchType: MatchType; matchCount: number }[] = [];

  for (const entry of (entries || [])) {
    const evaluation = evaluateEntry(entry.entry_numbers || [], winningNumbers);
    if (evaluation.matchType) {
      rawWinners.push({
        userId: entry.user_id,
        matchType: evaluation.matchType,
        matchCount: evaluation.matchCount,
      });
    }
  }

  const tierCounts = {
    '5-match': rawWinners.filter(w => w.matchType === '5-match').length,
    '4-match': rawWinners.filter(w => w.matchType === '4-match').length,
    '3-match': rawWinners.filter(w => w.matchType === '3-match').length,
  };

  const prizeBreakdown = calculatePrizePoolDistribution(Number(draw.total_prize_pool || 10000), tierCounts);

  // Clear previous winners if re-publishing
  await supabase.from('draw_winners').delete().eq('draw_id', drawId);

  if (rawWinners.length > 0) {
    const winnerRecords = rawWinners.map(w => {
      let prize = 0;
      if (w.matchType === '5-match') prize = prizeBreakdown.tier5Match.individualPrize;
      else if (w.matchType === '4-match') prize = prizeBreakdown.tier4Match.individualPrize;
      else if (w.matchType === '3-match') prize = prizeBreakdown.tier3Match.individualPrize;

      return {
        draw_id: drawId,
        user_id: w.userId,
        match_type: w.matchType,
        prize_amount: prize,
        verification_status: 'pending',
        payout_status: 'pending',
      };
    });

    const { error: insertError } = await supabase
      .from('draw_winners')
      .insert(winnerRecords);

    if (insertError) throw new Error(`Failed to record winners: ${insertError.message}`);
  }

  // Update draw status to published and persist rollover amount
  await supabase
    .from('draws')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      rollover_amount: prizeBreakdown.rolloverAmount,
    })
    .eq('id', drawId);

  await logAdminAction({
    actorId,
    action: 'PUBLISH_DRAW',
    targetType: 'draws',
    targetId: drawId,
    details: {
      drawMonth: draw.draw_month,
      winnersCount: rawWinners.length,
      prizePool: draw.total_prize_pool,
    },
  });

  return { success: true, winnersCount: rawWinners.length };
}

/**
 * Locks a draw, making it completely immutable
 */
export async function lockDraw(drawId: string, actorId?: string): Promise<{ success: boolean }> {
  const supabase = createAdminClient();

  const { data: draw, error } = await supabase
    .from('draws')
    .select('*')
    .eq('id', drawId)
    .single();

  if (error || !draw) throw new Error('Draw not found');
  if (draw.status !== 'published') {
    throw new Error(`Cannot lock a draw with status "${draw.status}". Only published draws can be locked.`);
  }

  await supabase
    .from('draws')
    .update({ status: 'locked' })
    .eq('id', drawId);

  await logAdminAction({
    actorId,
    action: 'LOCK_DRAW',
    targetType: 'draws',
    targetId: drawId,
    details: { drawMonth: draw.draw_month },
  });

  return { success: true };
}
