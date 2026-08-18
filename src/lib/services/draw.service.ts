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

export interface SimulateDrawOptions {
  forceRegenerate?: boolean;
  entropySeed?: string;
  actorId?: string;
}

/**
 * Converts a major currency unit (e.g. ₹ or $) to integer minor currency units (paise/cents).
 */
export function toCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

/**
 * Converts integer minor currency units (paise/cents) back to a standard currency number.
 */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
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
 * Deterministically generates 5 distinct winning numbers derived from a verifiable SHA-256 hash digest.
 * NOTE: This is a deterministic, reproducible verification mechanism for audit and demo purposes.
 * It is not an independent or unpredictable lottery draw; use CSPRNG (generateWinningNumbers) for live randomized draws.
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
 * Calculates mathematical prize breakdown and per-winner distributions using exact integer cents arithmetic:
 * 5-match: 40% (Jackpot)
 * 4-match: 35%
 * 3-match: 25%
 * Explicitly conserves all division residuals and unawarded tier shares into the rollover pool with zero float drift.
 */
export function calculatePrizePoolDistribution(
  totalPrizePool: number,
  tierCounts: { '5-match': number; '4-match': number; '3-match': number }
): PrizeBreakdown {
  const poolCents = toCents(totalPrizePool);
  const pool5Cents = Math.round(poolCents * 0.40);
  const pool4Cents = Math.round(poolCents * 0.35);
  const pool3Cents = Math.round(poolCents * 0.25);

  const count5 = tierCounts['5-match'];
  const count4 = tierCounts['4-match'];
  const count3 = tierCounts['3-match'];

  const prize5Cents = count5 > 0 ? Math.floor(pool5Cents / count5) : 0;
  const prize4Cents = count4 > 0 ? Math.floor(pool4Cents / count4) : 0;
  const prize3Cents = count3 > 0 ? Math.floor(pool3Cents / count3) : 0;

  const distributed5Cents = count5 * prize5Cents;
  const distributed4Cents = count4 * prize4Cents;
  const distributed3Cents = count3 * prize3Cents;
  const totalDistributedCents = distributed5Cents + distributed4Cents + distributed3Cents;

  // Mathematically conserved in exact cents: any unawarded pools + integer division residuals roll over
  const rolloverCents = Math.max(poolCents - totalDistributedCents, 0);

  return {
    tier5Match: { count: count5, poolShare: fromCents(pool5Cents), individualPrize: fromCents(prize5Cents) },
    tier4Match: { count: count4, poolShare: fromCents(pool4Cents), individualPrize: fromCents(prize4Cents) },
    tier3Match: { count: count3, poolShare: fromCents(pool3Cents), individualPrize: fromCents(prize3Cents) },
    totalPrizePool: fromCents(poolCents),
    totalDistributed: fromCents(totalDistributedCents),
    rolloverAmount: fromCents(rolloverCents),
  };
}

/**
 * Simulates a monthly draw:
 * 1. Collects active subscribers who have logged exactly 5 scores (strictly eligible).
 * 2. Carries forward any unawarded rollover from the previous published/locked draw.
 * 3. Enforces simulation immutability unless forceRegenerate is explicitly requested.
 * 4. Generates verified winning numbers.
 * 5. Evaluates entries and allocates tier prizes.
 * 6. Emits a fail-closed audit log record.
 */
