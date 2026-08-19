import { describe, it, expect } from 'vitest';
import {
  generateWinningNumbers,
  generateAlgorithmicWinningNumbers,
  evaluateEntry,
  calculatePrizePoolDistribution,
} from '../lib/services/draw.service';

describe('Draw Engine: Winning Number Generator (CSPRNG & Algorithmic)', () => {
  it('should generate exactly 5 numbers within 1–45 using CSPRNG', () => {
    const winningNumbers = generateWinningNumbers();
    expect(winningNumbers).toHaveLength(5);
    winningNumbers.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(45);
      expect(Number.isInteger(n)).toBe(true);
    });
  });

  it('should generate distinct numbers with no duplicates in ascending order', () => {
    for (let run = 0; run < 20; run++) {
      const numbers = generateWinningNumbers();
      const uniqueSet = new Set(numbers);
      expect(uniqueSet.size).toBe(5);

      const sorted = [...numbers].sort((a, b) => a - b);
      expect(numbers).toEqual(sorted);
    }
  });

  it('should deterministically generate repeatable, distinct winning numbers when using algorithmic mode', () => {
    const month = '2026-08-01';
    const draw1 = generateAlgorithmicWinningNumbers(month, 'seed_key');
    const draw2 = generateAlgorithmicWinningNumbers(month, 'seed_key');
    const drawOtherMonth = generateAlgorithmicWinningNumbers('2026-09-01', 'seed_key');

    expect(draw1).toEqual(draw2);
    expect(new Set(draw1).size).toBe(5);
    expect(draw1).not.toEqual(drawOtherMonth);
  });
});

describe('Draw Engine: Entry Match Tier Evaluator', () => {
  const winningNumbers = [7, 14, 21, 28, 35];

  it('should detect a 5-match jackpot tier for distinct matching numbers', () => {
    const entry = [7, 14, 21, 28, 35];
    const res = evaluateEntry(entry, winningNumbers);
    expect(res.matchCount).toBe(5);
    expect(res.matchType).toBe('5-match');
  });

  it('should prevent duplicate entry scores from multiplying match count (anti-inflation)', () => {
    // A player logged identical score 7 five times
    const duplicateEntryAllSame = [7, 7, 7, 7, 7];
    const resAllSame = evaluateEntry(duplicateEntryAllSame, winningNumbers);
    expect(resAllSame.matchCount).toBe(1);
    expect(resAllSame.matchType).toBeNull();

    // A player logged [7, 7, 14, 21, 40]: matches 7, 14, 21 (3 matches), not 4 matches
    const duplicateEntry = [7, 7, 14, 21, 40];
    const resDuplicate = evaluateEntry(duplicateEntry, winningNumbers);
    expect(resDuplicate.matchCount).toBe(3);
    expect(resDuplicate.matchType).toBe('3-match');
  });

  it('should detect a 4-match tier', () => {
    const entry = [7, 14, 21, 28, 40];
    const res = evaluateEntry(entry, winningNumbers);
    expect(res.matchCount).toBe(4);
    expect(res.matchType).toBe('4-match');
  });

  it('should detect a 3-match tier', () => {
    const entry = [7, 14, 21, 39, 44];
    const res = evaluateEntry(entry, winningNumbers);
    expect(res.matchCount).toBe(3);
    expect(res.matchType).toBe('3-match');
  });

  it('should return null for fewer than 3 matches', () => {
    const entry1 = [7, 14, 30, 39, 44]; // 2 matches
    expect(evaluateEntry(entry1, winningNumbers).matchType).toBeNull();

    const entry2 = [1, 2, 3, 4, 5]; // 0 matches
    expect(evaluateEntry(entry2, winningNumbers).matchType).toBeNull();
  });
});

describe('Draw Engine: Mathematical Prize Pool Distribution', () => {
  it('should allocate 40% to Jackpot (5-match), 35% to 4-match, 25% to 3-match', () => {
    const totalPool = 100000;
    const tierCounts = {
      '5-match': 1,
      '4-match': 2,
      '3-match': 5,
    };

    const breakdown = calculatePrizePoolDistribution(totalPool, tierCounts);

    expect(breakdown.tier5Match.poolShare).toBe(40000);
    expect(breakdown.tier5Match.individualPrize).toBe(40000);

    expect(breakdown.tier4Match.poolShare).toBe(35000);
    expect(breakdown.tier4Match.individualPrize).toBe(17500); // 35000 / 2

    expect(breakdown.tier3Match.poolShare).toBe(25000);
    expect(breakdown.tier3Match.individualPrize).toBe(5000); // 25000 / 5

    expect(breakdown.totalDistributed).toBe(100000);
    expect(breakdown.rolloverAmount).toBe(0);
  });

  it('should calculate rollover pool when a tier has zero winners', () => {
    const totalPool = 100000;
    const tierCounts = {
      '5-match': 0, // Jackpot rollover
      '4-match': 1,
      '3-match': 2,
    };

    const breakdown = calculatePrizePoolDistribution(totalPool, tierCounts);

    expect(breakdown.tier5Match.count).toBe(0);
    expect(breakdown.tier5Match.individualPrize).toBe(0);
    expect(breakdown.rolloverAmount).toBe(40000);
    expect(breakdown.totalDistributed + breakdown.rolloverAmount).toBe(totalPool);
  });

  it('should explicitly conserve integer division residuals into the rollover amount', () => {
    // 3 winners in 5-match tier: 40000 / 3 = 13333 each -> 39999 distributed, 1 residual
    // 3 winners in 4-match tier: 35000 / 3 = 11666 each -> 34998 distributed, 2 residual
    // 3 winners in 3-match tier: 25000 / 3 = 8333 each -> 24999 distributed, 1 residual
    const totalPool = 100000;
    const tierCounts = {
      '5-match': 3,
      '4-match': 3,
      '3-match': 3,
    };

    const breakdown = calculatePrizePoolDistribution(totalPool, tierCounts);

    expect(breakdown.tier5Match.individualPrize).toBe(13333.33);
    expect(breakdown.tier4Match.individualPrize).toBe(11666.66);
    expect(breakdown.tier3Match.individualPrize).toBe(8333.33);

    const totalDistributed = Number(((3 * 13333.33) + (3 * 11666.66) + (3 * 8333.33)).toFixed(2)); // 39999.99 + 34999.98 + 24999.99 = 99999.96
    expect(breakdown.totalDistributed).toBe(totalDistributed);
    expect(breakdown.rolloverAmount).toBe(0.04); // Residuals conserved: 100000 - 99999.96 = 0.04

    // Conservation invariant: Total Distributed + Rollover ALWAYS equals Total Prize Pool
    expect(Number((breakdown.totalDistributed + breakdown.rolloverAmount).toFixed(2))).toBe(totalPool);
  });

  it('should maintain exact mathematical conservation without floating point precision drift', () => {
    // Test with fractional pool amounts
    const totalPool = 12345.67;
    const tierCounts = {
      '5-match': 2,
      '4-match': 3,
      '3-match': 7,
    };

    const breakdown = calculatePrizePoolDistribution(totalPool, tierCounts);
    const sum = Number((breakdown.totalDistributed + breakdown.rolloverAmount).toFixed(2));
    expect(sum).toBe(12345.67);
  });
});
