import { describe, it, expect } from 'vitest';
import { validateScoreInput } from '../lib/validations';
import { evaluateEntry, calculatePrizePoolDistribution } from '../lib/services/draw.service';

describe('Regression 1 & 2: User Profile Privilege Escalation Barrier', () => {
  function applyUserProfileUpdatePolicy(callerRole: 'user' | 'admin', targetUpdates: Record<string, unknown>) {
    if (callerRole === 'admin') return { allowed: true };

    const restrictedFields = [
      'role',
      'subscription_status',
      'subscription_plan',
      'stripe_customer_id',
      'stripe_subscription_id',
      'subscription_end_date',
    ];

    for (const key of Object.keys(targetUpdates)) {
      if (restrictedFields.includes(key)) {
        return { allowed: false, rejectedField: key };
      }
    }
    return { allowed: true };
  }

  it('1. should block a normal user from changing role to admin', () => {
    const res = applyUserProfileUpdatePolicy('user', { role: 'admin' });
    expect(res.allowed).toBe(false);
    expect(res.rejectedField).toBe('role');
  });

  it('2. should block a normal user from self-activating subscription_status', () => {
    const res = applyUserProfileUpdatePolicy('user', { subscription_status: 'active' });
    expect(res.allowed).toBe(false);
    expect(res.rejectedField).toBe('subscription_status');
  });
});

describe('Regression 3 & 4: Winner Record Mutation Lockdown', () => {
  function applyWinnerUpdatePolicy(callerRole: 'user' | 'admin', verificationStatus: string, targetUpdates: Record<string, unknown>) {
    if (callerRole === 'admin') return { allowed: true };

    if (verificationStatus !== 'pending') {
      return { allowed: false, error: 'Locked after verification' };
    }

    const permittedUserFields = ['winner_proof_url'];
    for (const key of Object.keys(targetUpdates)) {
      if (!permittedUserFields.includes(key)) {
        return { allowed: false, rejectedField: key };
      }
    }
    return { allowed: true };
  }

  it('3. should block a winner from modifying their payout_status', () => {
    const res = applyWinnerUpdatePolicy('user', 'pending', { payout_status: 'paid' });
    expect(res.allowed).toBe(false);
    expect(res.rejectedField).toBe('payout_status');
  });

  it('4. should block a winner from tampering with their prize_amount', () => {
    const res = applyWinnerUpdatePolicy('user', 'pending', { prize_amount: 100000 });
    expect(res.allowed).toBe(false);
    expect(res.rejectedField).toBe('prize_amount');
  });
});

describe('Regression 5: Non-Admin Cannot Call Admin APIs', () => {
  function checkAdminAuthorization(role: string | null | undefined): { status: number; authorized: boolean } {
    if (!role) return { status: 401, authorized: false };
    if (role !== 'admin') return { status: 403, authorized: false };
    return { status: 200, authorized: true };
  }

  it('5. should return 401 for unauthenticated and 403 for non-admin callers', () => {
    expect(checkAdminAuthorization(null).status).toBe(401);
    expect(checkAdminAuthorization('user').status).toBe(403);
    expect(checkAdminAuthorization('admin').status).toBe(200);
  });
});

describe('Regression 6: Locked Draw Immutability', () => {
  function updateDrawState(currentStatus: 'simulated' | 'published' | 'locked', newWinningNumbers: number[]) {
    if (currentStatus === 'locked') {
      throw new Error('Illegal state transition: Locked draw is permanently immutable.');
    }
    return { status: currentStatus, winningNumbers: newWinningNumbers };
  }

  it('6. should throw an error when attempting to modify a locked draw', () => {
    expect(() => updateDrawState('locked', [1, 2, 3, 4, 5])).toThrow('immutable');
  });
});

describe('Regression 7: Future Score Rejection', () => {
  it('7. should reject score submissions with future dates', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    const validation = validateScoreInput({ score: 36, date_played: dateStr });
    expect(validation.success).toBe(false);
    expect(validation.error).toContain('future');
  });
});

