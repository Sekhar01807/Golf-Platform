import { z } from 'zod';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * Comprehensive Zod Validation Schemas & Type Inferences
 * Validates scores, plans, donations, charities, proof URLs, and draw actions.
 * ══════════════════════════════════════════════════════════════════════════════
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── UUID Helper & Schema ──
export const UuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'A valid UUID is required',
  });

export function isValidUuid(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  return UuidSchema.safeParse(id).success;
}

// ── Score Validation ──
export const ScoreSchema = z
  .object({
    score: z.preprocess(
      (val) => (typeof val === 'string' ? Number(val) : val),
      z
        .number({ invalid_type_error: 'Score must be a valid integer' })
        .int({ message: 'Score must be a valid integer' })
        .min(1, { message: 'Stableford score must be between 1 and 45' })
        .max(45, { message: 'Stableford score must be between 1 and 45' })
    ),
    date_played: z
      .string({ invalid_type_error: 'Date played must be in YYYY-MM-DD format' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date played must be in YYYY-MM-DD format' })
      .refine(
        (val) => {
          const parsed = new Date(val);
          return !Number.isNaN(parsed.getTime());
        },
        { message: 'Invalid date provided' }
      )
      .refine(
        (val) => {
          const parsed = new Date(val);
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          return parsed <= today;
        },
        { message: 'Date played cannot be in the future' }
      )
      .refine(
        (val) => {
          const parsed = new Date(val);
          const minDate = new Date();
          minDate.setFullYear(minDate.getFullYear() - 2);
          return parsed >= minDate;
        },
        { message: 'Date played cannot be older than 2 years' }
      ),
  });

export type ScoreInput = z.infer<typeof ScoreSchema>;

export function validateScoreInput(input: unknown): ValidationResult<ScoreInput> {
  const result = ScoreSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.errors[0]?.message || 'Invalid score input' };
  }
  return { success: true, data: result.data };
}

// ── Checkout Plan Validation ──
export const CheckoutSchema = z.object({
  plan: z.enum(['monthly', 'yearly'], {
    errorMap: () => ({ message: 'Subscription plan must be either "monthly" or "yearly"' }),
  }),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

export function validateCheckoutInput(input: unknown): ValidationResult<CheckoutInput> {
  const result = CheckoutSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.errors[0]?.message || 'Invalid checkout payload' };
  }
  return { success: true, data: result.data };
}

// ── Donation Validation ──
export const DonationSchema = z.object({
  charity_id: UuidSchema.refine((val) => val.length > 0, { message: 'A valid charity UUID is required' }),
  amount: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z
      .number({ invalid_type_error: 'Donation amount must be a valid number' })
      .min(10, { message: 'Donation amount must be at least ₹10' })
      .max(1000000, { message: 'Donation amount exceeds maximum allowed limit' })
      .transform(Math.round)
  ),
});

export type DonationInput = z.infer<typeof DonationSchema>;

export function validateDonationInput(input: unknown): ValidationResult<DonationInput> {
  const result = DonationSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.errors[0]?.message || 'Invalid donation payload' };
  }
  return { success: true, data: result.data };
}

// ── Charity Input Validation ──
export const CharitySchema = z.object({
  name: z
    .string({ invalid_type_error: 'Charity name must be a string' })
    .transform((s) => s.trim())
    .refine((s) => s.length >= 2 && s.length <= 100, {
      message: 'Charity name must be between 2 and 100 characters',
    }),
  description: z
    .string({ invalid_type_error: 'Charity description must be a string' })
    .transform((s) => s.trim())
    .refine((s) => s.length >= 10, {
      message: 'Charity description must be at least 10 characters',
    }),
  is_featured: z.boolean().optional().default(false),
  upcoming_events: z
    .string()
    .nullable()
    .optional()
    .transform((s) => (s ? s.trim() : null)),
});

export type CharityInput = z.infer<typeof CharitySchema>;

export function validateCharityInput(input: unknown): ValidationResult<CharityInput> {
  const result = CharitySchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.errors[0]?.message || 'Invalid charity payload' };
  }
  return { success: true, data: result.data };
}

