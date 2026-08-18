# ⛳ GolfForGood — Golf Charity Subscription & Prize Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20RLS-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Subscriptions%20%26%20Webhooks-635BFF?style=flat-square&logo=stripe&logoColor=white)](https://stripe.com/)
[![Vitest](https://img.shields.io/badge/Vitest-16%20Regression%20Tests%20Passing-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Security](https://img.shields.io/badge/Security-Zero--Trust%20Hardened-214E34?style=flat-square&logo=shield)](https://github.com/Sekhar01807/Golf-Platform)

> **A modern, full-stack platform uniting golf score tracking, verified charitable giving, and skill-based monthly prize draws.** Built with Next.js 16 (App Router), React 19, TypeScript, Supabase (PostgreSQL with RLS & DB Triggers), and Stripe Billing.

---

## 📌 Executive Summary

**GolfForGood** (simulated charity & prize draw platform) connects golfers' athletic performance with real-world philanthropic impact. Members maintain an active monthly or annual subscription, log their 18-hole Stableford golf scores (1–45 points), direct a percentage of their membership dues (10%–50%) to verified partner charities, and enter monthly skill-based prize draws.

---

## 🏗️ System Architecture

```
                                 ┌───────────────────────────────┐
                                 │     Next.js 16 App Router     │
                                 │  (React 19 Server Components) │
                                 └──────────────┬────────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
      ┌────────────────────┐         ┌────────────────────┐         ┌────────────────────┐
      │  Public Marketing  │         │  Member Dashboard  │         │    Admin Panel     │
      │  & Partner Causes  │         │ (Scores / Charity) │         │ (requireAdmin / DB)│
      └────────────────────┘         └──────────┬─────────┘         └──────────┬─────────┘
                                                │                              │
                                     ┌──────────▼──────────────────────────────▼──────────┐
                                     │        Next.js Route Handlers (API Layer)          │
                                     │   (Zod Validation, Session Auth & Error Guards)    │
                                     └──────────┬──────────────────────────────┬──────────┘
                                                │                              │
                        ┌───────────────────────▼──────┐            ┌──────────▼───────────────┐
                        │     Supabase / PostgreSQL    │            │      Stripe Platform     │
                        │  - Zero-Trust RLS Policies   │            │  - Checkout Subscriptions│
                        │  - Column Protection Triggers│            │  - Customer Portal       │
                        │  - Transactional FIFO Scores │            │  - Webhook Idempotency   │
                        │  - Audit Logs & Ledgers      │            └──────────┬───────────────┘
                        └──────────────────────────────┘                       │
                                        ▲                                      │
                                        └────────── Verified Webhook ──────────┘
```

### Mermaid Architecture Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Member as Golfer / Member
    participant UI as Next.js 16 Frontend
    participant API as Next.js Route Handlers
    participant DB as Supabase PostgreSQL (RLS)
    participant Stripe as Stripe Billing Engine

    Member->>UI: Selects Plan & Signs Up
    UI->>API: POST /api/checkout { plan: "yearly" }
    API->>Stripe: stripe.checkout.sessions.create()
    Stripe-->>UI: Redirects to Hosted Checkout
    Member->>Stripe: Completes Payment
    Stripe->>API: Webhook (checkout.session.completed)
    API->>DB: Check stripe_events (Idempotency)
    API->>DB: Update subscription_status = 'active'
    Member->>UI: Logs Stableford Score (e.g. 38 pts)
    UI->>API: POST /api/scores { score: 38, date: "2026-08-17" }
    API->>DB: RPC add_golf_score() [Enforces strict 5-score FIFO]
    Note over API,DB: Server Draw Engine evaluates strictly authentic 5-score members
    API->>DB: Matches 5 score numbers against drawn numbers
    API->>DB: Calculates 40% (5-match), 35% (4-match), 25% (3-match)
    DB-->>UI: Displays Member Winnings & Verification Queue
```

---

## 🗄️ Database Schema & Entity-Relationship (ER) Model

```mermaid
erDiagram
    USERS ||--o{ GOLF_SCORES : "logs (max 5 FIFO)"
    USERS }o--|| CHARITIES : "directs 10-50% dues"
    USERS ||--o{ DRAW_ENTRIES : "enters with score set"
    USERS ||--o{ DRAW_WINNERS : "claims prize"
    USERS ||--o{ INDEPENDENT_DONATIONS : "donates"
    DRAWS ||--o{ DRAW_ENTRIES : "contains"
    DRAWS ||--o{ DRAW_WINNERS : "awards"
    CHARITIES ||--o{ INDEPENDENT_DONATIONS : "receives"
    USERS ||--o{ AUDIT_LOGS : "acts as admin"

    USERS {
        uuid id PK
        string email
        string full_name
        user_role role "user | admin"
        string stripe_customer_id
        string stripe_subscription_id
        subscription_status subscription_status "active | inactive | cancelled | lapsed"
        subscription_plan subscription_plan "monthly | yearly"
        timestamptz subscription_start_date
        timestamptz subscription_end_date
        uuid selected_charity_id FK
        integer charity_contribution_percentage "10 to 50"
    }

    CHARITIES {
        uuid id PK
        string name
        string description
        string image_url
        boolean is_featured
        numeric total_contributions
    }

    GOLF_SCORES {
        uuid id PK
        uuid user_id FK
        integer score "1 to 45 Stableford"
        date date_played
    }

    DRAWS {
        uuid id PK
        date draw_month UK
        draw_status status "simulated | published | locked"
        draw_type draw_logic "random | algorithmic"
        integer_array winning_numbers "5 unique numbers (1-45)"
        numeric total_prize_pool
        numeric rollover_amount "conserved jackpot rollover"
        timestamptz published_at
    }

    DRAW_WINNERS {
        uuid id PK
        uuid draw_id FK
        uuid user_id FK
        string match_type "5-match | 4-match | 3-match"
        numeric prize_amount
        string winner_proof_url
        verification_status verification_status "pending | approved | rejected"
        payout_status payout_status "pending | paid"
    }

    STRIPE_EVENTS {
        string id PK "event_id"
        string event_type
        timestamptz processed_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid actor_id FK
        string action
        string target_type
        string target_id
        jsonb details
        timestamptz created_at
    }
```

---

## 🛡️ Zero-Trust Security & Authorization Architecture

1. **Caller-Identity Boundary on RPCs (`add_golf_score`, `record_completed_donation`)**:
   - `add_golf_score` checks `auth.uid() = p_user_id` or admin/service role to prevent unauthorized score insertion for other accounts.
   - `record_completed_donation` is strictly restricted to `service_role` and execution is revoked from public/anon users.
   - All `SECURITY DEFINER` functions explicitly set `SET search_path = public, pg_temp;` to mitigate search-path hijacking.
2. **Privilege Escalation Prevention (`protect_user_fields`)**:
   - PostgreSQL `BEFORE UPDATE` triggers prevent authenticated users from modifying sensitive columns (`role`, `subscription_status`, `subscription_plan`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_end_date`).
   - Normal users may only modify non-sensitive profile fields (`full_name`, `selected_charity_id`, `charity_contribution_percentage`).
3. **Winner Mutation Lockdown & Server Payout Invariant**:
   - Non-admin users are strictly restricted to updating `winner_proof_url` and only while `verification_status = 'pending'`.
   - Direct database CHECK constraint (`chk_draw_winners_payout_verified`) and API-level validation enforce that `payout_status = 'paid'` is impossible unless `verification_status = 'approved'`.
4. **Fail-Closed Stripe Webhook Idempotency**:
   - Webhook processing establishes an idempotent claim in `stripe_events`. Duplicate events return HTTP 200, while unexpected database failures return HTTP 500 to trigger safe Stripe retries.
5. **Transactional 5-Score FIFO Limit**:
   - Stableford score insertions maintain exactly the 5 most recent rounds per user. User existence and historical dates within 2 years are verified.
6. **Immutable Audit Logging**:
   - Critical administrative actions (draw publication, draw lockdown, winner verification, charity management) fail closed to guarantee persistent auditability.

---

## 🎰 Draw Engine & Prize Pool Mechanics

- **Authentic Eligibility**: Only active subscribers who have logged all 5 valid rounds enter the draw.
- **Cryptographically Secure Randomness**: Node.js `crypto.randomInt` (CSPRNG) is used for standard draws, eliminating pseudo-random bias.
- **Deterministic Algorithmic Draws**: Seeded SHA-256 cryptographic digest derivation provides reproducible, mathematically auditable winning numbers.
- **Anti-Inflation Score Matching**: Member scores are deduplicated prior to comparison against drawn numbers (`[7, 7, 7, 7, 7]` matches winning 7 exactly once, not five times).
- **Match Tiers & Rollover Conservation**:
  - **5-Number Match (Jackpot)**: Allocated **40%** of the prize pool (rolls over to the next month if 0 winners).
  - **4-Number Match**: Allocated **35%** of the prize pool (split equally among tier winners).
  - **3-Number Match**: Allocated **25%** of the prize pool (split equally among tier winners).
  - **Residual Conservation**: All integer division remainders and unawarded tier pools are explicitly conserved into `rollover_amount` and carried forward into subsequent monthly draw prize pools.
- **Authoritative Simulation & Lifecycle**:
  $$\text{SIMULATED} \longrightarrow \text{PUBLISHED} \longrightarrow \text{LOCKED (Immutable)}$$
  The persisted simulation result is authoritative. Once published, the exact numbers and winners reviewed by the administrator are committed without re-rolling. Once locked, the draw is permanently frozen.

---

## 💻 Tech Stack

- **Framework**: Next.js 16.2.0 (App Router, Server Components, Route Handlers)
- **Language**: TypeScript 5
- **UI & Styling**: Vanilla CSS Design System with Curated Golf Palette (`#214E34` deep golf green, `#6B8E72` sage, `#D4A84F` gold, `#F7F8F5` background)
- **Database & Auth**: Supabase PostgreSQL, SSR Cookie Auth, Row Level Security (RLS)
- **Payments & Billing**: Stripe Checkout, Stripe Billing Portal, Authoritative Webhook Handlers
- **Testing**: Vitest 3.0 (Unit, Validation, Security Barrier, Idempotency & Lifecycle suites)
- **Transactional Email**: Resend API with verified sender domain support

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18.x or 20.x
- Supabase project credentials
- Stripe test account keys

### 2. Environment Configuration
Create `.env.local` in the root directory (see `.env.example`):

```env
# ── Supabase Database & Auth ──
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-private-key

# ── Stripe Payments & Webhooks ──
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_YEARLY_PRICE_ID=price_...

# ── Application URL ──
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Transactional Email (Optional in dev) ──
RESEND_API_KEY=re_...
EMAIL_FROM=Golf Platform <notifications@golfforgood.org>
```

### 3. Database Migration
Run the contents of [supabase/schema.sql](file:///supabase/schema.sql) in your Supabase SQL Editor to provision tables, triggers, indexes, and RLS policies.

### 4. Running the Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🧪 Automated Testing

Execute the Vitest automated test suite:

```bash
npm test
```

### Test Suites Included:
- **`src/__tests__/security-regression.test.ts`**: Comprehensive 16-point regression suite covering role escalation, subscription mutation guards, payout protection, non-admin API rejection, locked draw immutability, future date rejection, strict 5-score FIFO, fail-closed webhook idempotency, duplicate subscription prevention, charity deletion cascade blocks, draw lifecycle state transitions, fail-closed audit logging, and score age horizons.
- **`src/__tests__/validations.test.ts`**: Score constraints (1–45), date formats, future date rejection, checkout plan whitelisting, UUID validation, draw actions, and winner proof URL validations.
- **`src/__tests__/draw.service.test.ts`**: CSPRNG generation, deterministic SHA-256 algorithmic draw, anti-inflation matching, mathematical prize pool split, rollover persistence, and residual arithmetic conservation.
- **`src/__tests__/auth-security.test.ts`**: Privilege escalation blocking, winner proof-only mutation enforcement, RPC caller boundaries, and payout approval requirements.
- **`src/__tests__/webhook-idempotency.test.ts`**: Duplicate event suppression and fail-closed database error handling.

---

## 📄 License & Disclaimer

This project is built for portfolio and educational purposes as a simulated golf charity subscription platform. It is not intended as a real-money lottery.
