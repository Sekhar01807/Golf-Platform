'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast/Toast';

export default function AdminCharitiesPage() {
  const { showToast } = useToast();
  const [charities, setCharities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEvents, setNewEvents] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCharities();
  }, []);

  const fetchCharities = async () => {
    try {
      const res = await fetch('/api/admin/charities');
      if (res.ok) {
        const data = await res.json();
        setCharities(data || []);
      } else {
        showToast('Failed to load charities', 'error');
      }
    } catch {
      showToast('Network error loading charities', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/charities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          upcoming_events: newEvents || null,
          is_featured: isFeatured,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(`Charity "${newName}" created successfully!`, 'success');
        setNewName('');
        setNewDesc('');
        setNewEvents('');
        setIsFeatured(false);
        setShowForm(false);
        await fetchCharities();
      } else {
        showToast(data.error || 'Failed to create charity', 'error');
      }
    } catch {
      showToast('Network error creating charity', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you certain you wish to delete "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/charities?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Charity "${name}" deleted.`, 'info');
        await fetchCharities();
      } else {
        showToast('Failed to delete charity', 'error');
      }
    } catch {
      showToast('Network error deleting charity', 'error');
    }
  };

  const toggleFeatured = async (id: string, currentValue: boolean) => {
    try {
      const res = await fetch('/api/admin/charities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_featured: !currentValue }),
      });

      if (res.ok) {
        showToast('Charity featured status updated', 'success');
        await fetchCharities();
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch {
      showToast('Network error updating status', 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2xl)', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            Charity Directory Management
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
            Manage verified partner non-profit organizations and their contribution ledgers.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add New Charity'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--space-2xl)', border: '1px solid var(--color-primary)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
            Register New Partner Charity
          </h3>
          <form onSubmit={handleAdd}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Charity Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. Wildlife Preservation Golf"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Upcoming Event / Note (Optional)</label>
                <input
                  className="form-input"
                  placeholder="e.g. Annual Charity Match — October 2026"
                  value={newEvents}
                  onChange={(e) => setNewEvents(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description & Mission</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Explain what causes this charity addresses..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-lg)' }}>
              <input
                type="checkbox"
                id="isFeatured"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
              />
              <label htmlFor="isFeatured" style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                Feature this charity on the homepage
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Creating...' : 'Save Charity'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Charities Table */}
      <div className="card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
          Partner Non-Profits ({charities.length})
        </h3>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Charity Name</th>
                <th>Status</th>
                <th>Total Community Raised</th>
                <th>Upcoming Event</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)' }}>
                    Loading charities...
                  </td>
                </tr>
              ) : charities.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    No charities registered yet.
                  </td>
                </tr>
              ) : (
                charities.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.description}
                      </div>
                    </td>
                    <td>
                      <button
                        className={`badge ${c.is_featured ? 'badge-active' : 'badge-inactive'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => toggleFeatured(c.id, c.is_featured)}
                        title="Click to toggle featured state"
                      >
                        {c.is_featured ? '★ Featured' : 'Standard'}
                      </button>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                      ₹{Number(c.total_contributions || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                      {c.upcoming_events || '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-error)' }}
                        onClick={() => handleDelete(c.id, c.name)}
                      >
                        Delete
                      </button>
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
