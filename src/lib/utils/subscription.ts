export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'lapsed';
export type SubscriptionPlan = 'monthly' | 'yearly' | null;

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  startDate?: string | null;
  endDate?: string | null;
}

export interface ComputedMembership {
  isPremium: boolean;
  label: string;
  badgeClass: string;
  badgeStyle: React.CSSProperties;
  color: string;
  subLabel: string;
}

/**
 * Computes live subscription status taking into account active period dates.
 * If expired, it automatically reverts the user from Premium to Expired/Free state.
 */
export function getMembershipDetails(info: SubscriptionInfo): ComputedMembership {
  const { status, plan, endDate } = info;

  // Check if subscription has expired based on end date
  const isExpired = endDate ? new Date(endDate).getTime() < Date.now() : false;

  if (status === 'active' && !isExpired) {
    const planName = plan === 'yearly' ? 'Annual Premium' : plan === 'monthly' ? 'Monthly Premium' : 'Premium';
    return {
      isPremium: true,
      label: `Active ${planName} Member`,
      badgeClass: 'badge-active',
      badgeStyle: {
        background: 'linear-gradient(135deg, rgba(33, 78, 52, 0.15) 0%, rgba(45, 104, 70, 0.25) 100%)',
        color: '#1E6B42',
        border: '1px solid rgba(45, 104, 70, 0.4)',
        fontWeight: 700,
        letterSpacing: '0.02em',
      },
      color: '#1E6B42',
      subLabel: plan === 'yearly' ? 'Annual Pass Active' : 'Monthly Pass Active',
    };
  }

  if (status === 'cancelled' || isExpired) {
    return {
      isPremium: false,
      label: 'Membership Expired',
      badgeClass: 'badge-pending',
      badgeStyle: {
        background: 'rgba(217, 119, 6, 0.12)',
        color: '#B45309',
        border: '1px solid rgba(217, 119, 6, 0.3)',
        fontWeight: 600,
      },
      color: '#B45309',
      subLabel: 'Subscription Ended',
    };
  }

  // Free / Inactive Golfer
  return {
    isPremium: false,
    label: 'Free Golfer',
    badgeClass: 'badge-inactive',
    badgeStyle: {
      background: 'rgba(100, 116, 139, 0.12)',
      color: '#64748B',
      border: '1px solid rgba(100, 116, 139, 0.25)',
      fontWeight: 600,
    },
    color: '#64748B',
    subLabel: 'Free Account',
  };
}
