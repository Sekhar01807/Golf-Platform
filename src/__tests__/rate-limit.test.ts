import { describe, it, expect, beforeEach } from 'vitest';
import { SlidingWindowRateLimiter, enforceRateLimit } from '../lib/rate-limit';
import { NextRequest } from 'next/server';

describe('Application-Level Rate Limiter (Sliding Window)', () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    limiter = new SlidingWindowRateLimiter(5, 60000); // 5 requests per 60 seconds
  });

  it('1. should allow requests within the defined threshold limit', () => {
    const ip = '192.168.1.10';
    const now = 1000000;

    for (let i = 1; i <= 5; i++) {
      const res = limiter.check(ip, 5, 60000, now + i * 100);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(5 - i);
    }
  });

  it('2. should throttle the 6th request with allowed = false and correct retryAfter calculation', () => {
    const ip = '192.168.1.20';
    const t0 = 1000000;

    // First 5 requests succeed
    for (let i = 0; i < 5; i++) {
      const res = limiter.check(ip, 5, 60000, t0 + i * 1000);
      expect(res.allowed).toBe(true);
    }

    // 6th request at t0 + 10s is blocked
    const t6 = t0 + 10000;
    const blockedRes = limiter.check(ip, 5, 60000, t6);

    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    // Reset happens 60s after the oldest request (t0 + 60s = 1060000). Remaining time is 50s.
    expect(blockedRes.retryAfterSeconds).toBe(50);
  });

  it('3. should slide the window and allow new requests once the oldest timestamp expires', () => {
    const ip = '192.168.1.30';
    const t0 = 1000000;

    // Perform 5 requests at t0
    for (let i = 0; i < 5; i++) {
      limiter.check(ip, 5, 60000, t0);
    }

    // At t0 + 30s: blocked
    expect(limiter.check(ip, 5, 60000, t0 + 30000).allowed).toBe(false);

    // At t0 + 61s: all 5 previous requests expired -> allowed again
    const postExpiryRes = limiter.check(ip, 5, 60000, t0 + 61000);
    expect(postExpiryRes.allowed).toBe(true);
    expect(postExpiryRes.remaining).toBe(4);
  });

  it('4. should isolate rate limits across different IP identifiers', () => {
    const ipA = '10.0.0.1';
    const ipB = '10.0.0.2';
    const now = 2000000;

    // Exhaust limit for IP A
    for (let i = 0; i < 5; i++) {
      limiter.check(ipA, 5, 60000, now);
    }
    expect(limiter.check(ipA, 5, 60000, now).allowed).toBe(false);

    // IP B is unaffected and permitted
    const resB = limiter.check(ipB, 5, 60000, now);
    expect(resB.allowed).toBe(true);
    expect(resB.remaining).toBe(4);
  });

  it('5. enforceRateLimit helper should return HTTP 429 response with RFC headers when limit is exceeded', () => {
    const fakeReq = new NextRequest('http://localhost:3000/api/scores', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.50',
      },
    });

    // Make 10 permitted calls
    for (let i = 0; i < 10; i++) {
      const allowed = enforceRateLimit(fakeReq, { limit: 10, windowMs: 60000, keyPrefix: 'test-endpoint' });
      expect(allowed).toBeNull();
    }

    // 11th call exceeds threshold and returns 429
    const blockedResponse = enforceRateLimit(fakeReq, { limit: 10, windowMs: 60000, keyPrefix: 'test-endpoint' });
    expect(blockedResponse).not.toBeNull();
    expect(blockedResponse?.status).toBe(429);
    expect(blockedResponse?.headers.get('Retry-After')).toBeDefined();
    expect(blockedResponse?.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(blockedResponse?.headers.get('X-RateLimit-Remaining')).toBe('0');
  });
});
