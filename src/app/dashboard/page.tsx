import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import Link from 'next/link';
import { ScorecardIcon, HeartIcon, TicketIcon, CrownIcon, CreditCardIcon } from '@/components/Icons/Icons';
import { getMembershipDetails } from '@/lib/utils/subscription';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Dashboard — GolfForGood',
};

export default async function DashboardOverview({
  searchParams,
}: {
  searchParams?: Promise<{ subscription?: string; session_id?: string; cancelled?: string }> | { subscription?: string; session_id?: string; cancelled?: string };
}) {
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : undefined;
  const isSubscriptionSuccess = resolvedParams?.subscription === 'success';
  const isCancelled = resolvedParams?.cancelled === 'true';
  const sessionId = resolvedParams?.session_id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let scoresCount = 0;
  let totalWon = 0;
  let userName = 'Golfer';
  let recentScores: any[] = [];
  let membership = getMembershipDetails({
    status: 'inactive',
    plan: null,
    endDate: null,
  });

  if (user) {
    if (isCancelled) {
      // Clear checkout lock so user can retry anytime
      try {
        const adminDb = createAdminClient();
        await adminDb.from('users').update({ checkout_lock_until: null }).eq('id', user.id);
      } catch {}
    }
    // If returning from checkout with success flag, ensure profile is actively synchronized immediately
    if (isSubscriptionSuccess) {
      try {
        const adminDb = createAdminClient();
        const stripe = getStripe();
        let session = null;

        if (sessionId) {
          session = await stripe.checkout.sessions.retrieve(sessionId);
        } else {
          const { data: userRecord } = await adminDb
            .from('users')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();

          if (userRecord?.stripe_customer_id) {
            const sessions = await stripe.checkout.sessions.list({
              customer: userRecord.stripe_customer_id,
              limit: 1,
            });
            if (sessions.data.length > 0) {
              session = sessions.data[0];
            }
          }
        }

        if (session && (session.payment_status === 'paid' || session.status === 'complete')) {
          const plan = (session.metadata?.plan === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly';
          const customerId = typeof session.customer === 'string' ? session.customer : null;
          const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

          let endDate: string | null = null;
          let startDate: string = new Date().toISOString();

          if (subscriptionId) {
            try {
              const subObj = await stripe.subscriptions.retrieve(subscriptionId);
              if ((subObj as any).current_period_end) {
                endDate = new Date((subObj as any).current_period_end * 1000).toISOString();
              }
              if ((subObj as any).current_period_start) {
                startDate = new Date((subObj as any).current_period_start * 1000).toISOString();
              }
            } catch {
              // Graceful fallback
            }
          }

          if (!endDate) {
            const defaultDays = plan === 'yearly' ? 365 : 30;
            const d = new Date();
            d.setDate(d.getDate() + defaultDays);
            endDate = d.toISOString();
          }

          await adminDb.from('users').update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            subscription_plan: plan,
            subscription_start_date: startDate,
            subscription_end_date: endDate,
            checkout_lock_until: null,
          }).eq('id', user.id);
        }
      } catch {
        // Fallback to standard DB read
      }
    }

    // Fetch user profile with live subscription fields via authenticated user client
    const { data: profile } = await supabase
      .from('users')
      .select('full_name, subscription_status, subscription_plan, subscription_end_date')
      .eq('id', user.id)
      .single();

    if (profile) {
      userName = profile.full_name || user.email?.split('@')[0] || 'Golfer';
      membership = getMembershipDetails({
        status: profile.subscription_status || 'inactive',
        plan: profile.subscription_plan || null,
        endDate: profile.subscription_end_date || null,
      });
    }

    // Count scores via authenticated client (RLS policy: Users read own scores)
    const { count, error: countErr } = await supabase
      .from('golf_scores')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (!countErr && count !== null && count !== undefined) {
      scoresCount = count;
    }

    // Sum winnings via authenticated client (RLS policy: Users read own winnings)
    const { data: winnings, error: winErr } = await supabase
      .from('draw_winners')
      .select('prize_amount')
      .eq('user_id', user.id);

    if (!winErr && winnings) {
      totalWon = winnings.reduce((sum, w) => sum + Number(w.prize_amount || 0), 0);
    }

    // Fetch recent scores via authenticated client
    const { data: scores, error: scoresErr } = await supabase
      .from('golf_scores')
      .select('score, date_played')
      .eq('user_id', user.id)
      .order('date_played', { ascending: false })
      .limit(5);

    if (!scoresErr && scores) {
      recentScores = scores;
    }
  }

  const stats = [
    {
      label: 'Membership Tier',
      value: membership.isPremium ? (membership.label.includes('Annual') ? 'Annual Pass' : 'Monthly Pass') : 'Free Golfer',
      badgeClass: membership.badgeClass,
      badgeText: membership.isPremium ? 'Active Premium' : membership.label,
      badgeStyle: membership.badgeStyle,
    },
    {
      label: 'Active 18-Hole Scores',
      value: `${scoresCount} / 5`,
      badgeClass: scoresCount >= 5 ? 'badge-active' : 'badge-pending',
      badgeText: scoresCount >= 5 ? 'Draw Ready' : 'Need 5 to Enter',
    },
    {
      label: 'Monthly Draw Status',
      value: membership.isPremium && scoresCount >= 5 ? 'Eligible' : 'Action Required',
      badgeClass: membership.isPremium && scoresCount >= 5 ? 'badge-active' : 'badge-inactive',
      badgeText: membership.isPremium ? (scoresCount >= 5 ? 'Draw Ready' : 'Log Scores') : 'Subscribe',
    },
    {
      label: 'Career Prize Winnings',
      value: `₹${totalWon.toLocaleString('en-IN')}`,
      badgeClass: totalWon > 0 ? 'badge-active' : 'badge-inactive',
      badgeText: totalWon > 0 ? 'Won' : 'No Claims',
    },
  ];

  return (
    <div>
      {isSubscriptionSuccess && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(46, 125, 90, 0.12)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-xl)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--color-text-primary)',
            fontSize: '0.95rem',
            fontWeight: 500,
          }}
        >
          <CrownIcon size={20} color="var(--color-success)" />
          <span>Welcome to GolfForGood Premium! Your membership is active. You can now log your Stableford rounds and participate in the monthly prize draws.</span>
        </div>
      )}

      {isCancelled && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(212, 168, 79, 0.12)',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-xl)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--color-text-primary)',
            fontSize: '0.95rem',
            fontWeight: 500,
          }}
        >
          <CreditCardIcon size={20} color="var(--color-accent)" />
          <span>Checkout was cancelled. No charges were made. You can resume your subscription whenever you&apos;re ready.</span>
        </div>
      )}

      <div className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 className={styles.pageTitle}>Good day, {userName}</h1>
          <span className="badge" style={membership.badgeStyle}>
            {membership.isPremium && <CrownIcon size={14} color="#D4A84F" style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
            {membership.label}
          </span>
        </div>
        <p className={styles.pageSubtitle}>Track your golf performance and your charitable contributions.</p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-2xl)' }}>
        {stats.map((stat, i) => (
          <div key={i} className="card">
            <div className="stat-label">{stat.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-sm)' }}>
              <span className="stat-value" style={{ fontSize: '1.45rem' }}>{stat.value}</span>
              <span className={`badge ${stat.badgeClass}`} style={stat.badgeStyle}>
                {stat.badgeText}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Scores Table */}
      <div className="card" style={{ marginBottom: 'var(--space-2xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Recent Stableford Scores</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Your 5 newest scores form your entry in the monthly prize draw.
            </p>
          </div>
          <Link href="/dashboard/scores" className="btn btn-secondary btn-sm">
            + Enter New Score
          </Link>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Date Played</th>
                <th>Stableford Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentScores && recentScores.length > 0 ? (
                recentScores.map((s, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {new Date(s.date_played).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1.05rem' }}>
                      {s.score} pts
                    </td>
                    <td>
                      <span className="badge badge-active">Verified</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-xl)' }}>
                    No scores logged yet. <Link href="/dashboard/scores" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Enter your first round</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Quick Links Grid (Clean Next.js Links) */}
      <div className="grid-3">
        <Link href="/dashboard/scores" className={styles.quickLinkCard}>
          <div className={styles.quickLinkIcon} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ScorecardIcon size={24} color="var(--color-primary)" />
          </div>
          <h4 className={styles.quickLinkTitle}>Enter Score</h4>
          <p className={styles.quickLinkDesc}>Log a new 18-hole Stableford round</p>
        </Link>
        <Link href="/dashboard/charity" className={styles.quickLinkCard}>
          <div className={styles.quickLinkIcon} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HeartIcon size={24} color="var(--color-primary)" />
          </div>
          <h4 className={styles.quickLinkTitle}>My Charity</h4>
          <p className={styles.quickLinkDesc}>Adjust your percentage & supported cause</p>
        </Link>
        <Link href="/dashboard/draws" className={styles.quickLinkCard}>
          <div className={styles.quickLinkIcon} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TicketIcon size={24} color="var(--color-primary)" />
          </div>
          <h4 className={styles.quickLinkTitle}>Next Draw</h4>
          <p className={styles.quickLinkDesc}>Check eligible numbers & jackpot pool</p>
        </Link>
      </div>
    </div>
  );
}
