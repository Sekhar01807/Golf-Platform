'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast/Toast';

export default function AdminDrawsPage() {
  const { showToast } = useToast();
  const [draws, setDraws] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  useEffect(() => {
    fetchDraws();
  }, []);

  const fetchDraws = async () => {
    try {
      const res = await fetch('/api/admin/draws');
      if (res.ok) {
        const data = await res.json();
        setDraws(data || []);
      }
    } catch {
      showToast('Network error fetching draws', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      const res = await fetch('/api/admin/draws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate', drawMonth: currentMonth, drawLogic: 'random' }),
      });

      const data = await res.json();
      if (res.ok) {
        setSimulationResult(data);
        showToast(`Draw simulated with ${data.winners?.length || 0} winners!`, 'success');
        await fetchDraws();
      } else {
        showToast(data.error || 'Failed to simulate draw', 'error');
      }
    } catch {
      showToast('Network error during simulation', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const handlePublish = async (drawId: string) => {
    if (!confirm('Are you sure you want to publish this draw? Published draws generate winner payout records.')) return;

    setPublishing(true);
    try {
      const res = await fetch('/api/admin/draws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', drawId }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Draw published! Generated ${data.winnersCount} winner records.`, 'success');
        await fetchDraws();
      } else {
        showToast(data.error || 'Failed to publish draw', 'error');
      }
    } catch {
      showToast('Network error publishing draw', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleLock = async (drawId: string) => {
    if (!confirm('Locking a draw makes all winning numbers, tiers, and allocations permanently immutable. Proceed?')) return;

    try {
      const res = await fetch('/api/admin/draws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock', drawId }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Draw successfully locked into permanent immutable status.', 'success');
        await fetchDraws();
      } else {
        showToast(data.error || 'Failed to lock draw', 'error');
      }
    } catch {
      showToast('Network error locking draw', 'error');
    }
  };

  const latestDraw = draws?.[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2xl)', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            Draw Engine & Prize Allocation
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
            Execute deterministic/random draw calculations, inspect tier allocations, and publish immutable results.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSimulate} disabled={simulating}>
          {simulating ? 'Simulating...' : '🎲 Run Monthly Draw Simulation'}
        </button>
      </div>

      {/* Simulation Result Modal/Card */}
      {simulationResult && (
        <div className="card" style={{ marginBottom: 'var(--space-2xl)', border: '1px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Simulation Results — {new Date(simulationResult.drawMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setSimulationResult(null)}>
              ✕ Close
            </button>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <div className="stat-label" style={{ marginBottom: '0.4rem' }}>Generated Winning Numbers</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {simulationResult.winningNumbers.map((n: number, i: number) => (
                <div
                  key={i}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>

          {/* Tier breakdown */}
          <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>5-Match Jackpot (40%)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                ₹{simulationResult.prizeBreakdown.tier5Match.poolShare.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {simulationResult.prizeBreakdown.tier5Match.count} winner(s) · ₹{simulationResult.prizeBreakdown.tier5Match.individualPrize.toLocaleString('en-IN')} each
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>4-Match Tier (35%)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                ₹{simulationResult.prizeBreakdown.tier4Match.poolShare.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {simulationResult.prizeBreakdown.tier4Match.count} winner(s) · ₹{simulationResult.prizeBreakdown.tier4Match.individualPrize.toLocaleString('en-IN')} each
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>3-Match Tier (25%)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                ₹{simulationResult.prizeBreakdown.tier3Match.poolShare.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {simulationResult.prizeBreakdown.tier3Match.count} winner(s) · ₹{simulationResult.prizeBreakdown.tier3Match.individualPrize.toLocaleString('en-IN')} each
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handlePublish(simulationResult.drawId)}
              disabled={publishing}
            >
              {publishing ? 'Publishing...' : 'Publish & Finalize Winners'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleSimulate}>
              Re-Roll Simulation
            </button>
          </div>
        </div>
      )}

      {/* Draw History Table */}
      <div className="card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
          Historical Draws & State Lifecycle
        </h3>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Status</th>
                <th>Winning Numbers</th>
                <th>Prize Pool</th>
                <th>Logic Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)' }}>
                    Loading draws...
                  </td>
                </tr>
              ) : draws.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    No draws created yet. Run a simulation above to create this month&apos;s draw.
                  </td>
                </tr>
              ) : (
                draws.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {new Date(d.draw_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          d.status === 'locked' ? 'badge-primary' : d.status === 'published' ? 'badge-active' : 'badge-pending'
                        }`}
                      >
                        {d.status === 'locked' ? '🔒 Locked' : d.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {(d.winning_numbers || []).map((n: number, i: number) => (
                          <span
                            key={i}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: 'var(--color-primary-subtle)',
                              color: 'var(--color-primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                      ₹{Number(d.total_prize_pool || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--color-text-secondary)' }}>
                      {d.draw_logic}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {d.status === 'simulated' && (
                          <button className="btn btn-primary btn-sm" onClick={() => handlePublish(d.id)}>
                            Publish
                          </button>
                        )}
                        {d.status === 'published' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleLock(d.id)}>
                            Lock Result 🔒
                          </button>
                        )}
                        {d.status === 'locked' && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Immutable</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
