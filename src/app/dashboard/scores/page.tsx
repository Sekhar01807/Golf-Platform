'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast/Toast';

export default function ScoresPage() {
  const [scores, setScores] = useState<{ id: string; score: number; date_played: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newScore, setNewScore] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    try {
      const res = await fetch('/api/scores');
      if (res.ok) {
        const data = await res.json();
        setScores(data || []);
      } else {
        showToast('Failed to load scores from server', 'error');
      }
    } catch {
      showToast('Network error loading scores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddScore = async (e: React.FormEvent) => {
    e.preventDefault();
    const scoreNum = parseInt(newScore, 10);

    if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 45) {
      showToast('Stableford score must be between 1 and 45', 'warning');
      return;
    }

    if (!newDate) {
      showToast('Please select the date played', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: scoreNum, date_played: newDate }),
      });

      const responseData = await res.json();

      if (res.ok) {
        setNewScore('');
        showToast(`Score of ${scoreNum} logged successfully!`, 'success');
        await fetchScores();
      } else {
        showToast(responseData.error || 'Failed to submit score', 'error');
      }
    } catch {
      showToast('Network error while saving score. Please retry.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          My Stableford Scores
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
          Log your 18-hole Stableford scores (1–45). Only your 5 most recent scores are active and enter the monthly prize draw.
        </p>
      </div>

      {/* Add Score Form */}
      <div className="card" style={{ marginBottom: 'var(--space-2xl)' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>Log New Round</h3>
        
        <form onSubmit={handleAddScore} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Stableford Points (1–45)</label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={45}
              value={newScore}
              onChange={(e) => setNewScore(e.target.value)}
              placeholder="e.g. 38"
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Date Played</label>
            <input
              type="date"
              className="form-input"
              max={new Date().toISOString().split('T')[0]}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : '+ Add Score'}
          </button>
        </form>
      </div>

      {/* Scores Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Active Score History</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {scores.length} of 5 slots filled · New scores automatically replace the oldest round (FIFO).
            </p>
          </div>
          <span className="badge badge-primary">{scores.length}/5 Scores</span>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Date Played</th>
                <th>Stableford Score</th>
                <th>Prize Draw Entry</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                    Loading your scores...
                  </td>
                </tr>
              ) : scores.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)' }}>
                    No scores entered yet. Log your first round using the form above.
                  </td>
                </tr>
              ) : (
                scores.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>#{i + 1}</td>
                    <td style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {new Date(s.date_played).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1.1rem' }}>
                      {s.score} pts
                    </td>
                    <td>
                      <span className="badge badge-active">Active in Next Draw</span>
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
