'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast/Toast';

export default function CharityPage() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [charities, setCharities] = useState<{ id: string; name: string; description: string }[]>([]);
  const [selectedCharity, setSelectedCharity] = useState('');
  const [percentage, setPercentage] = useState(10);
  const [totalDonated, setTotalDonated] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 1. Fetch available partner charities
      const { data: charitiesData } = await supabase
        .from('charities')
        .select('id, name, description')
        .order('name');

      setCharities(charitiesData || []);

      // 2. Fetch user profile preferences
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('selected_charity_id, charity_contribution_percentage')
          .eq('id', user.id)
          .single();

        if (profile) {
          setSelectedCharity(profile.selected_charity_id || (charitiesData?.[0]?.id ?? ''));
          setPercentage(profile.charity_contribution_percentage || 10);
        }

        // 3. Sum verified completed donations
        const { data: donations } = await supabase
          .from('independent_donations')
          .select('amount')
          .eq('user_id', user.id)
          .eq('payment_status', 'completed');

        const total = (donations || []).reduce((sum: number, d: { amount: number | string }) => sum + Number(d.amount), 0);
        setTotalDonated(total);
      }
    } catch {
      showToast('Failed to load charity preferences', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from('users')
          .update({
            selected_charity_id: selectedCharity,
            charity_contribution_percentage: percentage,
          })
          .eq('id', user.id);

        if (error) throw error;
        showToast('Charity preferences updated successfully!', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading charity preferences...
      </div>
    );
  }

  const selectedCharityObj = charities.find((c) => c.id === selectedCharity);

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          My Supported Charity
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
          Choose which non-profit receives your subscription contributions (minimum 10%, up to 50%).
        </p>
      </div>

      <div className="grid-2" style={{ alignItems: 'flex-start', marginBottom: 'var(--space-2xl)' }}>
        {/* Preference Form */}
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
            Charity Allocation
          </h3>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Select Partner Charity</label>
              <select
                className="form-select"
                value={selectedCharity}
                onChange={(e) => setSelectedCharity(e.target.value)}
                required
              >
                <option value="">— Choose a charity —</option>
                {charities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Contribution Rate</label>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1.1rem' }}>
                  {percentage}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={50}
                step={5}
                value={percentage}
                onChange={(e) => setPercentage(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--color-primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                <span>10% (Platform Base)</span>
                <span>25%</span>
                <span>50% (Max Impact)</span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 'var(--space-lg)' }}>
              {saving ? 'Saving...' : 'Save Charity Preferences'}
            </button>
          </form>
        </div>

        {/* Selected Charity Summary Card */}
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
            Active Impact Summary
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div className="stat-label">Currently Supporting</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {selectedCharityObj?.name || 'None Selected'}
              </div>
              {selectedCharityObj?.description && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                  {selectedCharityObj.description}
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-subtle)' }}>
              <div>
                <div className="stat-label">Subscription Rate</div>
                <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: '2px' }}>{percentage}%</div>
              </div>
              <div>
                <div className="stat-label">Direct Donations</div>
                <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: '2px' }}>
                  ₹{totalDonated.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
