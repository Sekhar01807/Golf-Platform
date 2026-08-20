'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast/Toast';
import { ScorecardIcon } from '@/components/Icons/Icons';

interface ScoreRecord {
  id: string;
  score: number;
  date_played: string;
  created_at?: string;
}

export default function ScoresPage() {
  const router = useRouter();
  const [scores, setScores] = useState<ScoreRecord[]>([]);
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
      setLoading(true);
      const res = await fetch('/api/scores');
      if (!res.ok) {
        if (res.status === 401) {
          showToast('Please sign in to view your scores', 'warning');
        } else {
          showToast('Failed to load scores from database', 'error');
        }
        return;
      }
      const data = await res.json();
      setScores(Array.isArray(data) ? data : []);
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
      showToast('Stableford score must be between 1 and 45 points', 'warning');
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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error || 'Failed to record score', 'error');
        return;
      }

      showToast('Score recorded successfully! (Active in 5-round FIFO)', 'success');
      setNewScore('');
      await fetchScores();
      router.refresh();
    } catch {
      showToast('Error recording score. Please try again.', 'error');
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
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ScorecardIcon size={20} color="var(--color-primary)" />
          <span>Log New Round</span>
        </h3>
        
        <form onSubmit={handleAddScore} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="score-input">Stableford Points (1–45)</label>
            <input
              id="score-input"
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
            <label className="form-label" htmlFor="date-input">Date Played</label>
            <input
              id="date-input"
              type="date"
              className="form-input"
              max={new Date().toISOString().split('T')[0]}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Adding Score...' : '+ Add Score'}
          </button>
        </form>
      </div>

      {/* Scores Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Active Score History</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {scores.length} of 5 slots filled · New scores automatically replace the oldest round (FIFO).
            </p>
          </div>
          <span className="badge badge-primary">{scores.length} / 5 Scores</span>
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