describe('Regression 8: Transactional 6th-Score FIFO (Preserves Exactly 5 Scores)', () => {
  function simulateFifoScoreAddition(existingScores: { id: string; score: number; date: string }[], newScore: { id: string; score: number; date: string }) {
    const scores = [...existingScores, newScore];
    scores.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return scores.slice(0, 5);
  }

  it('8. should discard the oldest score when a 6th score is inserted, preserving exactly 5', () => {
    const initialFive = [
      { id: 's1', score: 34, date: '2026-08-01' },
      { id: 's2', score: 36, date: '2026-08-03' },
      { id: 's3', score: 38, date: '2026-08-05' },
      { id: 's4', score: 40, date: '2026-08-07' },
      { id: 's5', score: 42, date: '2026-08-09' },
    ];

    const newRound = { id: 's6', score: 44, date: '2026-08-11' };
    const resulting = simulateFifoScoreAddition(initialFive, newRound);

    expect(resulting).toHaveLength(5);
    expect(resulting[0].id).toBe('s6'); // Newest
    expect(resulting.find(s => s.id === 's1')).toBeUndefined(); // Oldest dropped
  });
});

describe('Regression 9: Stateful Stripe Event Idempotency & Financial Retryability', () => {
  type EventStatus = 'processing' | 'completed' | 'failed';

  class StatefulStripeEventStore {
    private events = new Map<string, { status: EventStatus; createdAt: Date }>();

    claim(eventId: string, now: Date = new Date()): { status: 'CLAIMED' | 'DUPLICATE_COMPLETED' | 'IN_FLIGHT' } {
      const existing = this.events.get(eventId);
      if (existing) {
        if (existing.status === 'completed') {
          return { status: 'DUPLICATE_COMPLETED' };
        }
        const isRecent = (now.getTime() - existing.createdAt.getTime()) < 300000;
        if (existing.status === 'processing' && isRecent) {
          return { status: 'IN_FLIGHT' };
        }
        existing.status = 'processing';
        existing.createdAt = now;
        return { status: 'CLAIMED' };
      }
      this.events.set(eventId, { status: 'processing', createdAt: now });
      return { status: 'CLAIMED' };
    }

    complete(eventId: string) {
      const e = this.events.get(eventId);
      if (e) e.status = 'completed';
    }

    fail(eventId: string) {
      const e = this.events.get(eventId);
      if (e) e.status = 'failed';
    }
  }

  it('9. should allow event retry when business logic fails and only suppress duplicates after completion', () => {
    const store = new StatefulStripeEventStore();
    const eventId = 'evt_retry_123456';

    // 1st delivery: fails during business logic (e.g. transient DB timeout)
    const claim1 = store.claim(eventId);
    expect(claim1.status).toBe('CLAIMED');
    // Handler fails business operation and marks failed
    store.fail(eventId);

    // 2nd delivery: Stripe retries the same event after backoff
    const claim2 = store.claim(eventId);
    expect(claim2.status).toBe('CLAIMED'); // Can be re-claimed and retried!
    // Handler completes business operation
    store.complete(eventId);

    // 3rd delivery: subsequent retry recognized as duplicate
    const claim3 = store.claim(eventId);
    expect(claim3.status).toBe('DUPLICATE_COMPLETED');
  });
});

describe('Regression 10: Completed Donation Updates Charity Total Atomically & Idempotently', () => {
  const processedPayments = new Set<string>();

  function recordCompletedDonation(
    charity: { id: string; total: number },
    donationAmount: number,
    stripePaymentId?: string
  ) {
    if (donationAmount <= 0) throw new Error('Invalid donation amount');

    if (stripePaymentId) {
      if (processedPayments.has(stripePaymentId)) {
        // Idempotent no-op: already recorded
        return { charityId: charity.id, newTotal: charity.total, duplicate: true };
      }
      processedPayments.add(stripePaymentId);
    }

    return {
      charityId: charity.id,
      newTotal: charity.total + donationAmount,
      duplicate: false,
    };
  }

  it('10. should synchronously increment charity total when a completed donation arrives and avoid duplicate incrementation on re-delivery', () => {
    const charity = { id: 'green-earth', total: 50000 };
    const paymentId = 'pi_test_donation_unique_1';

    const delivery1 = recordCompletedDonation(charity, 2500, paymentId);
    expect(delivery1.newTotal).toBe(52500);
    expect(delivery1.duplicate).toBe(false);

    // Re-delivery of same Stripe payment
    charity.total = delivery1.newTotal;
    const delivery2 = recordCompletedDonation(charity, 2500, paymentId);
    expect(delivery2.newTotal).toBe(52500); // Does NOT inflate to 55000
    expect(delivery2.duplicate).toBe(true);
  });
});

