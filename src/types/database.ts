// ── Type Definitions for Supabase Tables ──

export type UserRole = 'user' | 'admin';
export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'lapsed';
export type SubscriptionPlan = 'monthly' | 'yearly';
export type DrawStatus = 'simulated' | 'published' | 'locked';
export type DrawType = 'random' | 'algorithmic';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type PayoutStatus = 'pending' | 'paid';
export type PaymentStatus = 'pending' | 'completed';
export type MatchType = '5-match' | '4-match' | '3-match';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_plan: SubscriptionPlan | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  selected_charity_id: string | null;
  charity_contribution_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface Charity {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  is_featured: boolean;
  upcoming_events: string | null;
  total_contributions: number;
  created_at: string;
}

export interface GolfScore {
  id: string;
  user_id: string;
  score: number; // 1-45 Stableford
  date_played: string;
  created_at: string;
}

export interface Draw {
  id: string;
  draw_month: string;
  status: DrawStatus;
  draw_logic: DrawType;
  winning_numbers: number[];
  total_prize_pool: number;
  created_at: string;
  published_at: string | null;
}

export interface DrawEntry {
  id: string;
  draw_id: string;
  user_id: string;
  entry_numbers: number[];
  created_at: string;
}

export interface DrawWinner {
  id: string;
  draw_id: string;
  user_id: string;
  match_type: MatchType;
  prize_amount: number;
  winner_proof_url: string | null;
  verification_status: VerificationStatus;
  payout_status: PayoutStatus;
  created_at: string;
}

export interface IndependentDonation {
  id: string;
  user_id: string | null;
  charity_id: string;
  amount: number;
  payment_status: PaymentStatus;
  stripe_payment_id: string | null;
  created_at: string;
}

export interface StripeEvent {
  id: string;
  event_type: string;
  processed_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
