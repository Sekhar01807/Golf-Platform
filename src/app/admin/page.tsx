import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Admin Overview — GolfForGood',
};

export default async function AdminOverview() {
  // Enforces server-side administrator verification
  await requireAdmin();

  const supabase = createAdminClient();

  // Fetch aggregate counts
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const { count: activeSubscriptions } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('subscription_status', 'active');

  // Latest draw
  const { data: latestDraw } = await supabase
    .from('draws')
    .select('id, total_prize_pool, draw_month, status, winning_numbers')
    .order('draw_month', { ascending: false })
    .limit(1);

  const prizePool = latestDraw?.[0]?.total_prize_pool || 0;
  const drawMonth = latestDraw?.[0]?.draw_month
    ? new Date(latestDraw[0].draw_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'No active draw';
  const drawStatus = latestDraw?.[0]?.status || 'N/A';

  // Total charity contributions
  const { data: charityTotals } = await supabase
    .from('charities')
    .select('total_contributions');

  const totalCharity = (charityTotals || []).reduce((sum, c) => sum + Number(c.total_contributions || 0), 0);

  // Pending winner verifications
  const { count: pendingVerifications } = await supabase
    .from('draw_winners')
    .select('*', { count: 'exact', head: true })
    .eq('verification_status', 'pending');

  // Recent audit logs
  const { data: recentAuditLogs } = await supabase
    .from('audit_logs')
    .select('id, action, target_type, target_id, created_at, actor_id, users(email)')
    .order('created_at', { ascending: false })
    .limit(5);

  const stats = [
    { label: 'Total Registered Members', value: (totalUsers || 0).toLocaleString('en-IN') },
    { label: 'Active Subscriptions', value: (activeSubscriptions || 0).toLocaleString('en-IN') },
    { label: 'Active Prize Pool', value: `₹${Number(prizePool).toLocaleString('en-IN')}` },
    { label: 'Total Charity Raised', value: `₹${totalCharity.toLocaleString('en-IN')}` },
  ];

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          Platform Administration
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
          System health, membership metrics, draw status, and operational audit trail.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-2xl)' }}>
        {stats.map((stat, i) => (
          <div key={i} className="card">
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value" style={{ marginTop: '6px' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-2xl)' }}>
        {/* Draw Status Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Current Draw Engine Status</h3>
            <span
              className={`badge ${
                drawStatus === 'published' ? 'badge-active' : drawStatus === 'locked' ? 'badge-primary' : 'badge-pending'
              }`}
            >
              {drawStatus}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Draw Period</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{drawMonth}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Active Subscriber Pool</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{(activeSubscriptions || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Allocated Prize Pool</span>
              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>₹{Number(prizePool).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <Link href="/admin/draws" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
              Manage Draw Engine →
            </Link>
          </div>
        </div>

        {/* Verification Queue Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Winner Scorecard Reviews</h3>
            <span className={`badge ${pendingVerifications && pendingVerifications > 0 ? 'badge-pending' : 'badge-active'}`}>
              {pendingVerifications || 0} Pending
            </span>
          </div>

          <div className="stat-value" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
            {pendingVerifications || 0}
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Winner scorecards awaiting manual scorecard verification before payouts can be issued.
          </p>

          <Link href="/admin/winners" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
            Review Winner Proofs →
          </Link>
        </div>
      </div>

      {/* Audit Log Trail */}
      <div className="card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem' }}>Recent Administrative Actions (Audit Trail)</h3>
        
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Target Type</th>
                <th>Target ID</th>
              </tr>
            </thead>
            <tbody>
              {recentAuditLogs && recentAuditLogs.length > 0 ? (
                recentAuditLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      {new Date(log.created_at).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className="badge badge-primary">{log.action}</span>
                    </td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--color-text-secondary)' }}>
                      {log.target_type}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      {log.target_id || '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                    No administrative audit records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
