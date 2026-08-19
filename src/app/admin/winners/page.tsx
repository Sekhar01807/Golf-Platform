'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast/Toast';

export default function AdminWinnersPage() {
  const { showToast } = useToast();
  const [winners, setWinners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWinners();
  }, []);

  const fetchWinners = async () => {
    try {
      const res = await fetch('/api/admin/winners');
      if (res.ok) {
        const data = await res.json();
        setWinners(data || []);
      } else {
        showToast('Failed to load winners', 'error');
      }
    } catch {
      showToast('Network error loading winners', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/admin/winners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, verification_status: status }),
      });

      if (res.ok) {
        showToast(`Scorecard verification ${status}!`, 'success');
        await fetchWinners();
      } else {
        showToast('Failed to update verification status', 'error');
      }
    } catch {
      showToast('Network error verifying winner', 'error');
    }
  };

  const handlePayout = async (id: string) => {
    try {
      const res = await fetch('/api/admin/winners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, payout_status: 'paid' }),
      });

      if (res.ok) {
        showToast('Winner payout marked as PAID!', 'success');
        await fetchWinners();
      } else {
        showToast('Failed to update payout status', 'error');
      }
    } catch {
      showToast('Network error processing payout', 'error');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          Winner Verification & Payout Queue
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
          Inspect submitted scorecards, approve verified matches, and mark prize distributions paid.
        </p>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
          All Prize Recipients ({winners.length})
        </h3>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Draw Month</th>
                <th>Tier Match</th>
                <th>Prize Pool Share</th>
                <th>Scorecard Proof</th>
                <th>Verification</th>
                <th>Payout</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)' }}>
                    Loading winners queue...
                  </td>
                </tr>
              ) : winners.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    No draw winners recorded yet.
                  </td>
                </tr>
              ) : (
                winners.map((w) => {
                  const drawMonth = w.draws?.draw_month
                    ? new Date(w.draws.draw_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                    : '—';

                  return (
                    <tr key={w.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {w.users?.full_name || 'Member'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{w.users?.email}</div>
                      </td>
                      <td>{drawMonth}</td>
                      <td>
                        <span className="badge badge-accent">{w.match_type}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1.05rem' }}>
                        ₹{Number(w.prize_amount).toLocaleString('en-IN')}
                      </td>
                      <td>
                        {w.winner_proof_url ? (
                          <a
                            href={w.winner_proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="badge badge-active"
                            style={{ textDecoration: 'none' }}
                          >
                            View Proof
                          </a>
                        ) : (
                          <span className="badge badge-inactive">Missing</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            w.verification_status === 'approved'
                              ? 'badge-active'
                              : w.verification_status === 'rejected'
                              ? 'badge-inactive'
                              : 'badge-pending'
                          }`}
                        >
                          {w.verification_status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${w.payout_status === 'paid' ? 'badge-active' : 'badge-pending'}`}>
                          {w.payout_status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {w.verification_status === 'pending' && (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => handleVerify(w.id, 'approved')}>
                                Approve
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--color-error)' }}
                                onClick={() => handleVerify(w.id, 'rejected')}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {w.verification_status === 'approved' && w.payout_status === 'pending' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => handlePayout(w.id)}>
                              Mark Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
