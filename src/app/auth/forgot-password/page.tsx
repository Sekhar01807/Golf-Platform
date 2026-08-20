'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo/Logo';
import styles from '../auth.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/dashboard/settings`
        : undefined;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError('Network error sending password recovery email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className={styles.authPage}>
        <div className={styles.authCard}>
          <div className={styles.authBadge}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"></rect>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L1 7"></path>
            </svg>
          </div>
          <h1>Password Reset Email Sent</h1>
          <p>
            If an account exists for <strong>{email}</strong>, we have dispatched a secure password reset link. Please check your inbox and spam folder.
          </p>
          <Link href="/auth/login" className="btn btn-primary" style={{ width: '100%', textAlign: 'center', marginTop: '1rem' }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div style={{ display: 'inline-flex', marginBottom: '1rem' }}>
            <Logo size={52} />
          </div>
          <h1>Reset Password</h1>
          <p>Enter your account email to receive a recovery link</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleResetRequest} className={styles.authForm}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@domain.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: 'var(--space-sm)' }}
          >
            {loading ? 'Sending Recovery Link...' : 'Send Recovery Email'}
          </button>
        </form>

        <p className={styles.authFooter}>
          Remember your password?{' '}
          <Link href="/auth/login">Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
