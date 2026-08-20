'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo/Logo';
import {
  DashboardIcon,
  ScorecardIcon,
  HeartIcon,
  TicketIcon,
  TrophyIcon,
  CreditCardIcon,
  UserIcon,
  SettingsIcon,
  LogoutIcon,
} from '@/components/Icons/Icons';
import { getMembershipDetails, ComputedMembership } from '@/lib/utils/subscription';
import styles from './dashboard.module.css';

const navItems = [
  { href: '/dashboard', icon: <DashboardIcon size={18} />, label: 'Dashboard' },
  { href: '/dashboard/scores', icon: <ScorecardIcon size={18} />, label: 'Golf Scores' },
  { href: '/dashboard/charity', icon: <HeartIcon size={18} />, label: 'My Charity' },
  { href: '/dashboard/draws', icon: <TicketIcon size={18} />, label: 'Monthly Draws' },
  { href: '/dashboard/winnings', icon: <TrophyIcon size={18} />, label: 'Prize Winnings' },
  { href: '/dashboard/subscription', icon: <CreditCardIcon size={18} />, label: 'Subscription' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profilePopupOpen, setProfilePopupOpen] = useState(false);
  const [userName, setUserName] = useState('Golfer');
  const [userEmail, setUserEmail] = useState('');
  const [userInitial, setUserInitial] = useState('G');
  const [membership, setMembership] = useState<ComputedMembership>({
    isPremium: false,
    label: 'Free Golfer',
    badgeClass: 'badge-inactive',
    badgeStyle: {},
    color: '#94A3B8',
    subLabel: 'Free Account',
  });

  const popupRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUserEmail(data.user.email || '');
            const name = data.profile?.full_name || data.user.metadata?.full_name || data.user.email?.split('@')[0] || 'Golfer';
            setUserName(name);
            setUserInitial(name.trim().charAt(0).toUpperCase() || 'G');

            if (data.profile) {
              const computed = getMembershipDetails({
                status: data.profile.subscription_status || 'inactive',
                plan: data.profile.subscription_plan || null,
                endDate: data.profile.subscription_end_date || null,
              });
              setMembership(computed);
            }
            return;
          }
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || '');
          
          const { data: profile } = await supabase
            .from('users')
            .select('full_name, subscription_status, subscription_plan, subscription_end_date')
            .eq('id', user.id)
            .single();

          const name = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Golfer';
          setUserName(name);
          setUserInitial(name.trim().charAt(0).toUpperCase() || 'G');

          if (profile) {
            const computed = getMembershipDetails({
              status: profile.subscription_status || 'inactive',
              plan: profile.subscription_plan || null,
              endDate: profile.subscription_end_date || null,
            });
            setMembership(computed);
          }
        }
      } catch {
        // Fallback default
      }
    }

    loadUserProfile();

    const handleProfileUpdated = (e: any) => {
      if (e?.detail?.fullName) {
        setUserName(e.detail.fullName);
        setUserInitial(e.detail.fullName.trim().charAt(0).toUpperCase() || 'G');
      }
      loadUserProfile();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('profile-updated', handleProfileUpdated);
      return () => {
        window.removeEventListener('profile-updated', handleProfileUpdated);
      };
    }
  }, [supabase, pathname]);

  // Click outside to close sidebar profile popup
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setProfilePopupOpen(false);
      }
    }

    if (profilePopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profilePopupOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  // Dynamic Page Title
  const getPageMeta = () => {
    if (pathname === '/dashboard') return { title: 'Dashboard Overview', desc: `Welcome back, ${userName}! Track your scores and philanthropic impact.` };
    if (pathname === '/dashboard/scores') return { title: 'Stableford Scores Ledger', desc: 'Submit and verify your latest 18-hole Stableford performance rounds.' };
    if (pathname === '/dashboard/charity') return { title: 'Charity Giving Allocation', desc: 'Direct 10% to 50% of your membership to verified nonprofit causes.' };
    if (pathname === '/dashboard/draws') return { title: 'Monthly Skill Draws', desc: 'Inspect monthly winning number draws, prize pools, and matching rules.' };
    if (pathname === '/dashboard/winnings') return { title: 'Prize Claims & Winnings', desc: 'Review earned prize winnings and submit verified round scorecards.' };
    if (pathname === '/dashboard/subscription') return { title: 'Membership & Billing', desc: 'Manage your monthly or annual subscription tier and invoices.' };
    if (pathname === '/dashboard/profile') return { title: 'Golfer Profile', desc: 'View and manage your golf attributes, performance stats, and records.' };
    if (pathname === '/dashboard/settings') return { title: 'Account Settings', desc: 'Security, notification toggles, preferences, and privacy controls.' };
    return { title: 'Member Portal', desc: 'Skill-based golf score tracking and philanthropic impact.' };
  };

  const pageMeta = getPageMeta();

  return (
    <div className={styles.dashLayout}>
      {/* ── Left Sidebar Navigation ── */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
        {/* Brand Header */}
        <div className={styles.sidebarHeader}>
          <Link href="/dashboard" className={styles.brandLink}>
            <Logo size={36} />
            <span className={styles.brandTitle}>
              Golf<span>ForGood</span>
            </span>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className={styles.sidebarNav}>
          <div className={styles.navSectionLabel}>Member Navigation</div>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.sidebarLink} ${isActive ? styles.active : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={styles.sidebarIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── User Profile at Bottom of Sidebar (with Downward Popup Menu) ── */}
        <div className={styles.sidebarFooter} ref={popupRef}>
          <button
            type="button"
            className={`${styles.userProfileTrigger} ${profilePopupOpen ? styles.open : ''}`}
            onClick={() => setProfilePopupOpen(!profilePopupOpen)}
            aria-expanded={profilePopupOpen}
            aria-label="User profile options"
          >
            <div
              className={styles.userAvatar}
              style={{
                border: membership.isPremium ? '2px solid #D4A84F' : '2px solid rgba(255,255,255,0.2)',
                boxShadow: membership.isPremium ? '0 0 10px rgba(212, 168, 79, 0.4)' : 'none',
              }}
            >
              {userInitial}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName} title={userName}>
                {userName}
              </div>
              <div
                className={styles.userRole}
                style={{
                  color: membership.isPremium ? '#E0BC6D' : membership.color,
                  fontWeight: membership.isPremium ? 700 : 500,
                }}
              >
                {membership.isPremium ? 'Active Premium' : membership.label}
              </div>
            </div>
            <span className={`${styles.sidebarChevron} ${profilePopupOpen ? styles.rotate : ''}`}>▼</span>
          </button>

          {/* Smooth Downward Popup (Profile, Settings & Logout) */}
          {profilePopupOpen && (
            <div className={styles.sidebarProfilePopup}>
              <Link
                href="/dashboard/profile"
                className={styles.popupItem}
                onClick={() => setProfilePopupOpen(false)}
              >
                <UserIcon size={16} />
                <span>My Profile</span>
              </Link>

              <Link
                href="/dashboard/settings"
                className={styles.popupItem}
                onClick={() => setProfilePopupOpen(false)}
              >
                <SettingsIcon size={16} />
                <span>Account Settings</span>
              </Link>

              <div className={styles.popupDivider} />

              <button
                type="button"
                className={`${styles.popupItem} ${styles.popupLogout}`}
                onClick={() => {
                  setProfilePopupOpen(false);
                  handleLogout();
                }}
              >
                <LogoutIcon size={16} />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Dashboard Area ── */}
      <div className={styles.mainContainer}>
        {/* Top Bar Header (Clean layout with vivid Submit button) */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <h1>{pageMeta.title}</h1>
            <p>{pageMeta.desc}</p>
          </div>

          <div className={styles.topbarRight}>
            <Link
              href="/dashboard/scores"
              className={`${styles.topbarActionBtn} ${styles.topbarActionPrimary}`}
              onClick={(e) => {
                if (pathname === '/dashboard/scores') {
                  e.preventDefault();
                  const scoreInput = document.getElementById('score-input') as HTMLInputElement | null;
                  if (scoreInput) {
                    scoreInput.focus();
                    scoreInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }
              }}
            >
              <span>+ Add Score</span>
            </Link>
          </div>
        </header>

        {/* Content Area */}
        <main className={styles.content}>
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Toggle Button */}
      <button
        className={styles.mobileToggle}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar navigation"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>
    </div>
  );
}
