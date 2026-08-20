'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast/Toast';

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data || []);
      } else {
        showToast('Failed to retrieve users', 'error');
      }
    } catch {
      showToast('Network error fetching users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter(
    (u) =>
      (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleUpdateRole = async (userId: string, currentRole: string, userName: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Are you sure you want to change ${userName || 'this user'}'s role to ${newRole.toUpperCase()}?`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to update user role', 'error');
        return;
      }

      showToast(`User role updated to ${newRole.toUpperCase()}`, 'success');
      await fetchUsers();
    } catch {
      showToast('Network error updating user role', 'error');
    }
  };

  const handleUpdateSubscription = async (userId: string, currentStatus: string, userName: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription_status: newStatus,
          subscription_plan: newStatus === 'active' ? 'monthly' : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to update subscription status', 'error');
        return;
      }

      showToast(`Subscription status updated to ${newStatus.toUpperCase()}`, 'success');
      await fetchUsers();
    } catch {
      showToast('Network error updating subscription', 'error');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          Registered Member Directory
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
          View platform members, assign security roles, and manage subscription access levels.
        </p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Members ({users.length})</h3>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Security Role</th>
                <th>Plan Tier</th>
                <th>Subscription Status</th>
                <th>Joined Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)' }}>
                    Loading user directory...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    No members found matching query.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{u.full_name || 'Member'}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{u.email}</div>
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-active'}`}>
                        {u.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {u.subscription_plan ? `${u.subscription_plan} Pass` : '—'}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          u.subscription_status === 'active'
                            ? 'badge-active'
                            : u.subscription_status === 'cancelled'
                            ? 'badge-inactive'
                            : 'badge-pending'
                        }`}
                      >
                        {u.subscription_status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      {new Date(u.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                          onClick={() => handleUpdateRole(u.id, u.role, u.full_name)}
                        >
                          {u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                          onClick={() => handleUpdateSubscription(u.id, u.subscription_status, u.full_name)}
                        >
                          {u.subscription_status === 'active' ? 'Set Inactive' : 'Activate Access'}
                        </button>
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
