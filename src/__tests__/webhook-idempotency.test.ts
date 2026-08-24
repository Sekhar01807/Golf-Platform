import { describe, it, expect } from 'vitest';

describe('Stateful Stripe Webhook Idempotency & Financial Correctness Pipeline', () => {
  type EventStatus = 'processing' | 'completed' | 'failed';

  interface StoredEvent {
    id: string;
    eventType: string;
    status: EventStatus;
    createdAt: Date;
    processedAt?: Date;
  }

  class StatefulStripeEventStore {
    private events = new Map<string, StoredEvent>();

    public claimEvent(eventId: string, eventType: string, now: Date = new Date()): { claimStatus: 'CLAIMED' | 'DUPLICATE_COMPLETED' | 'IN_FLIGHT' } {
      const existing = this.events.get(eventId);

      if (existing) {
        if (existing.status === 'completed') {
          return { claimStatus: 'DUPLICATE_COMPLETED' };
        }

        const isRecent = (now.getTime() - existing.createdAt.getTime()) < 300000;
        if (existing.status === 'processing' && isRecent) {
          return { claimStatus: 'IN_FLIGHT' };
        }

        // Stale or failed attempt (> 300s): re-claim for retry
        existing.status = 'processing';
        existing.createdAt = now;
        return { claimStatus: 'CLAIMED' };
      }

      this.events.set(eventId, {
        id: eventId,
        eventType,
        status: 'processing',
        createdAt: now,
      });

      return { claimStatus: 'CLAIMED' };
    }

    public completeEvent(eventId: string, now: Date = new Date()): void {
      const event = this.events.get(eventId);
      if (event) {
        event.status = 'completed';
        event.processedAt = now;
      }
    }

    public failEvent(eventId: string): void {
      const event = this.events.get(eventId);
      if (event) {
        event.status = 'failed';
      }
    }

    public getEvent(eventId: string): StoredEvent | undefined {
      return this.events.get(eventId);
    }
  }

  it('1. should process a fresh Stripe event and mark it completed after business execution', () => {
    const store = new StatefulStripeEventStore();
    const eventId = 'evt_test_checkout_12345';

    const claim = store.claimEvent(eventId, 'checkout.session.completed');
    expect(claim.claimStatus).toBe('CLAIMED');
    expect(store.getEvent(eventId)?.status).toBe('processing');

    // Simulate successful business logic execution
    store.completeEvent(eventId);
    expect(store.getEvent(eventId)?.status).toBe('completed');
    expect(store.getEvent(eventId)?.processedAt).toBeDefined();
  });

  it('2. should recognize completed events on retry and return DUPLICATE_COMPLETED', () => {
    const store = new StatefulStripeEventStore();
    const eventId = 'evt_test_checkout_99999';

    // First successful delivery
    const claim1 = store.claimEvent(eventId, 'customer.subscription.updated');
    expect(claim1.claimStatus).toBe('CLAIMED');
    store.completeEvent(eventId);

    // Second arrival (Stripe webhook retry)
    const claim2 = store.claimEvent(eventId, 'customer.subscription.updated');
    expect(claim2.claimStatus).toBe('DUPLICATE_COMPLETED');
  });

  it('3. should NOT treat an event as completed duplicate if the business logic failed, enabling successful retry', () => {
    const store = new StatefulStripeEventStore();
    const eventId = 'evt_transient_failure_555';
    let databaseOnline = false;

    // Delivery 1: DB is temporarily down, business logic throws
    const claim1 = store.claimEvent(eventId, 'checkout.session.completed');
    expect(claim1.claimStatus).toBe('CLAIMED');

    // Business operation fails due to transient DB error
    try {
      if (!databaseOnline) {
        throw new Error('Connection refused to database');
      }
      store.completeEvent(eventId);
    } catch {
      // Catch handler marks event as failed and returns 500 to Stripe
      store.failEvent(eventId);
    }

    expect(store.getEvent(eventId)?.status).toBe('failed');

    // Delivery 2: Stripe retries the same event after backoff, DB is now online
    databaseOnline = true;
    const retryClaim = store.claimEvent(eventId, 'checkout.session.completed');
    expect(retryClaim.claimStatus).toBe('CLAIMED'); // Crucial: NOT treated as duplicate!

    // Business logic succeeds on retry
    if (databaseOnline) {
      store.completeEvent(eventId);
    }

    expect(store.getEvent(eventId)?.status).toBe('completed');

    // Delivery 3: Subsequent retry after completion is now recognized as duplicate
    const postCompleteClaim = store.claimEvent(eventId, 'checkout.session.completed');
    expect(postCompleteClaim.claimStatus).toBe('DUPLICATE_COMPLETED');
  });

  it('4. should fail closed when database idempotency claim encounters an error', () => {
    function evaluateWebhookInsertResult(err: { code?: string } | null) {
      if (!err) return { status: 200, proceed: true };
      if (err.code === '23505') return { status: 200, duplicate: true, proceed: false };
      return { status: 500, error: 'Database idempotency claim failed', proceed: false };
    }

    expect(evaluateWebhookInsertResult(null).proceed).toBe(true);
    expect(evaluateWebhookInsertResult({ code: '23505' }).duplicate).toBe(true);
    expect(evaluateWebhookInsertResult({ code: '40001' }).status).toBe(500); // Serialization failure
    expect(evaluateWebhookInsertResult({ code: '08006' }).status).toBe(500); // Connection failure
  });

  it('5. should fail closed and throw if any database update returns an error in webhook handlers', () => {
    function handleSubscriptionUpdate(updateResult: { error: { message: string } | null }) {
      if (updateResult.error) {
        throw new Error(`Failed to update subscription in database: ${updateResult.error.message}`);
      }
      return { success: true };
    }

    expect(() => handleSubscriptionUpdate({ error: { message: 'relation users does not exist' } }))
      .toThrow('Failed to update subscription in database');

    expect(handleSubscriptionUpdate({ error: null }).success).toBe(true);
  });

  it('6. should fail closed with status 500 when completion update fails after business processing', () => {
    function finalizeStripeEvent(rpcErr: Error | null): { status: number } {
      if (rpcErr) {
        // Must throw to fail closed and trigger Stripe retry
        throw new Error(`Failed to record stripe event completion: ${rpcErr.message}`);
      }
      return { status: 200 };
    }

    expect(() => finalizeStripeEvent(new Error('RPC failed')))
      .toThrow('Failed to record stripe event completion');
    expect(finalizeStripeEvent(null).status).toBe(200);
  });

  it('7. should protect concurrent in-flight re-processing for up to 300 seconds (5 minutes)', () => {
    const store = new StatefulStripeEventStore();
    const eventId = 'evt_long_running_financial_op';
    const t0 = new Date('2026-08-19T00:00:00Z');

    const claim1 = store.claimEvent(eventId, 'checkout.session.completed', t0);
    expect(claim1.claimStatus).toBe('CLAIMED');

    // Concurrently delivered 120 seconds later (within 300s window)
    const t120 = new Date('2026-08-19T00:02:00Z');
    const claim2 = store.claimEvent(eventId, 'checkout.session.completed', t120);
    expect(claim2.claimStatus).toBe('IN_FLIGHT');

    // Stale delivery 301 seconds later (past 300s window) -> reclaimable for retry
    const t301 = new Date('2026-08-19T00:05:01Z');
    const claim3 = store.claimEvent(eventId, 'checkout.session.completed', t301);
    expect(claim3.claimStatus).toBe('CLAIMED');
  });

  it('8. should enforce stripe_payment_id uniqueness for donations and prevent double-incrementing', () => {
    const donationLedger = new Map<string, { id: string; amount: number; charityId: string }>();
    const charityBalances = new Map<string, number>([['charity-1', 10000]]);

    function recordDonation(paymentId: string, charityId: string, amount: number): string {
      const existing = donationLedger.get(paymentId);
      if (existing) {
        // Idempotent: return existing record without double-incrementing
        return existing.id;
      }
      const newId = `don_${Date.now()}`;
      donationLedger.set(paymentId, { id: newId, amount, charityId });
      const current = charityBalances.get(charityId) || 0;
      charityBalances.set(charityId, current + amount);
      return newId;
    }

    const donId1 = recordDonation('pi_stripe_123', 'charity-1', 2500);
    expect(charityBalances.get('charity-1')).toBe(12500);

    // Duplicate webhook with same Stripe payment ID
    const donId2 = recordDonation('pi_stripe_123', 'charity-1', 2500);
    expect(donId2).toBe(donId1);
    // Balance remains exactly 12500, NOT 15000!
    expect(charityBalances.get('charity-1')).toBe(12500);
  });
});
