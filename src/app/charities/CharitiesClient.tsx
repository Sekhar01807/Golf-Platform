'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

interface Charity {
  id: string;
  name: string;
  description: string;
  image_url?: string | null;
  is_featured: boolean;
  total_contributions: number;
  upcoming_events?: string | null;
}

const charityImages: Record<string, string> = {
  'Youth Golf Foundation': '/youth-golf-foundation.png',
  'Green Earth Initiative': '/green-earth-initiative.png',
  'Veterans on the Fairway': '/veterans-fairway.png',
  'Golf for Good': '/golf-for-good.png',
  'Fairway to Health': '/fairway-to-health.png',
  'Women in Golf': '/women-in-golf.png',
};

const PRESET_AMOUNTS = [250, 500, 1000, 2500];

export default function CharitiesClient({ charities }: { charities: Charity[] }) {
  const searchParams = useSearchParams();
  const donationStatus = searchParams.get('donation');
  const donatedCharity = searchParams.get('charity');

  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [amount, setAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOpenDonate = (charity: Charity) => {
    setSelectedCharity(charity);
    setAmount(500);
    setCustomAmount('');
    setError('');
  };

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharity) return;

    const finalAmount = customAmount ? parseInt(customAmount, 10) : amount;

    if (isNaN(finalAmount) || finalAmount < 10) {
      setError('Minimum donation amount is ₹10');
      return;
    }

    if (finalAmount > 1000000) {
      setError('Maximum single donation amount is ₹1,000,000');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charity_id: selectedCharity.id,
          amount: finalAmount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to initiate donation session');
        setLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('No checkout URL returned from payment gateway');
        setLoading(false);
      }
    } catch {
      setError('Network error processing donation. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      {donationStatus === 'success' && (
        <div className="container" style={{ marginBottom: '2rem' }}>
          <div className="alert alert-success" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>💚</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Thank You For Your Generous Donation!</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                Your direct contribution to <strong>{donatedCharity || 'our partner charity'}</strong> has been received and verified.
              </div>
            </div>
          </div>
        </div>
      )}

      {donationStatus === 'cancelled' && (
        <div className="container" style={{ marginBottom: '2rem' }}>
          <div className="alert alert-warning" style={{ padding: '1rem 1.25rem' }}>
            Donation checkout was cancelled. No charges were made.
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {charities.map((charity) => {
          const imgSrc = charity.image_url || charityImages[charity.name] || '/youth-golf-foundation.png';
          return (
            <div key={charity.id} className={`card ${styles.charityCard}`}>
              <div className={styles.imageContainer}>
                <Image
                  src={imgSrc}
                  alt={charity.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  style={{ objectFit: 'cover' }}
                />
                {charity.is_featured && (
                  <span className={`badge badge-accent ${styles.featuredBadge}`}>Featured Cause</span>
                )}
              </div>
              <div className={styles.cardContent}>
                <h3 className={styles.charityName}>{charity.name}</h3>
                <p className={styles.charityDesc}>{charity.description}</p>

                <div className={styles.contributedMetric}>
                  <span className={styles.metricLabel}>Community Contributions</span>
                  <span className={styles.metricValue}>
                    ₹{Number(charity.total_contributions || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                {charity.upcoming_events && (
                  <div className={styles.eventBadge}>
                    {charity.upcoming_events}
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem', fontWeight: 600 }}
                  onClick={() => handleOpenDonate(charity)}
                >
                  ❤️ Donate Directly
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Direct Donation Modal */}
      {selectedCharity && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCharity(null);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '2rem',
              position: 'relative',
              background: '#FFFFFF',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedCharity(null)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
              }}
            >
              ✕
            </button>

            <div style={{ marginBottom: '1.25rem' }}>
              <div className="badge badge-accent" style={{ marginBottom: '0.5rem' }}>Direct Giving</div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Support {selectedCharity.name}
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                100% of your tax-deductible contribution routes directly to this verified partner.
              </p>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleDonate}>
              <label className="form-label" style={{ fontWeight: 600 }}>Select Amount</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`btn btn-sm ${!customAmount && amount === preset ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontWeight: 700 }}
                    onClick={() => {
                      setAmount(preset);
                      setCustomAmount('');
                    }}
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="custom-donation">Or Enter Custom Amount (₹)</label>
                <input
                  id="custom-donation"
                  type="number"
                  className="form-input"
                  placeholder="e.g. 5000"
                  min={10}
                  max={1000000}
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '0.85rem', fontWeight: 700, fontSize: '1rem' }}
              >
                {loading ? 'Opening Secure Checkout...' : `Proceed to Donate ₹${(customAmount ? parseInt(customAmount, 10) || 0 : amount).toLocaleString('en-IN')}`}
              </button>

              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>
                🔒 Encrypted & processed securely via Stripe. Instant confirmation.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