// ── Scorecard Proof URL Validation ──
export const ProofUrlSchema = z
  .string({ invalid_type_error: 'A scorecard proof URL is required' })
  .transform((s) => s.trim())
  .refine((s) => s.length > 0, { message: 'A scorecard proof URL is required' })
  .refine((s) => s.length <= 500, {
    message: 'Proof URL exceeds maximum allowed length of 500 characters',
  })
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Proof URL must use HTTP or HTTPS protocol' }
  );

export function validateProofUrl(url: unknown): ValidationResult<string> {
  const result = ProofUrlSchema.safeParse(url);
  if (!result.success) {
    return { success: false, error: result.error.errors[0]?.message || 'Invalid proof URL provided' };
  }
  return { success: true, data: result.data };
}

// ── Winner Verification / Payout Validation ──
export const WinnerStatusUpdateSchema = z
  .object({
    verification_status: z.enum(['approved', 'rejected', 'pending'], {
      errorMap: () => ({ message: 'Invalid verification status' }),
    }).optional(),
    payout_status: z.enum(['pending', 'paid'], {
      errorMap: () => ({ message: 'Invalid payout status' }),
    }).optional(),
  })
  .refine((data) => data.verification_status !== undefined || data.payout_status !== undefined, {
    message: 'Must provide either verification_status or payout_status',
  });

export type WinnerStatusUpdateInput = z.infer<typeof WinnerStatusUpdateSchema>;

export function validateWinnerUpdateInput(input: unknown): ValidationResult<WinnerStatusUpdateInput> {
  const result = WinnerStatusUpdateSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.errors[0]?.message || 'Invalid winner update payload' };
  }
  return { success: true, data: result.data };
}

// ── Admin Draw Action Validation ──
export const DrawActionSchema = z
  .object({
    action: z.enum(['simulate', 'publish', 'lock'], {
      errorMap: () => ({ message: 'Invalid action: Must be "simulate", "publish", or "lock"' }),
    }),
    drawMonth: z.string().optional(),
    drawLogic: z.enum(['random', 'algorithmic'], {
      errorMap: () => ({ message: 'drawLogic must be either "random" or "algorithmic"' }),
    }).optional(),
    drawId: z.string().optional(),
    forceRegenerate: z.boolean().optional(),
    entropySeed: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'simulate') {
      let monthStr = data.drawMonth;
      if (!monthStr) {
        monthStr = new Date().toISOString().slice(0, 7) + '-01';
      }

      if (/^\d{4}-\d{2}$/.test(monthStr)) {
        monthStr = `${monthStr}-01`;
      }

      if (!/^\d{4}-\d{2}-01$/.test(monthStr)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'drawMonth must be in YYYY-MM-01 format',
          path: ['drawMonth'],
        });
        return;
      }

      const parsed = new Date(monthStr);
      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid drawMonth date provided',
          path: ['drawMonth'],
        });
        return;
      }
    }

    if (data.action === 'publish' || data.action === 'lock') {
      if (!data.drawId || !isValidUuid(data.drawId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `A valid drawId UUID is required to ${data.action} a draw`,
          path: ['drawId'],
        });
      }
    }
  });

export type DrawActionInput = z.infer<typeof DrawActionSchema>;

export function validateDrawActionInput(input: unknown): ValidationResult<DrawActionInput> {
  const result = DrawActionSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.errors[0]?.message || 'Invalid draw action payload' };
  }

  const data = result.data;
  if (data.action === 'simulate') {
    let monthStr = data.drawMonth || new Date().toISOString().slice(0, 7) + '-01';
    if (/^\d{4}-\d{2}$/.test(monthStr)) {
      monthStr = `${monthStr}-01`;
    }
    return {
      success: true,
      data: {
        action: 'simulate',
        drawMonth: monthStr,
        drawLogic: data.drawLogic || 'random',
        forceRegenerate: Boolean(data.forceRegenerate),
        entropySeed: data.entropySeed?.trim() || undefined,
      },
    };
  }

  return {
    success: true,
    data: {
      action: data.action,
      drawId: data.drawId,
    },
  };
}
