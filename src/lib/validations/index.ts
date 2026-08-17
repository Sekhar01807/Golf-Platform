/**
 * Comprehensive Validation Schemas & Pure TypeScript Validation Helpers
 * Validates scores, plans, donations, and administrative requests.
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Score Validation ──
export interface ScoreInput {
  score: number;
  date_played: string;
}

export function validateScoreInput(input: unknown): ValidationResult<ScoreInput> {
  if (!input || typeof input !== 'object') {
    return { success: false, error: 'Invalid payload: JSON object expected' };
  }

  const { score, date_played } = input as Record<string, unknown>;

  const scoreNum = typeof score === 'string' ? Number(score) : score;
  if (typeof scoreNum !== 'number' || !Number.isInteger(scoreNum) || Number.isNaN(scoreNum)) {
    return { success: false, error: 'Score must be a valid integer' };
  }

  if (scoreNum < 1 || scoreNum > 45) {
    return { success: false, error: 'Stableford score must be between 1 and 45' };
  }

  if (typeof date_played !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date_played)) {
    return { success: false, error: 'Date played must be in YYYY-MM-DD format' };
  }

  const parsedDate = new Date(date_played);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, error: 'Invalid date provided' };
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsedDate > today) {
    return { success: false, error: 'Date played cannot be in the future' };
  }

  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 2);
  if (parsedDate < minDate) {
    return { success: false, error: 'Date played cannot be older than 2 years' };
  }

  return {
    success: true,
    data: {
      score: scoreNum,
      date_played,
    },
  };
}

// ── Checkout Plan Validation ──
export interface CheckoutInput {
  plan: 'monthly' | 'yearly';
}

export function validateCheckoutInput(input: unknown): ValidationResult<CheckoutInput> {
  if (!input || typeof input !== 'object') {
    return { success: false, error: 'Invalid payload: JSON object expected' };
  }

  const { plan } = input as Record<string, unknown>;

  if (plan !== 'monthly' && plan !== 'yearly') {
    return { success: false, error: 'Subscription plan must be either "monthly" or "yearly"' };
  }

  return {
    success: true,
    data: { plan },
  };
}

// ── Donation Validation ──
export interface DonationInput {
  charity_id: string;
  amount: number;
}

export function validateDonationInput(input: unknown): ValidationResult<DonationInput> {
  if (!input || typeof input !== 'object') {
    return { success: false, error: 'Invalid payload: JSON object expected' };
  }

  const { charity_id, amount } = input as Record<string, unknown>;

  if (typeof charity_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(charity_id)) {
    return { success: false, error: 'A valid charity UUID is required' };
  }

  const amountNum = typeof amount === 'string' ? Number(amount) : amount;
  if (typeof amountNum !== 'number' || Number.isNaN(amountNum) || amountNum < 10) {
    return { success: false, error: 'Donation amount must be at least ₹10' };
  }

  if (amountNum > 1000000) {
    return { success: false, error: 'Donation amount exceeds maximum allowed limit' };
  }

  return {
    success: true,
    data: {
      charity_id,
      amount: Math.round(amountNum),
    },
  };
}

// ── Charity Input Validation ──
export interface CharityInput {
  name: string;
  description: string;
  is_featured?: boolean;
  upcoming_events?: string | null;
}

export function validateCharityInput(input: unknown): ValidationResult<CharityInput> {
  if (!input || typeof input !== 'object') {
    return { success: false, error: 'Invalid payload: JSON object expected' };
  }

  const { name, description, is_featured, upcoming_events } = input as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return { success: false, error: 'Charity name must be between 2 and 100 characters' };
  }

  if (typeof description !== 'string' || description.trim().length < 10) {
    return { success: false, error: 'Charity description must be at least 10 characters' };
  }

  return {
    success: true,
    data: {
      name: name.trim(),
      description: description.trim(),
      is_featured: Boolean(is_featured),
      upcoming_events: typeof upcoming_events === 'string' ? upcoming_events.trim() : null,
    },
  };
}

// ── Winner Verification / Payout Validation ──
export interface WinnerStatusUpdateInput {
  verification_status?: 'approved' | 'rejected' | 'pending';
  payout_status?: 'pending' | 'paid';
}

export function validateWinnerUpdateInput(input: unknown): ValidationResult<WinnerStatusUpdateInput> {
  if (!input || typeof input !== 'object') {
    return { success: false, error: 'Invalid payload: JSON object expected' };
  }

  const { verification_status, payout_status } = input as Record<string, unknown>;

  if (verification_status && !['approved', 'rejected', 'pending'].includes(verification_status as string)) {
    return { success: false, error: 'Invalid verification status' };
  }

  if (payout_status && !['pending', 'paid'].includes(payout_status as string)) {
    return { success: false, error: 'Invalid payout status' };
  }

  if (!verification_status && !payout_status) {
    return { success: false, error: 'Must provide either verification_status or payout_status' };
  }

  return {
    success: true,
    data: {
      verification_status: verification_status as WinnerStatusUpdateInput['verification_status'],
      payout_status: payout_status as WinnerStatusUpdateInput['payout_status'],
    },
  };
}
