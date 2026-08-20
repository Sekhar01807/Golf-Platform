'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast/Toast';
import {
  ScorecardIcon,
  BarChartIcon,
  HeartIcon,
  TicketIcon,
  ShieldIcon,
  EditIcon,
  CheckCircleIcon,
  CrownIcon,
} from '@/components/Icons/Icons';
import { getMembershipDetails, ComputedMembership } from '@/lib/utils/subscription';

interface GolfProfileData {
  phone: string;
  location: string;
  handicapIndex: string;
  playingLevel: string;
  preferredTee: string;
  homeCourse: string;
  favoriteCourse: string;
  yearsPlaying: string;
  preferredFormat: string;
  averageScoreManual?: string;
}

interface ScoreRecord {
  id: string;
  score: number;
  date_played: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. Profile Core
  const [fullName, setFullName] = useState('Golfer');
  const [email, setEmail] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [membership, setMembership] = useState<ComputedMembership>({
    isPremium: false,
    label: 'Free Golfer',
    badgeClass: 'badge-inactive',
    badgeStyle: {},
    color: '#64748B',
    subLabel: 'Free Account',
  });

  // 2. Golf Profile (Domain-specific)
  const [golfProfile, setGolfProfile] = useState<GolfProfileData>({
    phone: '',
    location: '',
    handicapIndex: '',
    playingLevel: '',
    preferredTee: '',
    homeCourse: '',
    favoriteCourse: '',
    yearsPlaying: '',
    preferredFormat: '',
    averageScoreManual: '',
  });

  // 3. Tracked Database Statistics
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [charityName, setCharityName] = useState<string>('');
  const [charityPercentage, setCharityPercentage] = useState<number>(10);

  const { showToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/profile');
      if (!res.ok) {
        if (res.status === 401) {
          showToast('Please sign in to view your profile', 'warning');
        } else {
          showToast('Failed to load profile details', 'error');
        }
        return;
      }

      const data = await res.json();
      const user = data.user;
      const profile = data.profile;

      if (user) {
        setEmail(user.email || '');
        const name = profile?.full_name || user.metadata?.full_name || user.email?.split('@')[0] || 'Golfer';
        setFullName(name);
        setCharityPercentage(profile?.charity_contribution_percentage || 10);

        if (data.charityName) {
          setCharityName(data.charityName);
        }

        const computed = getMembershipDetails({
          status: profile?.subscription_status || 'inactive',
          plan: profile?.subscription_plan || null,
          endDate: profile?.subscription_end_date || null,
        });
        setMembership(computed);

        if (profile?.created_at) {
          setCreatedAt(
            new Date(profile.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          );
        }

        if (user.metadata?.golf_profile) {
          setGolfProfile({
            phone: user.metadata.golf_profile.phone || user.metadata?.phone || '',
            location: user.metadata.golf_profile.location || '',
            handicapIndex: user.metadata.golf_profile.handicapIndex || '',
            playingLevel: user.metadata.golf_profile.playingLevel || '',
            preferredTee: user.metadata.golf_profile.preferredTee || '',
            homeCourse: user.metadata.golf_profile.homeCourse || '',
            favoriteCourse: user.metadata.golf_profile.favoriteCourse || '',
            yearsPlaying: user.metadata.golf_profile.yearsPlaying || '',
            preferredFormat: user.metadata.golf_profile.preferredFormat || '',
            averageScoreManual: user.metadata.golf_profile.averageScoreManual || '',
          });
        } else {
          setGolfProfile((prev) => ({
            ...prev,
            phone: user.metadata?.phone || '',
          }));
        }
      }

      if (data.scores) {
        setScores(data.scores);
      }
    } catch {
      showToast('Failed to load profile details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: golfProfile.phone.trim(),
          golfProfile,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Failed to save profile changes', 'error');
        return;
      }

      // Dispatch global event so sidebar and topbar immediately reflect updated name & initial
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('profile-updated', {
            detail: { fullName: fullName.trim() },
          })
        );
      }

