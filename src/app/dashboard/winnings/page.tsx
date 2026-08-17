'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast/Toast';

export default function WinningsPage() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [winnings, setWinnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofUrl, setProofUrl] = useState('');
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchWinnings();
  }, []);

  const fetchWinnings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('draw_winners')
          .select('id, match_type, prize_amount, verification_status, payout_status, winner_proof_url, created_at, draws(draw_month)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setWinnings(data || []);
      }
    } catch (err) {
      console.error('Failed to load winnings:', err);
      showToast('Failed to load winnings data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWinnerId || !proofUrl.trim()) {
      showToast('Please provide a valid image URL for scorecard proof', 'warning');
      return;
    }

    setUploading(true);
    try {
      // Normal user can only update winner_proof_url on their own pending winning row
      const { error } = await supabase
        .from('draw_winners')
        .update({ winner_proof_url: proofUrl.trim() })
        .eq('id', selectedWinnerId)
        .eq('verification_status', 'pending');

      if (error) throw error;

      showToast('Scorecard proof uploaded! Our administrators will review shortly.', 'success');
      setProofUrl('');
      setSelectedWinnerId(null);
      await fetchWinnings();
    } catch (err: any) {
      console.error('Proof upload error:', err);
      showToast(err?.message || 'Failed to submit proof URL', 'error');
    } finally {
      setUploading(false);
    }
  };

  const totalWon = winnings.reduce((sum, w) => sum + Number(w.prize_amount || 0), 0);
  const totalPaid = winnings
    .filter((w) => w.payout_status === 'paid')
    .reduce((sum, w) => sum + Number(w.prize_amount || 0), 0);
  const pendingPayout = totalWon - totalPaid;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          My Prize Winnings
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
          Review prize winnings, track verification, and submit scorecard proof for administrative approval.
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid-3" style={{ marginBottom: 'var(--space-2xl)' }}>
        <div className="card">
          <div className="stat-label">Total Prizes Won</div>
          <div className="stat-value" style={{ marginTop: '4px' }}>₹{totalWon.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="stat-label">Completed Payouts</div>
          <div className="stat-value" style={{ color: 'var(--color-success)', marginTop: '4px' }}>
            ₹{totalPaid.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Pending Payouts</div>
          <div className="stat-value" style={{ color: 'var(--color-warning)', marginTop: '4px' }}>
            ₹{pendingPayout.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Proof Submission Modal / Card */}
      {selectedWinnerId && (
        <div className="card" style={{ marginBottom: 'var(--space-2xl)', border: '1px solid var(--color-primary)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
            Submit Scorecard Proof
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            Upload your official scorecard photo or golf app screenshot to verify your round.
          </p>

          <form onSubmit={handleUploadProof} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="url"
              className="form-input"
              style={{ flex: 1, minWidth: '260px' }}
              placeholder="https://example.com/scorecard.png"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={uploading}>
              {uploading ? 'Submitting...' : 'Upload Scorecard Proof'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSelectedWinnerId(null);
                setProofUrl('');
              }}
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Winnings Table */}
      <div className="card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
          Winnings History
        </h3>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Draw Month</th>
                <th>Tier Match</th>
                <th>Prize Amount</th>
                <th>Proof Status</th>
                <th>Verification</th>
                <th>Payout</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)' }}>
                    Loading winnings...
                  </td>
                </tr>
              ) : winnings.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    No winnings recorded yet. Keep submitting your 5 monthly Stableford scores to enter the upcoming draw!
                  </td>
                </tr>
              ) : (
                winnings.map((w) => {
                  const drawMonth = w.draws?.draw_month
                    ? new Date(w.draws.draw_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                    : 'Draw';

                  return (
                    <tr key={w.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{drawMonth}</td>
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
                            ✓ Submitted
                          </a>
                        ) : (
                          <span className="badge badge-inactive">Proof Required</span>
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
                        {w.verification_status === 'pending' && !w.winner_proof_url && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedWinnerId(w.id);
                              setProofUrl('');
                            }}
                          >
                            Upload Proof
                          </button>
                        )}
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
