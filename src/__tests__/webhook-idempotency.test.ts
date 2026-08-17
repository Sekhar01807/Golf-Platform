import { describe, it, expect } from 'vitest';

describe('Stripe Webhook Idempotency Pipeline', () => {
  class MockStripeEventStore {
    private processedEvents = new Set<string>();

    public processEvent(eventId: string, eventType: string): { processed: boolean; duplicate: boolean } {
      if (this.processedEvents.has(eventId)) {
        return { processed: false, duplicate: true };
      }

      this.processedEvents.add(eventId);
      return { processed: true, duplicate: false };
    }

    public isEventProcessed(eventId: string): boolean {
      return this.processedEvents.has(eventId);
    }
  }

  it('should process a first-time Stripe event', () => {
    const store = new MockStripeEventStore();
    const eventId = 'evt_test_checkout_12345';

    const result = store.processEvent(eventId, 'checkout.session.completed');
    expect(result.processed).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(store.isEventProcessed(eventId)).toBe(true);
  });

  it('should detect and suppress duplicate retried Stripe events', () => {
    const store = new MockStripeEventStore();
    const eventId = 'evt_test_checkout_99999';

    // First arrival
    const res1 = store.processEvent(eventId, 'customer.subscription.updated');
    expect(res1.processed).toBe(true);
    expect(res1.duplicate).toBe(false);

    // Second arrival (Stripe webhook retry)
    const res2 = store.processEvent(eventId, 'customer.subscription.updated');
    expect(res2.processed).toBe(false);
    expect(res2.duplicate).toBe(true);
  });
});