      showToast('Profile details updated successfully!', 'success');
      setIsEditing(false);
      await fetchProfileData();
      router.refresh();
    } catch {
      showToast('Failed to save profile changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Stats computed from verified backend scores
  const roundsCount = scores.length;
  const avgScore = roundsCount > 0 ? (scores.reduce((sum, s) => sum + s.score, 0) / roundsCount).toFixed(1) : (golfProfile.averageScoreManual || '—');
  const bestScore = roundsCount > 0 ? Math.max(...scores.map((s) => s.score)) : '—';
  const initial = (fullName.trim().charAt(0) || email.charAt(0) || 'G').toUpperCase();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--color-text-muted)' }}>
        <p>Loading your Golfer Profile...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* ── 1. Profile Header ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: membership.isPremium
                  ? 'linear-gradient(135deg, #1E6B42 0%, #164E30 100%)'
                  : 'linear-gradient(135deg, #334155 0%, #1E293B 100%)',
                color: '#FFFFFF',
                fontSize: '2.2rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: membership.isPremium
                  ? '0 4px 16px rgba(30, 107, 66, 0.35)'
                  : '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: membership.isPremium ? '3px solid #D4A84F' : '3px solid #FFFFFF',
                flexShrink: 0,
              }}
            >
              {initial}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                  {fullName}
                </h2>
                <span className="badge" style={membership.badgeStyle}>
                  {membership.isPremium && <CrownIcon size={14} color="#D4A84F" style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                  {membership.label}
                </span>
              </div>

              <div style={{ fontSize: '0.92rem', color: membership.isPremium ? '#1E6B42' : 'var(--color-text-secondary)', fontWeight: 600, marginTop: '4px' }}>
                {golfProfile.playingLevel ? `${golfProfile.playingLevel} Golfer` : 'Golfer'} 
                {golfProfile.handicapIndex ? ` • Handicap ${golfProfile.handicapIndex}` : ''}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                <span>Email: {email}</span>
                {golfProfile.phone ? <span>Phone: {golfProfile.phone}</span> : <span style={{ color: 'var(--color-text-muted)' }}>Phone not set</span>}
                {golfProfile.location ? <span>Location: {golfProfile.location}</span> : <span style={{ color: 'var(--color-text-muted)' }}>Location not set</span>}
                {createdAt && <span>Member since: {createdAt}</span>}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsEditing(!isEditing)}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <EditIcon size={14} />
            <span>{isEditing ? 'Close Editor' : 'Edit Profile'}</span>
          </button>
        </div>

        {/* Inline Edit Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} style={{ marginTop: '1.75rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border-subtle)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text-primary)' }}>
              Edit Golfer Profile Details
            </h3>

            <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sekhar Reddy"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={golfProfile.phone}
                  onChange={(e) => setGolfProfile({ ...golfProfile, phone: e.target.value })}
                  placeholder="e.g. +91 98765 43210"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Location (City, Country)</label>
                <input
                  type="text"
                  className="form-input"
                  value={golfProfile.location}
                  onChange={(e) => setGolfProfile({ ...golfProfile, location: e.target.value })}
                  placeholder="e.g. Hyderabad, India"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Handicap Index</label>
                <input
                  type="text"
                  className="form-input"
                  value={golfProfile.handicapIndex}
                  onChange={(e) => setGolfProfile({ ...golfProfile, handicapIndex: e.target.value })}
                  placeholder="e.g. 12.4"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Playing Level</label>
                <select
                  className="form-input"
                  value={golfProfile.playingLevel}
                  onChange={(e) => setGolfProfile({ ...golfProfile, playingLevel: e.target.value })}
                >
                  <option value="">Select Level...</option>
                  <option value="Beginner">Beginner (25+ Handicap)</option>
                  <option value="Intermediate">Intermediate (10–24 Handicap)</option>
                  <option value="Advanced">Advanced (Scratch–9 Handicap)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Tee</label>
                <select
                  className="form-input"
                  value={golfProfile.preferredTee}
                  onChange={(e) => setGolfProfile({ ...golfProfile, preferredTee: e.target.value })}
                >
                  <option value="">Select Preferred Tee...</option>
                  <option value="White (Standard)">White (Standard — Men’s / Middle Tees)</option>
                  <option value="Blue (Championship)">Blue (Championship Tees)</option>
                  <option value="Black (Tour)">Black (Tour / Pro Tees)</option>
                  <option value="Gold (Senior)">Gold (Senior Tees)</option>
                  <option value="Red (Forward)">Red (Forward / Ladies Tees)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Home Course</label>
                <input
                  type="text"
                  className="form-input"
                  value={golfProfile.homeCourse}
                  onChange={(e) => setGolfProfile({ ...golfProfile, homeCourse: e.target.value })}
                  placeholder="e.g. Hyderabad Golf Club"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Favorite Golf Course</label>
                <input
                  type="text"
                  className="form-input"
                  value={golfProfile.favoriteCourse}
                  onChange={(e) => setGolfProfile({ ...golfProfile, favoriteCourse: e.target.value })}
                  placeholder="e.g. St Andrews, Pebble Beach"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Years Playing</label>
                <input
                  type="text"
                  className="form-input"
                  value={golfProfile.yearsPlaying}
                  onChange={(e) => setGolfProfile({ ...golfProfile, yearsPlaying: e.target.value })}
                  placeholder="e.g. 3 Years"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Playing Format</label>
                <select
                  className="form-input"
                  value={golfProfile.preferredFormat}
                  onChange={(e) => setGolfProfile({ ...golfProfile, preferredFormat: e.target.value })}
                >
                  <option value="">Select Playing Format...</option>
                  <option value="Individual Stableford (18-Hole)">Individual Stableford (18-Hole)</option>
                  <option value="Individual Stroke Play (Gross/Net)">Individual Stroke Play (Gross/Net)</option>
                  <option value="Match Play">Match Play</option>
                  <option value="2-Man / 4-Man Scramble">2-Man / 4-Man Scramble</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Typical Average Score (18-Hole)</label>
                <input
                  type="text"
                  className="form-input"
                  value={golfProfile.averageScoreManual || ''}
                  onChange={(e) => setGolfProfile({ ...golfProfile, averageScoreManual: e.target.value })}
                  placeholder="e.g. 87"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── 2. Golf Profile (Domain-Specific Section) ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ScorecardIcon size={20} color="var(--color-primary)" />
            <span>Golf Profile</span>
          </h3>
          {!isEditing && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsEditing(true)}
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <EditIcon size={13} />
              <span>Edit Details</span>
            </button>
          )}
        </div>

        <div className="grid grid-3" style={{ gap: '1rem' }}>
          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Handicap Index
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: golfProfile.handicapIndex ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {golfProfile.handicapIndex || 'Not set'}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Playing Level
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: golfProfile.playingLevel ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {golfProfile.playingLevel || 'Not set'}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Preferred Tee
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: golfProfile.preferredTee ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {golfProfile.preferredTee || 'Not set'}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Home Course
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: golfProfile.homeCourse ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {golfProfile.homeCourse || 'Not set'}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Favorite Course
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: golfProfile.favoriteCourse ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {golfProfile.favoriteCourse || 'Not set'}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Playing Experience
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: golfProfile.yearsPlaying ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {golfProfile.yearsPlaying || 'Not set'}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Average Score
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1E6B42' }}>
              {avgScore !== '—' ? `${avgScore} Pts` : 'No rounds logged yet'}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', gridColumn: 'span 2' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Preferred Playing Format
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: golfProfile.preferredFormat ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {golfProfile.preferredFormat || 'Not set'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Statistics (Tracked Backend Data) ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <BarChartIcon size={20} color="var(--color-primary)" />
              <span>Performance Statistics</span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              Calculated from your verified 5-round FIFO Stableford ledger
            </p>
          </div>

          <Link href="/dashboard/scores" className="btn btn-primary btn-sm" style={{ fontSize: '0.8rem' }}>
            + Log Score
          </Link>
        </div>

        <div className="grid grid-4" style={{ gap: '1rem' }}>
          <div className="stat-card" style={{ padding: '1.25rem' }}>
            <div className="stat-value" style={{ fontSize: '1.8rem' }}>{roundsCount}</div>
            <div className="stat-label">Rounds Played</div>
          </div>

          <div className="stat-card" style={{ padding: '1.25rem' }}>
            <div className="stat-value" style={{ fontSize: '1.8rem', color: '#1E6B42' }}>{avgScore}</div>
            <div className="stat-label">Average Score</div>
          </div>

          <div className="stat-card" style={{ padding: '1.25rem' }}>
            <div className="stat-value" style={{ fontSize: '1.8rem', color: 'var(--color-accent)' }}>{bestScore}</div>
            <div className="stat-label">Best Score</div>
          </div>

          <div className="stat-card" style={{ padding: '1.25rem' }}>
            <div className="stat-value" style={{ fontSize: '1.8rem' }}>{golfProfile.handicapIndex || '—'}</div>
            <div className="stat-label">Current Handicap</div>
          </div>
        </div>
      </div>

      {/* ── 4. Recent Activity ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ScorecardIcon size={20} color="var(--color-primary)" />
          <span>Recent Activity</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {scores.length > 0 ? (
            scores.slice(0, 3).map((round) => (
              <div
                key={round.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: 'var(--color-bg-surface)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.92rem' }}>
                    18-Hole Round {golfProfile.homeCourse ? `at ${golfProfile.homeCourse}` : ''}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Played on {new Date(round.date_played).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1.1rem' }}>
                  {round.score} Pts
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No score records yet. <Link href="/dashboard/scores" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Submit your first 18-hole score</Link> to track rounds.
            </div>
          )}

          {/* Monthly Draw Participation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              background: 'var(--color-bg-surface)',
              borderRadius: '8px',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.92rem' }}>
                Monthly Prize Draw Participation
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {membership.isPremium ? 'Active premium entry linked to your verified 5-round score average' : 'Subscribe to enter monthly skill prize draws'}
              </div>
            </div>
            <Link href="/dashboard/draws" style={{ fontSize: '0.825rem', color: 'var(--color-primary)', fontWeight: 600 }}>
              View Draws →
            </Link>
          </div>

          {/* Charity Impact Allocation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              background: 'var(--color-bg-surface)',
              borderRadius: '8px',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.92rem' }}>
                Philanthropic Impact Allocation
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {charityName ? `Directing ${charityPercentage}% of membership to ${charityName}` : 'Select a verified charity partner'}
              </div>
            </div>
            <Link href="/dashboard/charity" style={{ fontSize: '0.825rem', color: 'var(--color-primary)', fontWeight: 600 }}>
              {charityName ? 'Manage Charity →' : 'Choose Charity →'}
            </Link>
          </div>
        </div>
      </div>

      {/* ── 5. Account Information (Compact) ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShieldIcon size={20} color="var(--color-primary)" />
          <span>Account Information</span>
        </h3>

        <div className="grid grid-2" style={{ gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Email Verification</span>
            <span style={{ color: '#1E6B42', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircleIcon size={16} color="#1E6B42" />
              Verified
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Phone Verification</span>
            <span style={{ color: golfProfile.phone ? '#1E6B42' : 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>
              {golfProfile.phone ? 'Linked' : 'Unlinked'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Account Creation Date</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>{createdAt || 'Recent'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Membership Status</span>
            <span className="badge" style={{ ...membership.badgeStyle, fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
              {membership.label}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