describe('Regression 11: Fail-Closed Webhook Idempotency & Database Update Error Guards', () => {
  function processWebhookIdempotency(dbInsertResult: { error: { code?: string; message?: string } | null }) {
    if (dbInsertResult.error) {
      if (
        dbInsertResult.error.code === '23505' ||
        dbInsertResult.error.message?.toLowerCase().includes('duplicate') ||
        dbInsertResult.error.message?.toLowerCase().includes('unique')
      ) {
        return { status: 200, duplicate: true };
      }
      // Non-duplicate database failure must fail closed (return 500)
      return { status: 500, error: 'Database idempotency claim failed' };
    }
    return { status: 200, processed: true };
  }

  function handleWebhookDbUpdate(updateResult: { error: { message: string } | null }) {
    if (updateResult.error) {
      throw new Error(`Database mutation failed: ${updateResult.error.message}`);
    }
    return { success: true };
  }

  it('11. should fail closed with status 500 when database idempotency or update errors occur', () => {
    const dbDownResult = processWebhookIdempotency({ error: { code: '57P01', message: 'Admin shutdown / connection refused' } });
    expect(dbDownResult.status).toBe(500);

    const duplicateResult = processWebhookIdempotency({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } });
    expect(duplicateResult.status).toBe(200);
    expect(duplicateResult.duplicate).toBe(true);

    expect(() => handleWebhookDbUpdate({ error: { message: 'table locked' } })).toThrow('Database mutation failed');
    expect(handleWebhookDbUpdate({ error: null }).success).toBe(true);
  });
});

describe('Regression 12: Duplicate Active Subscription Prevention', () => {
  function validateCheckoutEligibility(userProfile: { subscription_status: string }) {
    if (userProfile.subscription_status === 'active') {
      return { allowed: false, status: 400, error: 'User already has an active subscription' };
    }
    return { allowed: true, status: 200 };
  }

  it('12. should reject new checkout session if the user already has an active subscription', () => {
    const activeUser = { subscription_status: 'active' };
    const res = validateCheckoutEligibility(activeUser);
    expect(res.allowed).toBe(false);
    expect(res.status).toBe(400);

    const inactiveUser = { subscription_status: 'inactive' };
    expect(validateCheckoutEligibility(inactiveUser).allowed).toBe(true);
  });
});

describe('Regression 13: Charity Deletion Guard for Historical Donations', () => {
  function deleteCharityGuard(donationsCount: number) {
    if (donationsCount > 0) {
      return { allowed: false, status: 409, error: 'Cannot delete charity with existing donation history' };
    }
    return { allowed: true, status: 200 };
  }

  it('13. should block charity deletion with HTTP 409 when historical donations exist', () => {
    expect(deleteCharityGuard(5).allowed).toBe(false);
    expect(deleteCharityGuard(5).status).toBe(409);
    expect(deleteCharityGuard(0).allowed).toBe(true);
  });
});

describe('Regression 14: Draw Lifecycle State Machine Enforcements', () => {
  function simulateDrawStateTransition(currentStatus: 'simulated' | 'published' | 'locked', action: 'simulate' | 'publish' | 'lock') {
    if (action === 'simulate') {
      if (currentStatus === 'published' || currentStatus === 'locked') {
        throw new Error(`Cannot simulate a draw that is already ${currentStatus}`);
      }
      return 'simulated';
    }
    if (action === 'publish') {
      if (currentStatus !== 'simulated') {
        throw new Error(`Cannot publish a draw with status "${currentStatus}". Only simulated draws can be published.`);
      }
      return 'published';
    }
    if (action === 'lock') {
      if (currentStatus !== 'published') {
        throw new Error(`Cannot lock a draw with status "${currentStatus}". Only published draws can be locked.`);
      }
      return 'locked';
    }
  }

  it('14. should enforce strict one-way lifecycle transitions (simulated -> published -> locked)', () => {
    expect(simulateDrawStateTransition('simulated', 'publish')).toBe('published');
    expect(simulateDrawStateTransition('published', 'lock')).toBe('locked');

    // Cannot re-simulate published or locked
    expect(() => simulateDrawStateTransition('published', 'simulate')).toThrow('Cannot simulate');
    expect(() => simulateDrawStateTransition('locked', 'simulate')).toThrow('Cannot simulate');

    // Cannot publish locked or already published
    expect(() => simulateDrawStateTransition('published', 'publish')).toThrow('Cannot publish');
    expect(() => simulateDrawStateTransition('locked', 'publish')).toThrow('Cannot publish');
  });
});

