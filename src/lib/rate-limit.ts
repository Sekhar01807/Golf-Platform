import { NextRequest, NextResponse } from 'next/server';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * Application-Level Sliding-Window Rate Limiter
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Architecture & Deployment Model:
 * --------------------------------
 * 1. Single-Instance / Containerized:
 *    Uses an in-memory `Map<string, number[]>` sliding-window store. Provides
 *    sub-millisecond zero-network latency without external dependencies.
 *    Optimal for single-node deployments, self-hosted Docker containers, and test suites.
 * 
 * 2. Distributed / Multi-Region Serverless (Production Roadmap):
 *    In multi-region serverless or auto-scaled environments (e.g., Vercel Edge / AWS Lambda),
 *    the rate limiter interface (`RateLimiterStore`) can be backed by a centralized
 *    Redis instance (e.g., Upstash Redis via REST API / sliding-window Lua scripts).
 * 
 * Features:
 * - Sliding-window timestamp eviction for smooth burst control (no boundary spikes)
 * - Granular per-endpoint key prefixing (`scores`, `checkout`, `donations`, `billing`)
 * - RFC-compliant response headers (`Retry-After`, `X-RateLimit-*`)
 * ══════════════════════════════════════════════════════════════════════════════
 */

export interface RateLimitOptions {
  limit?: number; // Maximum allowed requests in window (default: 10)
  windowMs?: number; // Window duration in milliseconds (default: 60,000ms = 1 min)
  keyPrefix?: string; // Namespace prefix for rate limit bucket
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTimeMs: number;
  retryAfterSeconds: number;
}

/**
 * Pluggable store interface supporting both in-memory and distributed backends (e.g. Redis)
 */
export interface RateLimiterStore {
  check(identifier: string, limit: number, windowMs: number, now?: number): RateLimitResult | Promise<RateLimitResult>;
  reset(identifier?: string): void | Promise<void>;
}

/**
 * In-memory sliding-window rate limiter implementation
 */
export class SlidingWindowRateLimiter implements RateLimiterStore {
  private requests: Map<string, number[]> = new Map();

  constructor(private defaultLimit = 10, private defaultWindowMs = 60000) {}

  /**
   * Evaluates if a request from the given identifier is permitted.
   */
  public check(
    identifier: string,
    limit: number = this.defaultLimit,
    windowMs: number = this.defaultWindowMs,
    now: number = Date.now()
  ): RateLimitResult {
    const windowStart = now - windowMs;
    const timestamps = this.requests.get(identifier) || [];

    // Filter out timestamps outside the sliding window
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= limit) {
      const oldestInWindow = validTimestamps[0];
      const resetTimeMs = oldestInWindow + windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));

      this.requests.set(identifier, validTimestamps);
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetTimeMs,
        retryAfterSeconds,
      };
    }

    // Add current request timestamp
    validTimestamps.push(now);
    this.requests.set(identifier, validTimestamps);

    const remaining = Math.max(0, limit - validTimestamps.length);
    const resetTimeMs = now + windowMs;

    return {
      allowed: true,
      limit,
      remaining,
      resetTimeMs,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Resets rate limit records (useful for testing or administrative resets).
   */
  public reset(identifier?: string): void {
    if (identifier) {
      this.requests.delete(identifier);
    } else {
      this.requests.clear();
    }
  }
}

// Global shared rate limiter instance
export const globalRateLimiter = new SlidingWindowRateLimiter();

/**
 * Extracts client IP or identifying header from incoming NextRequest.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Enforces rate limiting on a Next.js route handler.
 * Returns a 429 NextResponse if rate limit is exceeded, or null if allowed to proceed.
 */
export function enforceRateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): NextResponse | null {
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 60000;
  const prefix = options.keyPrefix ?? 'global';

  const ip = getClientIp(req);
  const key = `${prefix}:${ip}`;

  const result = globalRateLimiter.check(key, limit, windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please slow down and try again later.',
        retryAfter: result.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSeconds),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetTimeMs / 1000)),
        },
      }
    );
  }

  return null;
}
