import { createClient } from '@/lib/supabase/server';
import CheckoutButton from '@/components/CheckoutButton';
import BillingButton from '@/components/BillingButton';
import { getMembershipDetails } from '@/lib/utils/subscription';
import { CrownIcon, CheckCircleIcon, CreditCardIcon, ShieldIcon } from '@/components/Icons/Icons';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams?: Promise<{ cancelled?: string }> | { cancelled?: string };
}) {
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : undefined;
  const isCancelled = resolvedParams?.cancelled === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isCancelled) {
    // Automatically clear any active checkout lock when user returns after cancelling
    await supabase.from('users').update({ checkout_lock_until: null }).eq('id', user.id);
  }

  let subscription = {
    status: 'inactive' as any,
    plan: null as any,
    charityContribution: '10%',
    renewalDate: '—',
    endDate: null as string | null,
  };

  let membership = getMembershipDetails({
    status: 'inactive',
    plan: null,
    endDate: null,
  });

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('subscription_status, subscription_plan, subscription_end_date, charity_contribution_percentage')
      .eq('id', user.id)
      .single();

    if (profile) {
      subscription = {
        status: profile.subscription_status || 'inactive',
        plan: profile.subscription_plan || null,
        charityContribution: `${profile.charity_contribution_percentage || 10}%`,
        renewalDate: profile.subscription_end_date
          ? new Date(profile.subscription_end_date).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : '—',
        endDate: profile.subscription_end_date || null,
      };

      membership = getMembershipDetails({
        status: profile.subscription_status || 'inactive',
        plan: profile.subscription_plan || null,
        endDate: profile.subscription_end_date || null,
      });
    }
  }

  const isPremium = membership.isPremium;

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

      {isCancelled && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(212, 168, 79, 0.12)',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-xl)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--color-text-primary)',
            fontSize: '0.9rem',
          }}
        >
          <CreditCardIcon size={18} color="var(--color-accent)" />
          <span>Checkout session was cancelled. Your account lock has been reset and you may choose a plan whenever you are ready.</span>
        </div>
      )}

      {/* Current Subscription Status */}
      <div className="card" style={{ marginBottom: 'var(--space-2xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Membership Overview</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Your active subscription enables score logging and monthly prize draw eligibility.
            </p>
          </div>
          <span className="badge" style={membership.badgeStyle}>
            {isPremium && <CrownIcon size={14} color="#D4A84F" style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
            {membership.label}
          </span>
        </div>

        <div className="grid-4" style={{ gap: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-subtle)' }}>
          <div>
            <div className="stat-label">Active Plan</div>
            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px', textTransform: 'capitalize', fontSize: '1.05rem' }}>
              {subscription.plan === 'monthly' ? 'Monthly Pass' : subscription.plan === 'yearly' ? 'Annual Pass' : 'Free Golfer'}
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
            <div style={{ fontWeight: 700, color: isPremium ? 'var(--color-primary)' : 'var(--color-text-muted)', marginTop: '4px', fontSize: '1.05rem' }}>
              {isPremium ? 'Eligible for Jackpot' : 'Subscription Required'}
            </div>
          </div>
        </div>
      </div>

      {/* Plan Selection Cards */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-2xl)' }}>
        {/* Monthly Card */}
        <div className="card" style={{ border: subscription.plan === 'monthly' && isPremium ? '2px solid var(--color-primary)' : undefined }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Monthly Pass</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)' }}>₹499</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>/ month</span>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Complete score tracking, charity contributions, and full monthly jackpot eligibility with cancel-anytime flexibility.
          </p>

          {subscription.plan === 'monthly' && isPremium ? (
            <span className="badge badge-active" style={{ padding: '0.5rem 1rem', width: '100%', textAlign: 'center', display: 'block' }}>
              Current Active Plan
            </span>
          ) : isPremium ? (
            <BillingButton className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
              Switch to Monthly in Billing Portal
            </BillingButton>
          ) : (
            <CheckoutButton plan="monthly" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
              Subscribe Monthly
            </CheckoutButton>
          )}
        </div>

        {/* Yearly Card */}
        <div className="card" style={{ border: subscription.plan === 'yearly' && isPremium ? '2px solid var(--color-accent)' : undefined, position: 'relative' }}>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
            <span className="badge badge-accent">Save 17%</span>
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Annual Pass</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-accent)' }}>₹4,999</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>/ year</span>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Best value for regular golfers. 12 months of guaranteed jackpot draws and maximum cumulative charity contributions.
          </p>

          {subscription.plan === 'yearly' && isPremium ? (
            <span className="badge badge-active" style={{ padding: '0.5rem 1rem', width: '100%', textAlign: 'center', display: 'block' }}>
              Current Active Plan
            </span>
          ) : isPremium ? (
            <BillingButton className="btn btn-accent btn-sm" style={{ width: '100%' }}>
              Switch to Annual in Billing Portal
            </BillingButton>
          ) : (
            <CheckoutButton plan="yearly" className="btn btn-accent btn-sm" style={{ width: '100%' }}>
              Subscribe Annual (Save 17%)
            </CheckoutButton>
          )}
        </div>
      </div>

      {/* Stripe Customer Portal Section */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '2px' }}>Stripe Customer Billing Portal</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Update credit cards, download tax invoices, or cancel recurring billing through Stripe’s encrypted portal.
          </p>
        </div>
        <BillingButton className="btn btn-secondary btn-sm" />
      </div>
    </div>
  );
}