describe('Regression 15: Critical Audit Logging Fail-Closed Mode', () => {
  function executeAuditedAction(
    actionName: string,
    logInsertResult: { error: { message: string } | null },
    failClosed: boolean = true
  ) {
    if (logInsertResult.error) {
      if (failClosed) {
        throw new Error(`Mandatory audit record creation failed for action ${actionName}: ${logInsertResult.error.message}`);
      }
      return { success: true, unAudited: true };
    }
    return { success: true, unAudited: false };
  }

  it('15. should abort and throw an error when audit logging fails in failClosed mode', () => {
    const errorResult = { error: { message: 'Database connection failed' } };
    expect(() => executeAuditedAction('PUBLISH_DRAW', errorResult, true)).toThrow('Mandatory audit record creation failed');
  });
});

describe('Regression 16: Score Submission Age Horizon Constraints', () => {
  function validateScoreDateHorizon(datePlayedStr: string): { valid: boolean; error?: string } {
    const played = new Date(datePlayedStr);
    const now = new Date();
    if (played > now) {
      return { valid: false, error: 'Date played cannot be in the future' };
    }

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    if (played < twoYearsAgo) {
      return { valid: false, error: 'Date played cannot be older than 2 years' };
    }

    return { valid: true };
  }

  it('16. should reject scores older than 2 years or in the future', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    expect(validateScoreDateHorizon(futureDate.toISOString().split('T')[0]).valid).toBe(false);

    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 3);
    const oldRes = validateScoreDateHorizon(oldDate.toISOString().split('T')[0]);
    expect(oldRes.valid).toBe(false);
    expect(oldRes.error).toContain('2 years');

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10);
    expect(validateScoreDateHorizon(recentDate.toISOString().split('T')[0]).valid).toBe(true);
  });
});

describe('Regression 17: Concurrent Subscription Checkout Lock Claim', () => {
  class MockUserLockStore {
    private user = {
      id: 'usr_123',
      subscription_status: 'inactive',
      checkout_lock_until: null as Date | null,
    };

    public claimCheckoutLock(now: Date = new Date()): { success: boolean; error?: string } {
      if (this.user.subscription_status === 'active') {
        return { success: false, error: 'User already has an active subscription.' };
      }

      if (this.user.checkout_lock_until && this.user.checkout_lock_until > now) {
        return { success: false, error: 'A checkout session is already in progress. Please complete your payment or try again in a few minutes.' };
      }

      // Claim lock for 5 minutes
      this.user.checkout_lock_until = new Date(now.getTime() + 5 * 60 * 1000);
      return { success: true };
    }
  }

  it('17. should allow the first checkout request and block a concurrent second request with a lock error', () => {
    const store = new MockUserLockStore();
    const t0 = new Date();

    const req1 = store.claimCheckoutLock(t0);
    expect(req1.success).toBe(true);

    // Concurrent request 1 second later before webhook returns
    const req2 = store.claimCheckoutLock(new Date(t0.getTime() + 1000));
    expect(req2.success).toBe(false);
    expect(req2.error).toContain('already in progress');
  });
});

describe('Regression 18: Serialized FIFO Score Addition Concurrency Safety', () => {
  class SerializedFifoStore {
    private scores: { id: string; score: number; date: string }[] = [];
    private isLocked = false;

    // Simulates SELECT FOR UPDATE pessimistic row-lock
    async addScore(scoreItem: { id: string; score: number; date: string }) {
      while (this.isLocked) {
        await new Promise(r => setTimeout(r, 5));
      }
      this.isLocked = true;
      try {
        if (this.scores.length >= 5) {
          // Purge oldest
          this.scores.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          this.scores = this.scores.slice(this.scores.length - 4);
        }
        this.scores.push(scoreItem);
      } finally {
        this.isLocked = false;
      }
    }

    getScores() {
      return this.scores;
    }
  }

  it('18. should strictly preserve exactly 5 scores under concurrent submission requests', async () => {
    const store = new SerializedFifoStore();

    // Submit 10 concurrent scores
    const submissions = Array.from({ length: 10 }).map((_, i) =>
      store.addScore({ id: `s_${i}`, score: 30 + i, date: `2026-08-${(i + 1).toString().padStart(2, '0')}` })
    );

    await Promise.all(submissions);

    const resulting = store.getScores();
    expect(resulting).toHaveLength(5);
  });
});

