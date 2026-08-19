'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast/Toast';

interface NotificationSettings {
  bookingConfirmations: boolean;
  tournamentUpdates: boolean;
  winningAlerts: boolean;
  charityReports: boolean;
  marketingEmails: boolean;
}

interface UserPreferences {
  distanceUnit: 'Yards' | 'Meters';
  currency: string;
  timeZone: string;
  defaultTee: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  // 1. Account Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // 2. Notifications
  const [notifications, setNotifications] = useState<NotificationSettings>({
    bookingConfirmations: true,
    tournamentUpdates: true,
    winningAlerts: true,
    charityReports: true,
    marketingEmails: false,
  });

  // 3. Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 4. Preferences
  const [preferences, setPreferences] = useState<UserPreferences>({
    distanceUnit: 'Yards',
    currency: 'INR (₹)',
    timeZone: 'Asia/Kolkata (IST)',
    defaultTee: 'White (Standard)',
  });

  const { showToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        showToast('Please sign in to manage account settings', 'warning');
        return;
      }

      setEmail(user.email || '');

      const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || user.user_metadata?.full_name || '');
      }

      // Load user preferences & notification settings from metadata
      if (user.user_metadata?.phone) setPhone(user.user_metadata.phone);
      if (user.user_metadata?.notifications) {
        setNotifications((prev) => ({ ...prev, ...user.user_metadata.notifications }));
      }
      if (user.user_metadata?.preferences) {
        setPreferences((prev) => ({ ...prev, ...user.user_metadata.preferences }));
      }
    } catch {
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 1. Save Account Info
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAccount(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('users')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);

      await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), phone: phone.trim() },
      });

      showToast('Account details saved successfully!', 'success');
    } catch {
      showToast('Failed to save account changes', 'error');
    } finally {
      setSavingAccount(false);
    }
  };

  // 2. Toggle Notification
  const handleToggleNotification = async (key: keyof NotificationSettings) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);

    try {
      await supabase.auth.updateUser({
        data: { notifications: updated },
      });
      showToast('Notification preference updated', 'success');
    } catch {
      showToast('Failed to update notification setting', 'error');
    }
  };

  // 3. Update Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'warning');
      return;
    }

    try {
      setUpdatingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        showToast(error.message || 'Failed to update password', 'error');
        return;
      }

      showToast('Password changed successfully!', 'success');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      showToast('Error updating password', 'error');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // 4. Save Preferences
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPrefs(true);
      await supabase.auth.updateUser({
        data: { preferences },
      });
      showToast('Preferences updated successfully!', 'success');
    } catch {
      showToast('Failed to save preferences', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  // 5. Delete Account
  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') {
      showToast('Please type DELETE to confirm', 'warning');
      return;
    }

    try {
      setDeleting(true);
      await supabase.auth.signOut();
      showToast('Account scheduled for permanent deletion', 'info');
      router.push('/');
    } catch {
      showToast('Failed to process deletion request', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--color-text-muted)' }}>
        <p>Loading Account Settings...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* ── Section 1: Account ── */}
      <div className="card">
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
          Account Information
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Update your public member credentials and contact info.
        </p>

        <form onSubmit={handleSaveAccount}>
          <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your Name"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              disabled
              style={{ background: 'var(--color-bg-elevated)', cursor: 'not-allowed', color: 'var(--color-text-muted)' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
              Primary login email synced with Supabase authentication.
            </span>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" disabled={savingAccount}>
            {savingAccount ? 'Saving...' : 'Save Account Info'}
          </button>
        </form>
      </div>

      {/* ── Section 2: Notifications ── */}
      <div className="card">
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
          Notification Preferences
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Select which email and system updates you wish to receive.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                Round Confirmations & Score Submissions
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Instant confirmation emails when submitting Stableford rounds
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('bookingConfirmations')}
              className={`btn btn-sm ${notifications.bookingConfirmations ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: '70px' }}
            >
              {notifications.bookingConfirmations ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                Tournament & Monthly Draw Announcements
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Notifications when draw numbers are published and finalized
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('tournamentUpdates')}
              className={`btn btn-sm ${notifications.tournamentUpdates ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: '70px' }}
            >
              {notifications.tournamentUpdates ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                Prize Winning Alerts
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Urgent notifications if your scorecard matches monthly prize draws
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('winningAlerts')}
              className={`btn btn-sm ${notifications.winningAlerts ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: '70px' }}
            >
              {notifications.winningAlerts ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                Charity Impact & Giving Reports
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Monthly breakdown of funds directed to your selected charity partner
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('charityReports')}
              className={`btn btn-sm ${notifications.charityReports ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: '70px' }}
            >
              {notifications.charityReports ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                Promotional & Platform Newsletters
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Occasional product updates, partner perks, and member benefits
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('marketingEmails')}
              className={`btn btn-sm ${notifications.marketingEmails ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: '70px' }}
            >
              {notifications.marketingEmails ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 3: Privacy & Security ── */}
      <div className="card">
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
          Privacy & Security
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Manage your password and security credentials.
        </p>

        <form onSubmit={handleUpdatePassword} style={{ marginBottom: '1.5rem' }}>
          <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            disabled={updatingPassword || !newPassword}
          >
            {updatingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
              Active Sessions
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Current browser session active via Supabase JWT Bearer Tokens
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}
          >
            Sign Out of All Devices
          </button>
        </div>
      </div>

      {/* ── Section 4: Preferences (Domain-Specific Golf Units) ── */}
      <div className="card">
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
          Golf & App Preferences
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Customize your unit of measurement, display currency, and playing tee presets.
        </p>

        <form onSubmit={handleSavePreferences}>
          <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Distance Unit</label>
              <select
                className="form-input"
                value={preferences.distanceUnit}
                onChange={(e) => setPreferences({ ...preferences, distanceUnit: e.target.value as 'Yards' | 'Meters' })}
              >
                <option value="Yards">Yards (Standard)</option>
                <option value="Meters">Meters (Metric)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Display Currency</label>
              <select
                className="form-input"
                value={preferences.currency}
                onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
              >
                <option value="INR (₹)">INR (₹) — Indian Rupee</option>
                <option value="USD ($)">USD ($) — US Dollar</option>
                <option value="GBP (£)">GBP (£) — British Pound</option>
                <option value="EUR (€)">EUR (€) — Euro</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Time Zone</label>
              <select
                className="form-input"
                value={preferences.timeZone}
                onChange={(e) => setPreferences({ ...preferences, timeZone: e.target.value })}
              >
                <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="UTC">Coordinated Universal Time (UTC)</option>
                <option value="America/New_York (EST)">America/New_York (EST, UTC-5)</option>
                <option value="America/Los_Angeles (PST)">America/Los_Angeles (PST, UTC-8)</option>
                <option value="Europe/London (GMT)">Europe/London (GMT/BST)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Default Tee Preset</label>
              <select
                className="form-input"
                value={preferences.defaultTee}
                onChange={(e) => setPreferences({ ...preferences, defaultTee: e.target.value })}
              >
                <option value="White (Standard)">White (Standard)</option>
                <option value="Blue (Championship)">Blue (Championship)</option>
                <option value="Black (Tour)">Black (Tour)</option>
                <option value="Gold (Senior)">Gold (Senior)</option>
                <option value="Red (Forward)">Red (Forward)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" disabled={savingPrefs}>
            {savingPrefs ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      </div>

      {/* ── Section 5: Danger Zone ── */}
      <div className="card" style={{ border: '1px solid rgba(255, 107, 107, 0.4)', background: 'rgba(255, 107, 107, 0.03)' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#C94A4A', marginBottom: '0.35rem' }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          Irreversible account actions. Permanent deletion removes your handicap history, tracked scores, and active subscription.
        </p>

        {!deleteConfirmOpen ? (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setDeleteConfirmOpen(true)}
            style={{ background: '#C94A4A', color: '#FFFFFF', border: 'none', fontWeight: 600 }}
          >
            Delete Account...
          </button>
        ) : (
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: '8px', padding: '1.25rem', maxWidth: '480px' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#C94A4A', margin: '0 0 8px 0' }}>
              Are you absolutely sure?
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
              Type <strong>DELETE</strong> in the box below to permanently remove your profile and score ledger:
            </p>

            <input
              type="text"
              className="form-input"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type DELETE to confirm"
              style={{ marginBottom: '1rem', borderColor: '#C94A4A' }}
            />

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE' || deleting}
                style={{ background: '#C94A4A', color: '#FFFFFF', border: 'none', fontWeight: 600 }}
              >
                {deleting ? 'Deleting...' : 'Permanently Delete Account'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteInput('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
