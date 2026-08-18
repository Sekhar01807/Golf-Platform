-- ═══════════════════════════════════════════════════
-- Golf Charity Subscription Platform
-- Supabase Database Schema (Hardened Production Schema)
-- ═══════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Custom Types ──
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'cancelled', 'lapsed');
CREATE TYPE subscription_plan AS ENUM ('monthly', 'yearly');
CREATE TYPE draw_status AS ENUM ('simulated', 'published', 'locked');
CREATE TYPE draw_type AS ENUM ('random', 'algorithmic');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE payout_status AS ENUM ('pending', 'paid');
CREATE TYPE payment_status AS ENUM ('pending', 'completed');

-- ═══════════════════════════════════════════════════
-- 1. USERS TABLE (public profile, linked to auth.users)
-- ═══════════════════════════════════════════════════
CREATE TABLE public.users (
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
  selected_charity_id UUID,
  charity_contribution_percentage INTEGER NOT NULL DEFAULT 10 CHECK (charity_contribution_percentage >= 10 AND charity_contribution_percentage <= 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════
-- 2. CHARITIES TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE public.charities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  upcoming_events TEXT,
  total_contributions NUMERIC NOT NULL DEFAULT 0 CHECK (total_contributions >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK constraint to users after charities table exists
ALTER TABLE public.users
  ADD CONSTRAINT fk_users_charity
  FOREIGN KEY (selected_charity_id) REFERENCES public.charities(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════
-- 3. GOLF SCORES TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE public.golf_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 45),
  date_played DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scores_user ON public.golf_scores(user_id);
CREATE INDEX idx_scores_date ON public.golf_scores(user_id, date_played DESC);

-- ═══════════════════════════════════════════════════
-- 4. DRAWS TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE public.draws (
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
-- 5. DRAW ENTRIES TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE public.draw_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id UUID NOT NULL REFERENCES public.draws(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_numbers INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(draw_id, user_id)
);

-- ═══════════════════════════════════════════════════
-- 6. DRAW WINNERS TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE public.draw_winners (
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
-- 7. INDEPENDENT DONATIONS TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE public.independent_donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  charity_id UUID NOT NULL REFERENCES public.charities(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_status payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 8. STRIPE EVENTS (Webhook Idempotency)
-- ═══════════════════════════════════════════════════
CREATE TABLE public.stripe_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 9. AUDIT LOGS TABLE
-- ═══════════════════════════════════════════════════
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ═══════════════════════════════════════════════════
-- 10. SECURITY & TRANSACTIONAL FUNCTIONS / TRIGGERS
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

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
     NEW.payout_status IS DISTINCT FROM OLD.payout_status OR
     NEW.prize_amount IS DISTINCT FROM OLD.prize_amount OR
     NEW.match_type IS DISTINCT FROM OLD.match_type OR
     NEW.draw_id IS DISTINCT FROM OLD.draw_id OR
     NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Unauthorized: Users can only upload winner proof URLs.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER protect_draw_winner_fields_trigger
  BEFORE UPDATE ON public.draw_winners
  FOR EACH ROW EXECUTE FUNCTION public.protect_draw_winner_fields();

-- C. Enforce 5-Score Maximum Transactionally via FIFO RPC with Caller-Identity Boundary & Integrity Rules
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
  -- Caller identity boundary: caller must be authenticated and match target user or have admin/service privileges
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

  -- Validate user existence
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

  -- Count existing scores
  SELECT COUNT(*) INTO v_count FROM public.golf_scores WHERE user_id = p_user_id;

  -- If 5 or more scores exist, purge the oldest to maintain strict 5-score limit
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

-- D. Atomic Donation Ledger Update (Service-Role Boundary Restricted)
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

-- Explicitly revoke execution on financial RPC from public/anon/authenticated clients
REVOKE EXECUTE ON FUNCTION public.record_completed_donation(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_completed_donation(UUID, UUID, NUMERIC, TEXT) TO service_role;

-- ═══════════════════════════════════════════════════
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
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
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin full access users" ON public.users FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Charities
CREATE POLICY "Public read charities" ON public.charities FOR SELECT USING (true);
CREATE POLICY "Admin manage charities" ON public.charities FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Golf Scores
CREATE POLICY "Users read own scores" ON public.golf_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scores" ON public.golf_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own scores" ON public.golf_scores FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admin full access scores" ON public.golf_scores FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Draws (published and locked are public read)
CREATE POLICY "Public read published draws" ON public.draws FOR SELECT USING (status IN ('published', 'locked'));
CREATE POLICY "Admin manage draws" ON public.draws FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Draw Entries
CREATE POLICY "Users read own entries" ON public.draw_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin manage entries" ON public.draw_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Draw Winners
CREATE POLICY "Users read own winnings" ON public.draw_winners FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own proof" ON public.draw_winners FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admin manage winners" ON public.draw_winners FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Independent Donations (No direct client insert; handled via server-side Stripe webhook)
CREATE POLICY "Users read own donations" ON public.independent_donations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin manage donations" ON public.independent_donations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Audit Logs (Admin only)
CREATE POLICY "Admin read audit logs" ON public.audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Stripe Events (Service role only, no client access)
-- Default deny for non-service-role callers

-- ═══════════════════════════════════════════════════
-- SEED DATA: Sample Charities
-- ═══════════════════════════════════════════════════
INSERT INTO public.charities (name, description, is_featured, upcoming_events, total_contributions) VALUES
  ('Youth Golf Foundation', 'Bringing golf to underprivileged communities, providing equipment, coaching, and opportunities for young people.', true, 'Annual Youth Tournament — June 2026', 142500),
  ('Green Earth Initiative', 'Protecting natural habitats by promoting sustainable golf course management and rewilding.', true, 'Eco Golf Day — April 2026', 238000),
  ('Veterans on the Fairway', 'Supporting mental health recovery for military veterans through golf therapy.', true, 'Veterans Invitational — May 2026', 189500),
  ('Golf for Good', 'Funding grassroots golf programs in developing countries.', false, NULL, 95000),
  ('Fairway to Health', 'Using golf as physical therapy for people recovering from illness or injury.', false, 'Charity Walk & Play — July 2026', 64000),
  ('Women in Golf', 'Breaking barriers and promoting gender equality in golf.', false, NULL, 112000)
ON CONFLICT DO NOTHING;