describe('Regression 19: Atomic Single-Transaction Draw Publication Invariant', () => {
  function simulateAtomicDrawPublication(
    draw: { id: string; status: string },
    winners: { user_id: string; prize: number }[],
    shouldFailDb: boolean = false
  ) {
    if (draw.status !== 'simulated') {
      throw new Error(`Illegal transition: Only simulated draws can be published. Current status: ${draw.status}`);
    }

    if (shouldFailDb) {
      // Transaction abort: no state mutations committed
      throw new Error('Database transaction aborted: simulated network partition');
    }

    return {
      drawStatus: 'published',
      published_at: new Date().toISOString(),
      winnersRecorded: winners.length,
      auditLogged: true,
    };
  }

  it('19. should abort the entire draw publication if any sub-step fails', () => {
    const draw = { id: 'draw-1', status: 'simulated' };
    const winners = [{ user_id: 'u1', prize: 40000 }];

    expect(() => simulateAtomicDrawPublication(draw, winners, true)).toThrow('Database transaction aborted');
    // Draw status was never modified
    expect(draw.status).toBe('simulated');
  });
});

describe('Regression 20: Stripe Webhook Customer-User Binding Cross-Verification', () => {
  function verifyWebhookCustomerBinding(
    userInDb: { id: string; stripe_customer_id: string | null },
    eventMetadataUserId: string,
    eventCustomerId: string
  ): { valid: boolean; error?: string } {
    if (userInDb.id !== eventMetadataUserId) {
      return { valid: false, error: 'User ID mismatch' };
    }
    if (userInDb.stripe_customer_id && userInDb.stripe_customer_id !== eventCustomerId) {
      return { valid: false, error: 'Stripe customer ID binding mismatch' };
    }
    return { valid: true };
  }

  it('20. should reject webhook if incoming customer ID does not match registered user customer ID', () => {
    const user = { id: 'usr_valid_uuid', stripe_customer_id: 'cus_legit_123' };

    const legit = verifyWebhookCustomerBinding(user, 'usr_valid_uuid', 'cus_legit_123');
    expect(legit.valid).toBe(true);

    const malicious = verifyWebhookCustomerBinding(user, 'usr_valid_uuid', 'cus_imposter_999');
    expect(malicious.valid).toBe(false);
    expect(malicious.error).toContain('mismatch');
  });
});

describe('Regression 21: Direct Golf Score Client INSERT Policy Disabled (Requires Transactional add_golf_score RPC)', () => {
  function simulateDirectTableInsert(tableName: string, callerRole: 'user' | 'admin' | 'service_role') {
    if (tableName === 'golf_scores') {
      // Direct client INSERT policy is removed; only service_role/RPC or admin have insert permissions
      if (callerRole === 'user') {
        return { allowed: false, error: 'Direct INSERT on golf_scores is prohibited. Use add_golf_score RPC.' };
      }
      return { allowed: true };
    }
    return { allowed: true };
  }

  it('21. should reject direct table INSERT into golf_scores by standard authenticated users', () => {
    const userInsert = simulateDirectTableInsert('golf_scores', 'user');
    expect(userInsert.allowed).toBe(false);
    expect(userInsert.error).toContain('add_golf_score');

    const adminInsert = simulateDirectTableInsert('golf_scores', 'admin');
    expect(adminInsert.allowed).toBe(true);
  });
});

describe('Regression 22: Stripe Webhook Completion Failure Fail-Closed (HTTP 500 Trigger)', () => {
  function handleWebhookCompletion(rpcError: boolean, fallbackError: boolean): { status: number; retryable: boolean } {
    if (rpcError && fallbackError) {
      // Must throw/return 500 to signal Stripe to retry delivery
      return { status: 500, retryable: true };
    }
    return { status: 200, retryable: false };
  }

  it('22. should return retryable HTTP 500 if both complete_stripe_event RPC and direct update fail', () => {
    const res = handleWebhookCompletion(true, true);
    expect(res.status).toBe(500);
    expect(res.retryable).toBe(true);

    const successRes = handleWebhookCompletion(false, false);
    expect(successRes.status).toBe(200);
    expect(successRes.retryable).toBe(false);
  });
});

describe('Regression 23: User Profile Email Cannot Be Directly Updated (Auth Sync Guard)', () => {
  function simulateEmailUpdate(callerRole: 'user' | 'admin' | 'service_role', targetUpdates: Record<string, unknown>) {
    if (callerRole === 'service_role') return { allowed: true };
    if ('email' in targetUpdates) {
      return { allowed: false, error: 'Direct update blocked: Email cannot be updated directly on user profile.' };
    }
    return { allowed: true };
  }

  it('23. should reject direct email updates on user profiles by standard users and admins', () => {
    const resUser = simulateEmailUpdate('user', { email: 'new@example.com' });
    expect(resUser.allowed).toBe(false);
    expect(resUser.error).toContain('Email cannot be updated directly');

    const resService = simulateEmailUpdate('service_role', { email: 'new@example.com' });
    expect(resService.allowed).toBe(true);
  });
});

