import { describe, it, expect } from 'vitest';
import {
  validateScoreInput,
  validateCheckoutInput,
  validateDonationInput,
  validateCharityInput,
  validateWinnerUpdateInput,
  validateDrawActionInput,
  isValidUuid,
  validateProofUrl,
} from '../lib/validations';

describe('Validation Suite: Score Submissions', () => {
  it('should accept valid Stableford scores and past dates', () => {
    const res = validateScoreInput({ score: 36, date_played: '2026-08-01' });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ score: 36, date_played: '2026-08-01' });
  });

  it('should reject non-integer scores and strings', () => {
    const res1 = validateScoreInput({ score: 'hello', date_played: '2026-08-01' });
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('valid integer');

    const res2 = validateScoreInput({ score: 35.5, date_played: '2026-08-01' });
    expect(res2.success).toBe(false);
  });

  it('should reject scores outside the 1–45 range', () => {
    const low = validateScoreInput({ score: 0, date_played: '2026-08-01' });
    expect(low.success).toBe(false);

    const high = validateScoreInput({ score: 46, date_played: '2026-08-01' });
    expect(high.success).toBe(false);
  });

  it('should reject future dates', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const dateStr = futureDate.toISOString().split('T')[0];

    const res = validateScoreInput({ score: 38, date_played: dateStr });
    expect(res.success).toBe(false);
    expect(res.error).toContain('future');
  });

  it('should reject malformed date formats', () => {
    const res = validateScoreInput({ score: 38, date_played: '01-08-2026' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('YYYY-MM-DD');
  });
});

describe('Validation Suite: Stripe Checkout Plans', () => {
  it('should allow valid plans (monthly, yearly)', () => {
    expect(validateCheckoutInput({ plan: 'monthly' }).success).toBe(true);
    expect(validateCheckoutInput({ plan: 'yearly' }).success).toBe(true);
  });

  it('should reject unpermitted plan identifiers', () => {
    expect(validateCheckoutInput({ plan: 'lifetime' }).success).toBe(false);
    expect(validateCheckoutInput({ plan: '' }).success).toBe(false);
    expect(validateCheckoutInput({}).success).toBe(false);
  });
});

describe('Validation Suite: Independent Donations', () => {
  it('should validate standard charity donations', () => {
    const validUuid = '12345678-1234-1234-1234-123456789abc';
    const res = validateDonationInput({ charity_id: validUuid, amount: 500 });
    expect(res.success).toBe(true);
    expect(res.data?.amount).toBe(500);
  });

  it('should reject invalid UUIDs or negative amounts', () => {
    expect(validateDonationInput({ charity_id: 'invalid-id', amount: 500 }).success).toBe(false);
    expect(validateDonationInput({ charity_id: '12345678-1234-1234-1234-123456789abc', amount: -50 }).success).toBe(false);
    expect(validateDonationInput({ charity_id: '12345678-1234-1234-1234-123456789abc', amount: 5 }).success).toBe(false);
  });
});

describe('Validation Suite: Charity Directory Entries', () => {
  it('should accept valid charity profiles', () => {
    const res = validateCharityInput({
      name: 'Fairway Green Initiative',
      description: 'Promoting biodiversity and ecological stewardship on golf fairways.',
      is_featured: true,
    });
    expect(res.success).toBe(true);
    expect(res.data?.is_featured).toBe(true);
  });

  it('should reject short or blank charity names', () => {
    const res = validateCharityInput({ name: 'A', description: 'Some short desc' });
    expect(res.success).toBe(false);
  });
});

describe('Validation Suite: Winner Status Updates', () => {
  it('should accept valid verification statuses', () => {
    expect(validateWinnerUpdateInput({ verification_status: 'approved' }).success).toBe(true);
    expect(validateWinnerUpdateInput({ payout_status: 'paid' }).success).toBe(true);
  });

  it('should reject arbitrary status strings', () => {
    expect(validateWinnerUpdateInput({ verification_status: 'hacked' }).success).toBe(false);
  });
});

describe('Validation Suite: UUID Validation Helper', () => {
  it('should validate RFC4122 standard UUIDs', () => {
    expect(isValidUuid('12345678-1234-4234-8234-123456789abc')).toBe(true);
    expect(isValidUuid('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(true);
  });

  it('should reject invalid UUID strings and non-strings', () => {
    expect(isValidUuid('invalid-uuid')).toBe(false);
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(12345)).toBe(false);
  });
});

describe('Validation Suite: Admin Draw Actions', () => {
  it('should validate valid simulation actions', () => {
    const res = validateDrawActionInput({
      action: 'simulate',
      drawMonth: '2026-08-01',
      drawLogic: 'algorithmic',
    });
    expect(res.success).toBe(true);
    expect(res.data?.action).toBe('simulate');
    expect(res.data?.drawLogic).toBe('algorithmic');
  });

  it('should normalize YYYY-MM to YYYY-MM-01 for simulation', () => {
    const res = validateDrawActionInput({
      action: 'simulate',
      drawMonth: '2026-08',
      drawLogic: 'random',
    });
    expect(res.success).toBe(true);
    expect(res.data?.drawMonth).toBe('2026-08-01');
  });

  it('should reject invalid drawMonth formats or invalid drawLogic', () => {
    expect(validateDrawActionInput({ action: 'simulate', drawMonth: '08-2026' }).success).toBe(false);
    expect(validateDrawActionInput({ action: 'simulate', drawLogic: 'quantum' }).success).toBe(false);
  });

  it('should require a valid drawId UUID for publish and lock actions', () => {
    const validUuid = '12345678-1234-1234-1234-123456789abc';
    const publishRes = validateDrawActionInput({ action: 'publish', drawId: validUuid });
    expect(publishRes.success).toBe(true);

    const lockRes = validateDrawActionInput({ action: 'lock', drawId: validUuid });
    expect(lockRes.success).toBe(true);

    const invalidRes = validateDrawActionInput({ action: 'publish', drawId: 'not-a-uuid' });
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.error).toContain('UUID');
  });

  it('should reject unsupported actions', () => {
    expect(validateDrawActionInput({ action: 'delete' }).success).toBe(false);
  });
});

describe('Validation Suite: Winner Proof URL Validation', () => {
  it('should accept valid HTTPS image/web URLs', () => {
    expect(validateProofUrl('https://example.com/scorecards/aug2026.png').success).toBe(true);
    expect(validateProofUrl('https://storage.googleapis.com/proofs/card-123.jpg').success).toBe(true);
  });

  it('should accept HTTP URLs in development/testing', () => {
    expect(validateProofUrl('http://localhost:3000/proofs/test.png').success).toBe(true);
  });

  it('should reject non-HTTP/HTTPS protocols and dangerous schemas', () => {
    expect(validateProofUrl('javascript:alert(1)').success).toBe(false);
    expect(validateProofUrl('data:text/html,<script>alert(1)</script>').success).toBe(false);
    expect(validateProofUrl('ftp://files.example.com/proof.png').success).toBe(false);
  });

  it('should reject non-string and empty inputs', () => {
    expect(validateProofUrl('').success).toBe(false);
    expect(validateProofUrl('   ').success).toBe(false);
    expect(validateProofUrl(null).success).toBe(false);
    expect(validateProofUrl(12345).success).toBe(false);
  });
});