export async function simulateMonthlyDraw(
  drawMonth: string,
  drawLogic: 'random' | 'algorithmic' = 'random',
  options: SimulateDrawOptions = {}
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
  let isRegeneration = false;

  const seed = options.entropySeed || 'golf_charity_draw_seed';

  if (existingDraw) {
    if (existingDraw.status === 'published' || existingDraw.status === 'locked') {
      throw new Error(`Cannot simulate a draw that is already ${existingDraw.status}.`);
    }

    if (!options.forceRegenerate) {
      throw new Error(`A simulated draw already exists for ${drawMonth}. Set forceRegenerate to true to intentionally re-calculate winning numbers.`);
    }

    isRegeneration = true;
    winningNumbers = drawLogic === 'algorithmic'
      ? generateAlgorithmicWinningNumbers(drawMonth, seed)
      : generateWinningNumbers();

    const { error: updateError } = await supabase
      .from('draws')
      .update({
        winning_numbers: winningNumbers,
        total_prize_pool: basePrizePool,
        draw_logic: drawLogic,
      })
      .eq('id', drawId);

    if (updateError) throw new Error(`Failed to update simulated draw: ${updateError.message}`);
  } else {
    winningNumbers = drawLogic === 'algorithmic'
      ? generateAlgorithmicWinningNumbers(drawMonth, seed)
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

    if (createError || !newDraw) throw new Error(`Failed to create draw: ${createError?.message || 'Unknown creation error'}`);
    drawId = newDraw.id;
  }

  // 2. Evaluate only strictly eligible members (must have 5 logged rounds)
  const rawWinners: { userId: string; matchType: MatchType; matchCount: number; entryNumbers: number[] }[] = [];
  let eligibleCount = 0;

  for (const user of activeUsers) {
    const { data: scores, error: scoresError } = await supabase
      .from('golf_scores')
      .select('score')
      .eq('user_id', user.id)
      .order('date_played', { ascending: false })
      .limit(5);

    if (scoresError) throw new Error(`Failed to retrieve scores for user ${user.id}: ${scoresError.message}`);

    // Business Rule: Member must have logged 5 valid scores to be entered into the draw
    if (!scores || scores.length < 5) {
      continue;
    }

    eligibleCount++;
    const entryNumbers: number[] = scores.map(s => s.score);

    // Upsert draw entry with strict error checking
    const { error: entryError } = await supabase.from('draw_entries').upsert({
      draw_id: drawId,
      user_id: user.id,
      entry_numbers: entryNumbers,
    }, { onConflict: 'draw_id,user_id' });

    if (entryError) throw new Error(`Failed to record draw entry: ${entryError.message}`);

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

  // 3. Calculate prize allocations with integer cents conservation
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

  // 4. Fail-closed audit logging
  await logAdminAction({
    actorId: options.actorId,
    action: isRegeneration ? 'RESET_SIMULATED_DRAW' : 'SIMULATE_DRAW',
    targetType: 'draws',
    targetId: drawId,
    details: {
      drawMonth,
      drawLogic,
      winningNumbers,
      eligibleSubscribersCount: eligibleCount,
      prizePool: basePrizePool,
      winnersCount: evaluatedWinners.length,
      rolloverAmount: prizeBreakdown.rolloverAmount,
      isRegeneration,
    },
    failClosed: true,
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
 * Transitions a draw from simulated to published in a single atomic database transaction:
 * Uses publish_draw_atomic RPC to lock the draw, record winners, update draw state, persist rollover, and log the audit entry.
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
    throw new Error('Draw does not have valid 5 winning numbers');
  }

  // Load entries and evaluate winners
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

  const winnerRecords = rawWinners.map(w => {
    let prize = 0;
    if (w.matchType === '5-match') prize = prizeBreakdown.tier5Match.individualPrize;
    else if (w.matchType === '4-match') prize = prizeBreakdown.tier4Match.individualPrize;
    else if (w.matchType === '3-match') prize = prizeBreakdown.tier3Match.individualPrize;

    return {
      user_id: w.userId,
      match_type: w.matchType,
      prize_amount: prize,
    };
  });

  // Execute atomic single-transaction publish via PostgreSQL RPC
  const { error: publishError } = await supabase.rpc('publish_draw_atomic', {
    p_draw_id: drawId,
    p_winners: winnerRecords,
    p_rollover: prizeBreakdown.rolloverAmount,
    p_actor_id: actorId || null,
  });

  if (publishError) {
    throw new Error(`Atomic draw publication failed: ${publishError.message}`);
  }

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

  const { error: lockError } = await supabase
    .from('draws')
    .update({ status: 'locked' })
    .eq('id', drawId);

  if (lockError) throw new Error(`Failed to lock draw: ${lockError.message}`);

  await logAdminAction({
    actorId,
    action: 'LOCK_DRAW',
    targetType: 'draws',
    targetId: drawId,
    details: {
      drawMonth: draw.draw_month,
      prizePool: draw.total_prize_pool,
      rolloverAmount: draw.rollover_amount,
    },
    failClosed: true,
  });

  return { success: true };
}
