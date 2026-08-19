'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast/Toast';

interface GolfProfileData {
  username: string;
  phone: string;
  location: string;
  handicapIndex: string;
  playingLevel: 'Beginner' | 'Intermediate' | 'Advanced';
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
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. Profile Core
  const [fullName, setFullName] = useState('Golfer');
  const [email, setEmail] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive');
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);

  // 2. Golf Profile (Domain-specific)
  const [golfProfile, setGolfProfile] = useState<GolfProfileData>({
    username: '@golfer',
    phone: '+91 98765 43210',
    location: 'Hyderabad, India',
    handicapIndex: '12.4',
    playingLevel: 'Intermediate',
    preferredTee: 'White (Standard)',
    homeCourse: 'Hyderabad Golf Club',
    favoriteCourse: 'St Andrews (Old Course)',
    yearsPlaying: '5 Years',
    preferredFormat: 'Individual Stableford (18-Hole)',
    averageScoreManual: '87',
  });

  // 3. Tracked Database Statistics
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [charityName, setCharityName] = useState<string>('World Wildlife Fund');
  const [charityPercentage, setCharityPercentage] = useState<number>(10);

  const { showToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        showToast('Please sign in to view your profile', 'warning');
        return;
      }

      setEmail(user.email || '');

      // Fetch user profile from database
      const { data: profile } = await supabase
        .from('users')
        .select('full_name, subscription_status, subscription_plan, selected_charity_id, charity_contribution_percentage, created_at')
        .eq('id', user.id)
        .single();

      if (profile) {
        const name = profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Golfer';
        setFullName(name);
        setSubscriptionStatus(profile.subscription_status || 'inactive');
        setSubscriptionPlan(profile.subscription_plan || null);
        setCharityPercentage(profile.charity_contribution_percentage || 10);
        if (profile.created_at) {
          setCreatedAt(new Date(profile.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }));
        }

        // Fetch selected charity
        if (profile.selected_charity_id) {
          const { data: charity } = await supabase
            .from('charities')
            .select('name')
            .eq('id', profile.selected_charity_id)
            .single();
          if (charity) setCharityName(charity.name);
        }
      }

      // Load golf profile from metadata
      if (user.user_metadata?.golf_profile) {
        setGolfProfile((prev) => ({
          ...prev,
          ...user.user_metadata.golf_profile,
        }));
      } else {
        const defaultHandle = `@${(profile?.full_name || user.email?.split('@')[0] || 'golfer').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        setGolfProfile((prev) => ({ ...prev, username: defaultHandle }));
      }

      // Fetch actual scores from database
      const { data: scoreRecords } = await supabase
        .from('golf_scores')
        .select('id, score, date_played')
        .eq('user_id', user.id)
        .order('date_played', { ascending: false });

      if (scoreRecords) {
        setScores(scoreRecords);
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

      // Update auth user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          golf_profile: golfProfile,
        },
      });

      showToast('Profile details updated successfully in database!', 'success');
      setIsEditing(false);
    } catch {
      showToast('Failed to save profile changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Compute stats from real tracked scores
  const roundsCount = scores.length;
  const avgScore = roundsCount > 0 ? (scores.reduce((sum, s) => sum + s.score, 0) / roundsCount).toFixed(1) : golfProfile.averageScoreManual || '—';
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
                background: 'linear-gradient(135deg, #214E34 0%, #2D6846 100%)',
                color: '#FFFFFF',
                fontSize: '2.2rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(33, 78, 52, 0.3)',
                border: '3px solid #FFFFFF',
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
                <span style={{ fontSize: '0.95rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                  {golfProfile.username}
                </span>
                <span className={`badge ${subscriptionStatus === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                  {subscriptionStatus === 'active' ? `Active ${subscriptionPlan || 'Member'}` : 'Member'}
                </span>
              </div>

              <div style={{ fontSize: '0.92rem', color: '#2D6846', fontWeight: 600, marginTop: '2px' }}>
                {golfProfile.playingLevel} Golfer • Handicap {golfProfile.handicapIndex}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                <span>✉️ {email}</span>
                {golfProfile.phone && <span>📞 {golfProfile.phone}</span>}
                {golfProfile.location && <span>📍 {golfProfile.location}</span>}
                {createdAt && <span>🗓️ Member since {createdAt}</span>}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsEditing(!isEditing)}
            style={{ fontWeight: 600 }}
          >
            {isEditing ? '✕ Close Editor' : '✏️ Edit Profile'}
          </button>
        </div>

        {/* Inline Edit Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} style={{ marginTop: '1.75rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border-subtle)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text-primary)' }}>
              Edit Profile & Golf Attributes
            </h3>

            <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={golfProfile.username}
                  onChange={(e) => setGolfProfile({ ...golfProfile, username: e.target.value })}
                  placeholder="@handle"
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
                  placeholder="+91 98765 43210"
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
                  onChange={(e) => setGolfProfile({ ...golfProfile, playingLevel: e.target.value as 'Beginner' | 'Intermediate' | 'Advanced' })}
                >
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
                  <option value="White (Standard)">White (Standard)</option>
                  <option value="Blue (Championship)">Blue (Championship)</option>
                  <option value="Black (Tour)">Black (Tour)</option>
                  <option value="Gold (Senior)">Gold (Senior)</option>
                  <option value="Red (Forward)">Red (Forward)</option>
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
                  placeholder="e.g. 5 Years"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Playing Format</label>
                <select
                  className="form-input"
                  value={golfProfile.preferredFormat}
                  onChange={(e) => setGolfProfile({ ...golfProfile, preferredFormat: e.target.value })}
                >
                  <option value="Individual Stableford (18-Hole)">Individual Stableford (18-Hole)</option>
                  <option value="Individual Stroke Play (Gross/Net)">Individual Stroke Play (Gross/Net)</option>
                  <option value="Match Play">Match Play</option>
                  <option value="2-Man / 4-Man Scramble">2-Man / 4-Man Scramble</option>
                </select>
              </div>

              <div className="form-group">
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
                {saving ? 'Saving Changes...' : 'Save Profile Changes'}
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
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⛳</span>
          <span>Golf Profile</span>
        </h3>

        <div className="grid grid-3" style={{ gap: '1rem' }}>
          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Handicap Index
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {golfProfile.handicapIndex}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Playing Level
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {golfProfile.playingLevel}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Preferred Tee
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {golfProfile.preferredTee}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Home Course
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {golfProfile.homeCourse}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Favorite Course
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {golfProfile.favoriteCourse}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Playing Experience
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {golfProfile.yearsPlaying}
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Average Score
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 600, color: '#2D6846' }}>
              {avgScore} Pts
            </span>
          </div>

          <div style={{ padding: '1.1rem', background: 'var(--color-bg-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', gridColumn: 'span 2' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Preferred Playing Format
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {golfProfile.preferredFormat}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Statistics (Tracked Backend Data) ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📊</span>
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
            <div className="stat-value" style={{ fontSize: '1.8rem', color: '#2D6846' }}>{avgScore}</div>
            <div className="stat-label">Average Score</div>
          </div>

          <div className="stat-card" style={{ padding: '1.25rem' }}>
            <div className="stat-value" style={{ fontSize: '1.8rem', color: 'var(--color-accent)' }}>{bestScore}</div>
            <div className="stat-label">Best Score</div>
          </div>

          <div className="stat-card" style={{ padding: '1.25rem' }}>
            <div className="stat-value" style={{ fontSize: '1.8rem' }}>{golfProfile.handicapIndex}</div>
            <div className="stat-label">Current Handicap</div>
          </div>
        </div>
      </div>

      {/* ── 4. Recent Activity ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⛳</span>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>🏌️</span>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.92rem' }}>
                      Round at {golfProfile.homeCourse}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Played on {new Date(round.date_played).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
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

          {/* Tournament & Draw Participation Activity */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🎰</span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.92rem' }}>
                  Monthly Prize Draw Participation
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Active entry linked to your verified 5-round score average
                </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <span style={{ fontSize: '1.3rem' }}>💚</span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.92rem' }}>
                  Philanthropic Impact Allocation
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Directing {charityPercentage}% of membership to {charityName}
                </div>
              </div>
            </div>
            <Link href="/dashboard/charity" style={{ fontSize: '0.825rem', color: 'var(--color-primary)', fontWeight: 600 }}>
              Manage Charity →
            </Link>
          </div>
        </div>
      </div>

      {/* ── 5. Account Information (Compact) ── */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🔒</span>
          <span>Account Information</span>
        </h3>

        <div className="grid grid-2" style={{ gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Email Verification</span>
            <span style={{ color: '#2D6846', fontWeight: 600, fontSize: '0.875rem' }}>Verified ✅</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Phone Verification</span>
            <span style={{ color: golfProfile.phone ? '#2D6846' : 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>
              {golfProfile.phone ? 'Linked 📱' : 'Unlinked'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Account Creation Date</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>{createdAt || 'Recent'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--color-bg-surface)', borderRadius: '8px' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Account Status</span>
            <span style={{ color: subscriptionStatus === 'active' ? '#2D6846' : 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>
              {subscriptionStatus === 'active' ? 'Active Member' : 'Standard Golfer'}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
