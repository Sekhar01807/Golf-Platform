import { createClient } from '@/lib/supabase/server';
import CheckoutButton from '@/components/CheckoutButton';
import BillingButton from '@/components/BillingButton';

export const dynamic = 'force-dynamic';

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let subscription = {
    status: 'inactive',
    plan: 'none',
    charityContribution: '10%',
    renewalDate: '—',
  };

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('subscription_status, subscription_plan, subscription_end_date, charity_contribution_percentage')
      .eq('id', user.id)
      .single();

    if (profile) {
      subscription = {
        status: profile.subscription_status || 'inactive',
        plan: profile.subscription_plan || 'none',
        charityContribution: `${profile.charity_contribution_percentage || 10}%`,
        renewalDate: profile.subscription_end_date
          ? new Date(profile.subscription_end_date).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : '—',
      };
    }
  }

  const isActive = subscription.status === 'active';

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          Membership & Billing
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
          Manage your GolfForGood subscription tier, invoice history, and payment details securely via Stripe.
        </p>
      </div>

      {/* Current Subscription Status */}
      <div className="card" style={{ marginBottom: 'var(--space-2xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Membership Overview</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Your active subscription enables score logging and monthly prize draw eligibility.
            </p>
          </div>
          <span className={`badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
            {isActive ? 'Active Member' : 'Inactive / Lapsed'}
          </span>
        </div>

        <div className="grid-4" style={{ gap: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-subtle)' }}>
          <div>
            <div className="stat-label">Active Plan</div>
            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px', textTransform: 'capitalize', fontSize: '1.05rem' }}>
              {subscription.plan === 'monthly' ? 'Monthly Pass' : subscription.plan === 'yearly' ? 'Annual Pass' : 'None Selected'}
            </div>
          </div>

          <div>
            <div className="stat-label">Next Renewal / Expiry</div>
            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px', fontSize: '1.05rem' }}>
              {subscription.renewalDate}
            </div>
          </div>

          <div>
            <div className="stat-label">Charity Share</div>
            <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px', fontSize: '1.05rem' }}>
              {subscription.charityContribution} of dues
            </div>
          </div>

          <div>
            <div className="stat-label">Prize Draw Status</div>
            <div style={{ fontWeight: 700, color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)', marginTop: '4px', fontSize: '1.05rem' }}>
              {isActive ? '✓ Eligible for Jackpot' : '✗ Membership Required'}
            </div>
          </div>
        </div>
      </div>

      {/* Plan Selection Cards */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-2xl)' }}>
        {/* Monthly Card */}
        <div className="card" style={{ border: subscription.plan === 'monthly' ? '2px solid var(--color-primary)' : undefined }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Monthly Pass</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)' }}>₹499</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>/ month</span>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Complete score tracking, charity contributions, and full monthly jackpot eligibility with cancel-anytime flexibility.
          </p>

          {subscription.plan === 'monthly' && isActive ? (
            <span className="badge badge-active" style={{ padding: '0.5rem 1rem' }}>✓ Current Active Plan</span>
          ) : (
            <CheckoutButton plan="monthly" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
              {isActive ? 'Switch to Monthly' : 'Subscribe Monthly'}
            </CheckoutButton>
          )}
        </div>

        {/* Yearly Card */}
        <div className="card" style={{ border: subscription.plan === 'yearly' ? '2px solid var(--color-primary)' : undefined, position: 'relative' }}>
          <span className="badge badge-accent" style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
            Save 17% (2 Months Free)
          </span>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Annual Pass</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)' }}>₹4,999</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>/ year</span>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Best value for regular golfers. 12 months of guaranteed prize draw participation and higher charity fundraising impact.
          </p>

          {subscription.plan === 'yearly' && isActive ? (
            <span className="badge badge-active" style={{ padding: '0.5rem 1rem' }}>✓ Current Active Plan</span>
          ) : (
            <CheckoutButton plan="yearly" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
              {isActive ? 'Upgrade to Annual' : 'Subscribe Annual (Best Value)'}
            </CheckoutButton>
          )}
        </div>
      </div>

      {/* Stripe Customer Portal */}
      <div className="card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Billing & Invoicing Portal</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          Update payment methods, view historical receipts, or cancel renewal through the encrypted Stripe Customer Portal.
        </p>
        <BillingButton className="btn btn-secondary btn-sm">
          Open Stripe Billing Portal →
        </BillingButton>
      </div>
    </div>
  );
}
