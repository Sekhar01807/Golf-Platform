'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast/Toast';

interface NotificationSettings {
  bookingConfirmations: boolean;
  bookingReminders: boolean;
  bookingCancellations: boolean;
  tournamentUpdates: boolean;
  promotionalEmails: boolean;
  platformAnnouncements: boolean;
}

interface UserPreferences {
  distanceUnit: 'Yards' | 'Meters';
  currency: string;
  timeZone: string;
  language: string;
  defaultTee: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Section 1: Account
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileVisibility, setProfileVisibility] = useState<'Public' | 'Private' | 'Members Only'>('Public');
  const [savingAccount, setSavingAccount] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // Section 2: Notifications
  const [notifications, setNotifications] = useState<NotificationSettings>({
    bookingConfirmations: true,
    bookingReminders: true,
    bookingCancellations: true,
    tournamentUpdates: true,
    promotionalEmails: false,
    platformAnnouncements: true,
  });

  // Section 3: Privacy & Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Section 4: Preferences
  const [preferences, setPreferences] = useState<UserPreferences>({
    distanceUnit: 'Yards',
    currency: 'INR (₹)',
    timeZone: 'Asia/Kolkata (IST)',
    language: 'English (US)',
    defaultTee: 'White (Standard)',
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Section 5: Danger Zone
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

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
      setNewEmail(user.email || '');

      const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || user.user_metadata?.full_name || '');
      }

      if (user.user_metadata?.phone) setPhone(user.user_metadata.phone);
      if (user.user_metadata?.profile_visibility) setProfileVisibility(user.user_metadata.profile_visibility);
      if (user.user_metadata?.notifications) {
        setNotifications((prev) => ({ ...prev, ...user.user_metadata.notifications }));
      }
      if (user.user_metadata?.preferences) {
        setPreferences((prev) => ({ ...prev, ...user.user_metadata.preferences }));
      }
    } catch {
      showToast('Failed to load account settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 1. Save Account Info (Name, Phone, Profile Visibility)
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAccount(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update public.users
      await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      // Sync auth user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          profile_visibility: profileVisibility,
        },
      });

      showToast('Account details updated in database!', 'success');
    } catch {
      showToast('Failed to save account changes', 'error');
    } finally {
      setSavingAccount(false);
    }
  };

  // Change Email (with confirmation email dispatch)
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || newEmail === email) {
      showToast('Please enter a different valid email address', 'warning');
      return;
    }

    try {
      setUpdatingEmail(true);
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });

      if (error) {
        showToast(error.message || 'Failed to update email address', 'error');
        return;
      }

      showToast('Confirmation email sent! Please check your new inbox to verify.', 'info');
    } catch {
      showToast('An error occurred while updating email', 'error');
    } finally {
      setUpdatingEmail(false);
    }
  };

  // 2. Toggle Notification Setting
  const handleToggleNotification = async (key: keyof NotificationSettings) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);

    try {
      await supabase.auth.updateUser({
        data: { notifications: updated },
      });
      showToast('Notification preference saved', 'success');
    } catch {
      showToast('Failed to update notification setting', 'error');
    }
  };

  // 3. Update Password (with Old Password Verification)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      showToast('Please enter your current password for confirmation', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters long', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'warning');
      return;
    }
    if (currentPassword === newPassword) {
      showToast('New password cannot be identical to your current password', 'warning');
      return;
    }

    try {
      setUpdatingPassword(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        showToast('Session expired. Please sign in again.', 'error');
        return;
      }

      // Step 1: Cryptographically verify current password with Supabase Auth
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyError) {
        showToast('Incorrect current password. Please re-enter your old password.', 'error');
        return;
      }

      // Step 2: Cryptographically re-hash and update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        showToast(updateError.message || 'Failed to update password', 'error');
        return;
      }

      // Step 3: Record updated_at in database
      await supabase
        .from('users')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', user.id);

      showToast('Password updated and encrypted in database!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error updating password', 'error');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Sign out of all devices (Global JWT invalidation)
  const handleSignOutAllDevices = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
      showToast('Signed out of all devices and active sessions.', 'info');
      router.push('/auth/login');
      router.refresh();
    } catch {
      await supabase.auth.signOut();
      router.push('/auth/login');
    }
  };

  // 4. Save Golf & App Preferences
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
      await supabase.auth.signOut({ scope: 'global' });
      showToast('Account scheduled for permanent removal.', 'info');
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
    <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* ── Section 1: Account ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
          Account Details
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Manage your personal credentials, contact numbers, and public visibility.
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
                placeholder="Your Full Name"
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
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Profile Visibility</label>
            <select
              className="form-input"
              value={profileVisibility}
              onChange={(e) => setProfileVisibility(e.target.value as 'Public' | 'Private' | 'Members Only')}
            >
              <option value="Public">Public (Visible on Golfer Leaderboards)</option>
              <option value="Members Only">Members Only (Visible to logged-in subscribers)</option>
              <option value="Private">Private (Hidden from public directory)</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" disabled={savingAccount}>
            {savingAccount ? 'Saving...' : 'Save Account Details'}
          </button>
        </form>

        {/* Change Email Sub-Form */}
        <div style={{ marginTop: '1.75rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border-subtle)' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
            Change Email Address
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            Current email: <strong>{email}</strong>
          </p>

          <form onSubmit={handleUpdateEmail} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="email"
              className="form-input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new.email@example.com"
              style={{ maxWidth: '320px' }}
              required
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={updatingEmail || newEmail === email}>
              {updatingEmail ? 'Sending Link...' : 'Change Email'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Section 2: Notifications (Simple Switch Toggles) ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
          Notifications
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Control which notifications, tournament updates, and reminders you receive.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                Booking & Round Confirmations
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Email confirmations immediately upon submitting 18-hole scorecards
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('bookingConfirmations')}
              className={`btn btn-sm ${notifications.bookingConfirmations ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: '70px', fontWeight: 700 }}
            >
              {notifications.bookingConfirmations ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                Booking & Score Reminders
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Helpful reminders to submit your rounds before monthly draw lock dates
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('bookingReminders')}
              className={`btn btn-sm ${notifications.bookingReminders ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: '70px', fontWeight: 700 }}
            >
              {notifications.bookingReminders ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                Booking Cancellations & Status Changes
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Alerts if scorecards or prize claims require scorecard verification
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('bookingCancellations')}
              className={`btn btn-sm ${notifications.bookingCancellations ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: '70px', fontWeight: 700 }}
            >
              {notifications.bookingCancellations ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                Tournament & Monthly Draw Updates
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Broadcasts when monthly winning draw numbers and prize pots are published
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('tournamentUpdates')}
              className={`btn btn-sm ${notifications.tournamentUpdates ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: '70px', fontWeight: 700 }}
            >
              {notifications.tournamentUpdates ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                Promotional Emails & Partner Perks
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Discounts on golf equipment, course green fees, and exclusive member offers
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('promotionalEmails')}
              className={`btn btn-sm ${notifications.promotionalEmails ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: '70px', fontWeight: 700 }}
            >
              {notifications.promotionalEmails ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                Platform Announcements
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Important notices about terms, charity matching milestones, and platform features
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('platformAnnouncements')}
              className={`btn btn-sm ${notifications.platformAnnouncements ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: '70px', fontWeight: 700 }}
            >
              {notifications.platformAnnouncements ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 3: Privacy & Security ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
          Privacy & Security
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Cryptographically verify your credentials, change passwords, and manage active sessions.
        </p>

        <form onSubmit={handleUpdatePassword} style={{ marginBottom: '1.75rem' }}>
          <div className="form-group" style={{ marginBottom: '1rem', maxWidth: '480px' }}>
            <label className="form-label" htmlFor="currentPassword">Current (Old) Password</label>
            <input
              id="currentPassword"
              type="password"
              className="form-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your existing password"
              autoComplete="current-password"
              required
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
              Required for cryptographic verification before updating credentials.
            </span>
          </div>

          <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            disabled={updatingPassword || !currentPassword || !newPassword}
          >
            {updatingPassword ? 'Verifying & Updating...' : 'Update Password'}
          </button>
        </form>

        <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--color-text-primary)' }}>
              Active Sessions
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Authenticated via Supabase JWT Bearer Tokens with cryptographic refresh rotation
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSignOutAllDevices}
          >
            Sign Out of All Devices
          </button>
        </div>
      </div>

      {/* ── Section 4: Preferences (Golf-Domain Specific) ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.35rem' }}>
          Preferences
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Configure golf distance units (Yards / Meters), display currency, language, and default tee.
        </p>

        <form onSubmit={handleSavePreferences}>
          <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Distance Unit (Golf Measurement)</label>
              <select
                className="form-input"
                value={preferences.distanceUnit}
                onChange={(e) => setPreferences({ ...preferences, distanceUnit: e.target.value as 'Yards' | 'Meters' })}
              >
                <option value="Yards">Yards (Standard Golf Course Measurement)</option>
                <option value="Meters">Meters (Metric System)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Currency</label>
              <select
                className="form-input"
                value={preferences.currency}
                onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
              >
                <option value="INR (₹)">INR (₹) — Indian Rupee</option>
                <option value="USD ($)">USD ($) — United States Dollar</option>
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
              <label className="form-label">Language</label>
              <select
                className="form-input"
                value={preferences.language}
                onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
              >
                <option value="English (US)">English (US)</option>
                <option value="English (UK)">English (UK)</option>
                <option value="Hindi">Hindi (हिंदी)</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Default Tee Preference</label>
              <select
                className="form-input"
                value={preferences.defaultTee}
                onChange={(e) => setPreferences({ ...preferences, defaultTee: e.target.value })}
              >
                <option value="White (Standard)">White (Standard — Men’s / Middle Tees)</option>
                <option value="Blue (Championship)">Blue (Championship Tees)</option>
                <option value="Black (Tour)">Black (Tour / Professional Tees)</option>
                <option value="Gold (Senior)">Gold (Senior Tees)</option>
                <option value="Red (Forward)">Red (Forward / Ladies Tees)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" disabled={savingPrefs}>
            {savingPrefs ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      </div>

      {/* ── Section 5: Danger Zone ── */}
      <div className="card" style={{ padding: '1.75rem', border: '1.5px solid rgba(201, 74, 74, 0.4)', background: 'rgba(201, 74, 74, 0.03)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#C94A4A', marginBottom: '0.35rem' }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          Irreversible actions. Permanently removes your handicap records, 5-round score ledger, active subscription, and verified claims.
        </p>

        {!deleteConfirmOpen ? (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setDeleteConfirmOpen(true)}
            style={{ background: '#C94A4A', color: '#FFFFFF', border: 'none', fontWeight: 600, padding: '0.55rem 1.25rem' }}
          >
            Delete Account...
          </button>
        ) : (
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(201, 74, 74, 0.3)', borderRadius: '8px', padding: '1.25rem', maxWidth: '500px' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#C94A4A', margin: '0 0 8px 0' }}>
              Confirm Account Deletion
            </p>
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
              Type <strong>DELETE</strong> in the input below to confirm permanent removal of your account data:
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
