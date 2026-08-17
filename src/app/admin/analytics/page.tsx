import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  await requireAdmin();

  const supabase = createAdminClient();

  // Metrics calculation
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const { count: activeSubscribers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('subscription_status', 'active');

  const monthlyRevenue = (activeSubscribers || 0) * 499;

  const { data: draws } = await supabase
    .from('draws')
    .select('draw_month, total_prize_pool, status')
    .order('draw_month', { ascending: false });

  const totalPool = (draws || []).reduce((sum, d) => sum + Number(d.total_prize_pool || 0), 0);

  const { data: charitiesData } = await supabase
    .from('charities')
    .select('name, total_contributions')
    .order('total_contributions', { ascending: false });

  const totalCharity = (charitiesData || []).reduce((sum, c) => sum + Number(c.total_contributions || 0), 0);

  const { count: totalEntries } = await supabase
    .from('draw_entries')
    .select('*', { count: 'exact', head: true });

  const metrics = [
    { label: 'Registered Members', value: (totalUsers || 0).toLocaleString('en-IN') },
    { label: 'Active Subscribers', value: (activeSubscribers || 0).toLocaleString('en-IN') },
    { label: 'Estimated Monthly ARR', value: `₹${(monthlyRevenue * 12).toLocaleString('en-IN')}` },
    { label: 'Total Prize Pools Funded', value: `₹${totalPool.toLocaleString('en-IN')}` },
    { label: 'Direct Charity Impact', value: `₹${totalCharity.toLocaleString('en-IN')}` },
    { label: 'Total Draw Score Entries', value: (totalEntries || 0).toLocaleString('en-IN') },
  ];

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          Platform Analytics & Impact Ledger
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
          High-level metrics across subscriber retention, fundraising volumes, and prize pool distributions.
        </p>
      </div>

      <div className="grid-3" style={{ marginBottom: 'var(--space-2xl)' }}>
        {metrics.map((m, i) => (
          <div key={i} className="card">
            <div className="stat-label">{m.label}</div>
            <div className="stat-value" style={{ marginTop: '4px' }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Charity Distribution Breakdown */}
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>
            Charity Contribution Ledger Distribution
          </h3>

          {!charitiesData || charitiesData.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>No charity data available.</p>
          ) : (
            charitiesData.map((c, i) => {
              const amount = Number(c.total_contributions || 0);
              const pct = totalCharity > 0 ? Math.round((amount / totalCharity) * 100) : 0;
              return (
                <div key={i} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>{c.name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                      ₹{amount.toLocaleString('en-IN')} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--color-bg-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: 'var(--color-primary)',
                        borderRadius: '4px',
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Draw History */}
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Draw Execution History</h3>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Prize Pool</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!draws || draws.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                      No draws executed yet.
                    </td>
                  </tr>
                ) : (
                  draws.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {new Date(d.draw_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                        ₹{Number(d.total_prize_pool).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            d.status === 'locked' ? 'badge-primary' : d.status === 'published' ? 'badge-active' : 'badge-pending'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
