-- ═══════════════════════════════════════════════════
-- Golf Charity Subscription Platform
-- Supabase Database Schema (Idempotent Production Schema)
-- ═══════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Custom Types (Idempotent Creation & Safe Enum Synchronization) ──
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'user';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'cancelled', 'lapsed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'inactive';
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'lapsed';

DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'monthly';
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'yearly';

DO $$ BEGIN
  CREATE TYPE draw_status AS ENUM ('simulated', 'published', 'locked');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TYPE draw_status ADD VALUE IF NOT EXISTS 'simulated';
ALTER TYPE draw_status ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE draw_status ADD VALUE IF NOT EXISTS 'locked';

DO $$ BEGIN
  CREATE TYPE draw_type AS ENUM ('random', 'algorithmic');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TYPE draw_type ADD VALUE IF NOT EXISTS 'random';
ALTER TYPE draw_type ADD VALUE IF NOT EXISTS 'algorithmic';

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'rejected';

DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM ('pending', 'paid');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'paid';

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'completed';

DO $$ BEGIN
  CREATE TYPE stripe_event_status AS ENUM ('processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TYPE stripe_event_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE stripe_event_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE stripe_event_status ADD VALUE IF NOT EXISTS 'failed';

-- ═══════════════════════════════════════════════════
-- 2. CHARITIES TABLE (Created first for foreign key bindings)
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.charities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  upcoming_events TEXT,
  total_contributions NUMERIC NOT NULL DEFAULT 0 CHECK (total_contributions >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 3. USERS TABLE (public profile, linked to auth.users)
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'user',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status subscription_status NOT NULL DEFAULT 'inactive',
  subscription_plan subscription_plan,
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  checkout_lock_until TIMESTAMPTZ,
  selected_charity_id UUID REFERENCES public.charities(id) ON DELETE SET NULL,
  charity_contribution_percentage INTEGER NOT NULL DEFAULT 10 CHECK (charity_contribution_percentage >= 10 AND charity_contribution_percentage <= 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure FK constraint exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_charity') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT fk_users_charity
      FOREIGN KEY (selected_charity_id) REFERENCES public.charities(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN null;
END $$;

-- Auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = CASE WHEN public.users.full_name = '' THEN EXCLUDED.full_name ELSE public.users.full_name END,
      updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-synchronize email from Supabase auth.users to public.users profile
CREATE OR REPLACE FUNCTION public.handle_user_email_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users
    SET email = NEW.email,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_sync();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════
-- 4. GOLF SCORES TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.golf_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 45),
  date_played DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_user ON public.golf_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_date ON public.golf_scores(user_id, date_played DESC);

-- ═══════════════════════════════════════════════════
-- 5. DRAWS TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.draws (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_month DATE NOT NULL UNIQUE,
  status draw_status NOT NULL DEFAULT 'simulated',
  draw_logic draw_type NOT NULL DEFAULT 'random',
  winning_numbers INTEGER[] NOT NULL DEFAULT '{}',
  total_prize_pool NUMERIC NOT NULL DEFAULT 0,
  rollover_amount NUMERIC NOT NULL DEFAULT 0 CHECK (rollover_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════
-- 6. DRAW ENTRIES TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.draw_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id UUID NOT NULL REFERENCES public.draws(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_numbers INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(draw_id, user_id)
);

-- ═══════════════════════════════════════════════════
-- 7. DRAW WINNERS TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.draw_winners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id UUID NOT NULL REFERENCES public.draws(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('5-match', '4-match', '3-match')),
  prize_amount NUMERIC NOT NULL DEFAULT 0 CHECK (prize_amount >= 0),
  winner_proof_url TEXT,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  payout_status payout_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(draw_id, user_id),
  CONSTRAINT chk_draw_winners_payout_verified CHECK (payout_status != 'paid' OR verification_status = 'approved'),
  CONSTRAINT chk_draw_winners_proof_url CHECK (winner_proof_url IS NULL OR winner_proof_url ~* '^https?://[^\s/$.?#].[^\s]*$')
);

-- ═══════════════════════════════════════════════════
-- 8. INDEPENDENT DONATIONS TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.independent_donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  charity_id UUID NOT NULL REFERENCES public.charities(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_status payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 9. STRIPE EVENTS (Stateful Webhook Idempotency)
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status stripe_event_status NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════
-- 10. AUDIT LOGS TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ═══════════════════════════════════════════════════
-- 11. SECURITY & TRANSACTIONAL FUNCTIONS / TRIGGERS
-- ═══════════════════════════════════════════════════

-- A. Protect User Protected Columns from Self-Escalation
CREATE OR REPLACE FUNCTION public.protect_user_fields()
RETURNS TRIGGER AS $$
DECLARE
  caller_role user_role;
BEGIN
  -- Service role / postgres superuser bypass
  IF current_user = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Verify if authenticated caller has admin role
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Block modifications to privileged fields by non-admin users
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Privilege escalation blocked: Cannot modify user role.';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Direct update blocked: Email cannot be updated directly on user profile. Please update via Supabase Auth.';
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Direct update blocked: Subscription status is server/Stripe controlled.';
  END IF;
  IF NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan THEN
    RAISE EXCEPTION 'Direct update blocked: Subscription plan is server/Stripe controlled.';
  END IF;
  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'Direct update blocked: Stripe customer ID is server controlled.';
  END IF;
  IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    RAISE EXCEPTION 'Direct update blocked: Stripe subscription ID is server controlled.';
  END IF;
  IF NEW.subscription_end_date IS DISTINCT FROM OLD.subscription_end_date THEN
    RAISE EXCEPTION 'Direct update blocked: Subscription end date is server controlled.';
  END IF;
  IF NEW.subscription_start_date IS DISTINCT FROM OLD.subscription_start_date THEN
    RAISE EXCEPTION 'Direct update blocked: Subscription start date is server controlled.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS protect_user_fields_trigger ON public.users;
CREATE TRIGGER protect_user_fields_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_fields();

-- B. Protect Winner Proofs & Payout Data from User Modification
CREATE OR REPLACE FUNCTION public.protect_draw_winner_fields()
RETURNS TRIGGER AS $$
DECLARE
  caller_role user_role;
BEGIN
  -- Service role bypass
  IF current_user = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    IF NEW.payout_status = 'paid' AND NEW.verification_status != 'approved' THEN
      RAISE EXCEPTION 'Cannot mark payout as paid unless verification status is approved.';
    END IF;
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role = 'admin' THEN
    IF NEW.payout_status = 'paid' AND NEW.verification_status != 'approved' THEN
      RAISE EXCEPTION 'Cannot mark payout as paid unless verification status is approved.';
    END IF;
    RETURN NEW;
  END IF;

  -- Normal user can only update winner_proof_url and ONLY if verification_status is still 'pending'
  IF OLD.verification_status != 'pending' THEN
    RAISE EXCEPTION 'Proof cannot be updated once verification has been reviewed.';
  END IF;

  -- Strictly protect every non-proof field against mutation
  IF NEW.id IS DISTINCT FROM OLD.id OR
     NEW.draw_id IS DISTINCT FROM OLD.draw_id OR
     NEW.user_id IS DISTINCT FROM OLD.user_id OR
     NEW.match_type IS DISTINCT FROM OLD.match_type OR
     NEW.prize_amount IS DISTINCT FROM OLD.prize_amount OR
     NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
     NEW.payout_status IS DISTINCT FROM OLD.payout_status OR
     NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Unauthorized: Users can only upload winner proof URLs. All other fields are immutable.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS protect_draw_winner_fields_trigger ON public.draw_winners;
CREATE TRIGGER protect_draw_winner_fields_trigger
  BEFORE UPDATE ON public.draw_winners
  FOR EACH ROW EXECUTE FUNCTION public.protect_draw_winner_fields();

-- Protect Charity total_contributions from manual client mutation
CREATE OR REPLACE FUNCTION public.protect_charity_contributions()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role / internal RPC bypass
  IF current_user = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.total_contributions IS DISTINCT FROM OLD.total_contributions THEN
    RAISE EXCEPTION 'Direct update blocked: Charity total_contributions is ledger-calculated and restricted to service_role.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS protect_charity_contributions_trigger ON public.charities;
CREATE TRIGGER protect_charity_contributions_trigger
  BEFORE UPDATE ON public.charities
  FOR EACH ROW EXECUTE FUNCTION public.protect_charity_contributions();

-- C. Atomic Subscription Checkout Claim (Concurrency Race Condition Guard)
CREATE OR REPLACE FUNCTION public.claim_checkout_lock(
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- Row-lock user to serialize concurrent checkout attempts
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  IF v_user.subscription_status = 'active' THEN
    RAISE EXCEPTION 'User already has an active subscription.';
  END IF;

  IF v_user.checkout_lock_until IS NOT NULL AND v_user.checkout_lock_until > now() THEN
    RAISE EXCEPTION 'A checkout session is already in progress. Please complete your payment or try again in a few minutes.';
  END IF;

  -- Claim 5-minute atomic lock
  UPDATE public.users
  SET checkout_lock_until = now() + INTERVAL '5 minutes'
  WHERE id = p_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- D. Enforce 5-Score Maximum Transactionally via FIFO RPC
CREATE OR REPLACE FUNCTION public.add_golf_score(
  p_user_id UUID,
  p_score INT,
  p_date_played DATE
)
RETURNS UUID AS $$
DECLARE
  v_score_id UUID;
  v_count INT;
  v_caller_role user_role;
  v_sub_status subscription_status;
BEGIN
  -- 1. Pessimistic Row Lock: Serializes concurrent score additions for this user
  PERFORM id FROM public.users WHERE id = p_user_id FOR UPDATE;

  -- 2. Caller identity boundary: caller must be authenticated and match target user or have admin/service privileges
  IF current_user != 'service_role' AND current_setting('request.jwt.claim.role', true) != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF auth.uid() != p_user_id THEN
      SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
      IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Caller identity does not match score owner.';
      END IF;
    END IF;
  END IF;

  -- 3. Validate user existence
  SELECT subscription_status INTO v_sub_status FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  IF p_score < 1 OR p_score > 45 THEN
    RAISE EXCEPTION 'Score must be between 1 and 45 (Stableford format)';
  END IF;

  IF p_date_played > CURRENT_DATE THEN
    RAISE EXCEPTION 'Date played cannot be in the future';
  END IF;

  IF p_date_played < CURRENT_DATE - INTERVAL '2 years' THEN
    RAISE EXCEPTION 'Date played cannot be older than 2 years';
  END IF;

  -- 4. Count existing scores under transaction lock
  SELECT COUNT(*) INTO v_count FROM public.golf_scores WHERE user_id = p_user_id;

  -- 5. If 5 or more scores exist, purge the oldest to maintain strict 5-score limit
  IF v_count >= 5 THEN
    DELETE FROM public.golf_scores
    WHERE id IN (
      SELECT id FROM public.golf_scores
      WHERE user_id = p_user_id
      ORDER BY date_played ASC, created_at ASC
      LIMIT (v_count - 4)
    );
  END IF;

  INSERT INTO public.golf_scores (user_id, score, date_played)
  VALUES (p_user_id, p_score, p_date_played)
  RETURNING id INTO v_score_id;

  RETURN v_score_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- E. Atomic Single-Transaction Draw Publication (ACID Invariant)
CREATE OR REPLACE FUNCTION public.publish_draw_atomic(
  p_draw_id UUID,
  p_winners JSONB,
  p_rollover NUMERIC,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_draw RECORD;
  v_winner JSONB;
BEGIN
  -- Lock the draw row for update
  SELECT * INTO v_draw FROM public.draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draw % not found.', p_draw_id;
  END IF;
  IF v_draw.status != 'simulated' THEN
    RAISE EXCEPTION 'Illegal transition: Only simulated draws can be published. Current status: %', v_draw.status;
  END IF;

  -- 1. Update the draw status and rollover amount
  UPDATE public.draws
  SET status = 'published',
      rollover_amount = p_rollover,
      published_at = now()
  WHERE id = p_draw_id;

  -- 2. Clear any pre-existing winner records for this draw
  DELETE FROM public.draw_winners WHERE draw_id = p_draw_id;

  -- 3. Bulk insert winner records atomically from JSON array
  IF p_winners IS NOT NULL AND jsonb_array_length(p_winners) > 0 THEN
    FOR v_winner IN SELECT * FROM jsonb_array_elements(p_winners)
    LOOP
      INSERT INTO public.draw_winners (
        draw_id,
        user_id,
        match_type,
        prize_amount,
        verification_status,
        payout_status
      ) VALUES (
        p_draw_id,
        (v_winner->>'user_id')::UUID,
        v_winner->>'match_type',
        (v_winner->>'prize_amount')::NUMERIC,
        'pending',
        'pending'
      );
    END LOOP;
  END IF;

  -- 4. Audit Log entry
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, details)
  VALUES (
    p_actor_id,
    'PUBLISH_DRAW_ATOMIC',
    'draws',
    p_draw_id::TEXT,
    jsonb_build_object(
      'draw_month', v_draw.draw_month,
      'rollover_amount', p_rollover,
      'winner_count', COALESCE(jsonb_array_length(p_winners), 0)
    )
  );

  RETURN jsonb_build_object('success', true, 'draw_id', p_draw_id, 'status', 'published');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- F. Atomic Donation Ledger Update (Service-Role Boundary Restricted & Idempotent)
CREATE OR REPLACE FUNCTION public.record_completed_donation(
  p_user_id UUID,
  p_charity_id UUID,
  p_amount NUMERIC,
  p_stripe_payment_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_donation_id UUID;
BEGIN
  -- Verify caller identity: strictly restricted to service_role / webhook background execution
  IF current_user != 'service_role' AND current_setting('request.jwt.claim.role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: record_completed_donation is restricted to service_role execution.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Donation amount must be greater than 0';
  END IF;

  -- Idempotency guard: If this Stripe payment was already recorded, return existing ID without double-incrementing
  IF p_stripe_payment_id IS NOT NULL THEN
    SELECT id INTO v_donation_id
    FROM public.independent_donations
    WHERE stripe_payment_id = p_stripe_payment_id;

    IF FOUND THEN
      RETURN v_donation_id;
    END IF;
  END IF;

  INSERT INTO public.independent_donations (user_id, charity_id, amount, payment_status, stripe_payment_id)
  VALUES (p_user_id, p_charity_id, p_amount, 'completed', p_stripe_payment_id)
  RETURNING id INTO v_donation_id;

  -- Atomically increment charity total contributions
  UPDATE public.charities
  SET total_contributions = total_contributions + p_amount
  WHERE id = p_charity_id;

  RETURN v_donation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- G. Stateful Stripe Webhook Idempotency Functions
CREATE OR REPLACE FUNCTION public.claim_stripe_event(
  p_event_id TEXT,
  p_event_type TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_existing RECORD;
BEGIN
  -- Verify caller identity: strictly restricted to service_role / webhook background execution
  IF current_user != 'service_role' AND current_setting('request.jwt.claim.role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: claim_stripe_event is restricted to service_role execution.';
  END IF;

  SELECT * INTO v_existing FROM public.stripe_events WHERE id = p_event_id FOR UPDATE;

  IF FOUND THEN
    -- 1. If already completed, it is an idempotent duplicate
    IF v_existing.status = 'completed' THEN
      RETURN 'DUPLICATE_COMPLETED';
    END IF;

    -- 2. If in-flight processing within the last 300 seconds (5 minutes), prevent concurrent execution
    IF v_existing.status = 'processing' AND v_existing.created_at > (now() - INTERVAL '300 seconds') THEN
      RETURN 'IN_FLIGHT';
    END IF;

    -- 3. If previous attempt failed or timed out (> 300s), re-claim for retry
    UPDATE public.stripe_events
    SET status = 'processing',
        created_at = now()
    WHERE id = p_event_id;

    RETURN 'CLAIMED';
  ELSE
    -- Fresh event: insert as processing
    INSERT INTO public.stripe_events (id, event_type, status, created_at)
    VALUES (p_event_id, p_event_type, 'processing', now());

    RETURN 'CLAIMED';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.complete_stripe_event(
  p_event_id TEXT
)
RETURNS VOID AS $$
BEGIN
  IF current_user != 'service_role' AND current_setting('request.jwt.claim.role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: complete_stripe_event is restricted to service_role execution.';
  END IF;

  UPDATE public.stripe_events
  SET status = 'completed',
      processed_at = now()
  WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.fail_stripe_event(
  p_event_id TEXT
)
RETURNS VOID AS $$
BEGIN
  IF current_user != 'service_role' AND current_setting('request.jwt.claim.role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: fail_stripe_event is restricted to service_role execution.';
  END IF;

  UPDATE public.stripe_events
  SET status = 'failed'
  WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ═══════════════════════════════════════════════════
-- 12. HELPER: SAFE ADMIN CHECK (PREVENTS RLS RECURSION)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ═══════════════════════════════════════════════════
-- 13. EXPLICIT EXECUTION PRIVILEGE REVOCATIONS & GRANTS
-- ═══════════════════════════════════════════════════

-- 1. Trigger functions: Internal trigger execution only
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_user_email_sync() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_user_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_draw_winner_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_charity_contributions() FROM PUBLIC, anon, authenticated;

-- 2. Authenticated user RPCs
REVOKE ALL ON FUNCTION public.claim_checkout_lock(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_checkout_lock(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.add_golf_score(UUID, INT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_golf_score(UUID, INT, DATE) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- 3. Service-role administrative and webhook financial RPCs
REVOKE ALL ON FUNCTION public.publish_draw_atomic(UUID, JSONB, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_draw_atomic(UUID, JSONB, NUMERIC, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.record_completed_donation(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_completed_donation(UUID, UUID, NUMERIC, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.claim_stripe_event(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.complete_stripe_event(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_stripe_event(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.fail_stripe_event(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_stripe_event(TEXT) TO service_role;

-- ═══════════════════════════════════════════════════
-- 14. ROW LEVEL SECURITY (RLS) POLICIES (Idempotent Drops & Grants)
-- ═══════════════════════════════════════════════════

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golf_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.independent_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Users
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admin full access users" ON public.users;
CREATE POLICY "Admin full access users" ON public.users FOR ALL USING (public.is_admin());

-- Charities
DROP POLICY IF EXISTS "Public read charities" ON public.charities;
CREATE POLICY "Public read charities" ON public.charities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage charities" ON public.charities;
CREATE POLICY "Admin manage charities" ON public.charities FOR ALL USING (public.is_admin());

-- Golf Scores (Direct client INSERT is disabled; score submissions must go through the transactional add_golf_score RPC)
DROP POLICY IF EXISTS "Users read own scores" ON public.golf_scores;
CREATE POLICY "Users read own scores" ON public.golf_scores FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own scores" ON public.golf_scores;
CREATE POLICY "Users delete own scores" ON public.golf_scores FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin full access scores" ON public.golf_scores;
CREATE POLICY "Admin full access scores" ON public.golf_scores FOR ALL USING (public.is_admin());

-- Draws (published and locked are public read)
DROP POLICY IF EXISTS "Public read published draws" ON public.draws;
CREATE POLICY "Public read published draws" ON public.draws FOR SELECT USING (status::text IN ('published', 'locked'));

DROP POLICY IF EXISTS "Admin manage draws" ON public.draws;
CREATE POLICY "Admin manage draws" ON public.draws FOR ALL USING (public.is_admin());

-- Draw Entries
DROP POLICY IF EXISTS "Users read own entries" ON public.draw_entries;
CREATE POLICY "Users read own entries" ON public.draw_entries FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin manage entries" ON public.draw_entries;
CREATE POLICY "Admin manage entries" ON public.draw_entries FOR ALL USING (public.is_admin());

-- Draw Winners
DROP POLICY IF EXISTS "Users read own winnings" ON public.draw_winners;
CREATE POLICY "Users read own winnings" ON public.draw_winners FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own proof" ON public.draw_winners;
CREATE POLICY "Users update own proof" ON public.draw_winners FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin manage winners" ON public.draw_winners;
CREATE POLICY "Admin manage winners" ON public.draw_winners FOR ALL USING (public.is_admin());

-- Independent Donations
DROP POLICY IF EXISTS "Users read own donations" ON public.independent_donations;
CREATE POLICY "Users read own donations" ON public.independent_donations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin read donations" ON public.independent_donations;
CREATE POLICY "Admin read donations" ON public.independent_donations FOR SELECT USING (public.is_admin());

-- Audit Logs (Admin only)
DROP POLICY IF EXISTS "Admin read audit logs" ON public.audit_logs;
CREATE POLICY "Admin read audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin());

-- ═══════════════════════════════════════════════════
-- SEED DATA: Sample Charities (Idempotent Upsert)
-- ═══════════════════════════════════════════════════
INSERT INTO public.charities (name, description, is_featured, upcoming_events, total_contributions) VALUES
  ('Youth Golf Foundation', 'Bringing golf to underprivileged communities, providing equipment, coaching, and opportunities for young people.', true, 'Annual Youth Tournament — June 2026', 142500),
  ('Green Earth Initiative', 'Protecting natural habitats by promoting sustainable golf course management and rewilding.', true, 'Eco Golf Day — April 2026', 238000),
  ('Veterans on the Fairway', 'Supporting mental health recovery for military veterans through golf therapy.', true, 'Veterans Invitational — May 2026', 189500),
  ('Golf for Good', 'Funding grassroots golf programs in developing countries.', false, NULL, 95000),
  ('Fairway to Health', 'Using golf as physical therapy for people recovering from illness or injury.', false, 'Charity Walk & Play — July 2026', 64000),
  ('Women in Golf', 'Breaking barriers and promoting gender equality in golf.', false, NULL, 112000)
ON CONFLICT DO NOTHING;
