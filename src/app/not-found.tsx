'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo/Logo';

export default function NotFound() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(6);
  const [autoRedirect, setAutoRedirect] = useState(true);

  useEffect(() => {
    if (!autoRedirect) return;

    if (countdown <= 1) {
      router.push('/');
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, autoRedirect, router]);

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        background: 'var(--gradient-subtle, #F7F8F5)',
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          width: '100%',
          background: 'var(--color-bg-card, #FFFFFF)',
          border: '1px solid var(--color-border, #E3E8E3)',
          borderRadius: 'var(--radius-xl, 16px)',
          padding: '3rem 2rem',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.06))',
        }}
      >
        {/* Flag Icon / Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <Logo size={64} />
        </div>

        <div
          style={{
            display: 'inline-block',
            fontSize: '0.85rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-accent, #D4A84F)',
            marginBottom: '0.5rem',
          }}
        >
          Error 404 • Out of Bounds
        </div>

        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: 'var(--color-text-primary, #18231C)',
            margin: '0 0 1rem 0',
            lineHeight: 1.2,
          }}
        >
          Page Not Found
        </h1>

        <p
          style={{
            color: 'var(--color-text-secondary, #58655B)',
            fontSize: '1rem',
            lineHeight: 1.6,
            marginBottom: '1.75rem',
          }}
        >
          Looks like this shot landed in the deep rough! The page you are looking for has been moved, renamed, or doesn't exist.
        </p>

        {/* Auto-redirect alert & cancel */}
        {autoRedirect ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--color-bg-elevated, #EFF2EC)',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-full, 9999px)',
              fontSize: '0.85rem',
              color: 'var(--color-text-secondary, #58655B)',
              marginBottom: '2rem',
            }}
          >
            <span>Redirecting to home in <strong>{countdown}s</strong></span>
            <button
              onClick={() => setAutoRedirect(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary, #214E34)',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
                fontSize: '0.85rem',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div
            style={{
              fontSize: '0.85rem',
              color: 'var(--color-text-muted, #839086)',
              marginBottom: '2rem',
            }}
          >
            Auto-redirect paused.
          </div>
        )}

        {/* Navigation Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            justifyContent: 'center',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--color-primary, #214E34)',
              color: '#FFFFFF',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background var(--transition-fast, 150ms ease)',
            }}
          >
            Return to Fairway (Home)
          </Link>

          <Link
            href="/charities"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--color-bg-surface, #F0F3EE)',
              border: '1px solid var(--color-border, #E3E8E3)',
              color: 'var(--color-text-primary, #18231C)',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background var(--transition-fast, 150ms ease)',
            }}
          >
            Browse Partner Charities
          </Link>
        </div>
      </div>
    </div>
  );
}
