import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard — GolfForGood',
};

export default async function DashboardOverview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let subscriptionStatus = 'inactive';
  let scoresCount = 0;
  let totalWon = 0;
  let userName = 'Golfer';

  if (user) {
    // Fetch user profile
    const { data: profile } = await supabase
      .from('users')
      .select('full_name, subscription_status')
      .eq('id', user.id)
      .single();

    if (profile) {
      userName = profile.full_name || user.email?.split('@')[0] || 'Golfer';
      subscriptionStatus = profile.subscription_status || 'inactive';
    }

    // Count scores
    const { count } = await supabase
      .from('golf_scores')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    scoresCount = count || 0;

    // Sum winnings
    const { data: winnings } = await supabase
      .from('draw_winners')
      .select('prize_amount')
      .eq('user_id', user.id);

    totalWon = winnings?.reduce((sum, w) => sum + Number(w.prize_amount), 0) || 0;
  }

  // Fetch recent scores
  const { data: recentScores } = user
    ? await supabase
        .from('golf_scores')
        .select('score, date_played')
        .eq('user_id', user.id)
        .order('date_played', { ascending: false })
        .limit(5)
    : { data: [] };

  // Next draw
  const { data: nextDraw } = await supabase
    .from('draws')
    .select('draw_month, status')
    .order('draw_month', { ascending: false })
    .limit(1);

  const nextDrawLabel = nextDraw?.[0]
    ? new Date(nextDraw[0].draw_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : 'Upcoming';

  const stats = [
    {
      label: 'Membership',
      value: subscriptionStatus === 'active' ? 'Active' : subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1),
      badge: subscriptionStatus === 'active' ? 'badge-active' : 'badge-inactive',
    },
    {
      label: 'Scores Logged',
      value: `${scoresCount} / 5`,
      badge: scoresCount >= 5 ? 'badge-active' : 'badge-accent',
    },
    {
      label: 'Next Prize Draw',
      value: nextDrawLabel,
      badge: 'badge-pending',
    },
    {
      label: 'Total Winnings',
      value: `₹${totalWon.toLocaleString('en-IN')}`,
      badge: totalWon > 0 ? 'badge-active' : 'badge-primary',
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Good day, {userName} 👋</h1>
        <p className={styles.pageSubtitle}>Track your golf performance and your charitable contributions.</p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-2xl)' }}>
        {stats.map((stat, i) => (
          <div key={i} className="card">
            <div className="stat-label">{stat.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-sm)' }}>
              <span className="stat-value" style={{ fontSize: '1.6rem' }}>{stat.value}</span>
              <span className={`badge ${stat.badge}`}>
                {stat.badge === 'badge-active' ? 'Active' : stat.badge === 'badge-pending' ? 'Eligible' : 'Info'}
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
                      <span className="badge badge-active">Active in Draw</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)' }}>
                    No scores recorded yet. Click &quot;Enter New Score&quot; to log your first round.
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
          <div className={styles.quickLinkIcon}>📝</div>
          <h4 className={styles.quickLinkTitle}>Enter Score</h4>
          <p className={styles.quickLinkDesc}>Log a new 18-hole Stableford round</p>
        </Link>
        <Link href="/dashboard/charity" className={styles.quickLinkCard}>
          <div className={styles.quickLinkIcon}>💚</div>
          <h4 className={styles.quickLinkTitle}>My Charity</h4>
          <p className={styles.quickLinkDesc}>Adjust your percentage & supported cause</p>
        </Link>
        <Link href="/dashboard/draws" className={styles.quickLinkCard}>
          <div className={styles.quickLinkIcon}>🎰</div>
          <h4 className={styles.quickLinkTitle}>Next Draw</h4>
          <p className={styles.quickLinkDesc}>Check eligible numbers & jackpot pool</p>
        </Link>
      </div>
    </div>
  );
}