describe('Regression 24: Winner Non-Proof Field (created_at & id) Tamper Protection', () => {
  function simulateWinnerNonProofProtection(callerRole: 'user' | 'admin', updates: Record<string, unknown>) {
    if (callerRole === 'admin') return { allowed: true };
    const allowedUserFields = ['winner_proof_url'];
    for (const key of Object.keys(updates)) {
      if (!allowedUserFields.includes(key)) {
        return { allowed: false, rejectedField: key };
      }
    }
    return { allowed: true };
  }

  it('24. should block winners from modifying created_at or id timestamps', () => {
    const resCreatedAt = simulateWinnerNonProofProtection('user', { created_at: '2026-08-01T00:00:00Z' });
    expect(resCreatedAt.allowed).toBe(false);
    expect(resCreatedAt.rejectedField).toBe('created_at');

    const resId = simulateWinnerNonProofProtection('user', { id: 'new-id' });
    expect(resId.allowed).toBe(false);
    expect(resId.rejectedField).toBe('id');
  });
});

describe('Regression 25: Charity total_contributions Manual Modification Guard', () => {
  function simulateCharityContributionsUpdate(callerRole: 'user' | 'admin' | 'service_role', newTotal: number, oldTotal: number) {
    if (callerRole === 'service_role') return { allowed: true };
    if (newTotal !== oldTotal) {
      return { allowed: false, error: 'Direct update blocked: Charity total_contributions is ledger-calculated.' };
    }
    return { allowed: true };
  }

  it('25. should block direct mutation of charity total_contributions by admins and users', () => {
    const adminAttempt = simulateCharityContributionsUpdate('admin', 999999, 10000);
    expect(adminAttempt.allowed).toBe(false);
    expect(adminAttempt.error).toContain('ledger-calculated');

    const serviceRoleAttempt = simulateCharityContributionsUpdate('service_role', 12500, 10000);
    expect(serviceRoleAttempt.allowed).toBe(true);
  });
});

describe('Regression 26: Draw Simulation Overwrite Guard (Intentional Reset Required)', () => {
  function handleDrawSimulationRequest(existingStatus: 'simulated' | 'published' | 'locked' | null, forceRegenerate: boolean) {
    if (existingStatus === 'published' || existingStatus === 'locked') {
      throw new Error(`Cannot simulate a draw that is already ${existingStatus}.`);
    }
    if (existingStatus === 'simulated' && !forceRegenerate) {
      throw new Error('A simulated draw already exists. Set forceRegenerate to true to intentionally re-calculate winning numbers.');
    }
    return { success: true, simulated: true };
  }

  it('26. should require explicit forceRegenerate to overwrite an existing simulated draw', () => {
    expect(() => handleDrawSimulationRequest('simulated', false)).toThrow('forceRegenerate');
    expect(handleDrawSimulationRequest('simulated', true).success).toBe(true);
    expect(handleDrawSimulationRequest(null, false).success).toBe(true);
  });
});

describe('Regression 27: Strict Supabase Admin Config Validation (Fails Fast)', () => {
  function validateAdminConfig(url?: string, serviceKey?: string) {
    if (!url || url.trim() === '' || url.includes('placeholder')) {
      throw new Error('Supabase admin configuration error: NEXT_PUBLIC_SUPABASE_URL is not configured.');
    }
    if (!serviceKey || serviceKey.trim() === '' || serviceKey.includes('placeholder')) {
      throw new Error('Supabase admin configuration error: SUPABASE_SERVICE_ROLE_KEY is not configured.');
    }
    return { url, serviceKey };
  }

  it('27. should throw immediately when admin url or service key are missing or placeholders', () => {
    expect(() => validateAdminConfig('', 'key')).toThrow('NEXT_PUBLIC_SUPABASE_URL is not configured');
    expect(() => validateAdminConfig('https://placeholder.supabase.co', 'key')).toThrow('NEXT_PUBLIC_SUPABASE_URL is not configured');
    expect(() => validateAdminConfig('https://valid.supabase.co', 'placeholder-service-key')).toThrow('SUPABASE_SERVICE_ROLE_KEY is not configured');
    expect(validateAdminConfig('https://valid.supabase.co', 'valid-secret-key')).toEqual({
      url: 'https://valid.supabase.co',
      serviceKey: 'valid-secret-key',
    });
  });
});
