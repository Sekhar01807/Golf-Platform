'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo/Logo';
import styles from './dashboard.module.css';

const navItems = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/dashboard/scores', icon: '⛳', label: 'Golf Scores' },
  { href: '/dashboard/charity', icon: '💚', label: 'My Charity' },
  { href: '/dashboard/draws', icon: '🎰', label: 'Monthly Draws' },
  { href: '/dashboard/winnings', icon: '🏆', label: 'Prize Winnings' },
  { href: '/dashboard/subscription', icon: '💳', label: 'Subscription' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profilePopupOpen, setProfilePopupOpen] = useState(false);
  const [userName, setUserName] = useState('Golfer');
  const [userEmail, setUserEmail] = useState('');
  const [userInitial, setUserInitial] = useState('G');
  const popupRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || '');
          
          const { data: profile } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', user.id)
            .single();

          const name = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Golfer';
          setUserName(name);
          setUserInitial(name.trim().charAt(0).toUpperCase() || 'G');
        }
      } catch {
        // Fallback default
      }
    }

    loadUserProfile();
  }, [supabase]);

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
    if (pathname === '/dashboard/scores') return { title: 'Golf Score Tracking', desc: 'Submit and manage your 18-hole Stableford scores (FIFO 5-round ledger).' };
    if (pathname === '/dashboard/charity') return { title: 'My Partner Charity', desc: 'Direct 10%–50% of your membership to verified philanthropic initiatives.' };
    if (pathname === '/dashboard/draws') return { title: 'Monthly Skill Draws', desc: 'Inspect monthly winning number outcomes and prize pool distributions.' };
    if (pathname === '/dashboard/winnings') return { title: 'Prize Winnings & Verification', desc: 'Submit scorecard verification links and track your payout status.' };
    if (pathname === '/dashboard/subscription') return { title: 'Membership & Billing', desc: 'Manage your monthly or annual subscription tier via Stripe.' };
    if (pathname === '/dashboard/profile') return { title: 'Golfer Profile', desc: 'View your golf handicap, performance statistics, and member credentials.' };
    if (pathname === '/dashboard/settings') return { title: 'Account Settings', desc: 'Manage your preferences, security credentials, notification toggles, and system defaults.' };
    return { title: 'Member Portal', desc: 'Welcome back to your GolfForGood member portal.' };
  };

  const pageMeta = getPageMeta();

  return (
    <div className={styles.dashLayout}>
      {/* ── Left Sidebar (NovaCall Style) ── */}
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

        {/* Navigation */}
        <nav className={styles.sidebarNav}>
          <div className={styles.navSectionLabel}>Navigation</div>
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

        {/* ── User Profile at Bottom of Sidebar (with Downward Dropdown Menu) ── */}
        <div className={styles.sidebarFooter} ref={popupRef}>
          {/* Profile Trigger Button */}
          <button
            type="button"
            className={`${styles.userProfileTrigger} ${profilePopupOpen ? styles.open : ''}`}
            onClick={() => setProfilePopupOpen(!profilePopupOpen)}
            aria-expanded={profilePopupOpen}
            aria-label="User profile options"
          >
            <div className={styles.userAvatar}>
              {userInitial}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName} title={userName}>
                {userName}
              </div>
              <div className={styles.userRole}>
                Active Member
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
                <span>👤</span>
                <span>My Profile</span>
              </Link>

              <Link
                href="/dashboard/settings"
                className={styles.popupItem}
                onClick={() => setProfilePopupOpen(false)}
              >
                <span>⚙️</span>
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
                <span>🚪</span>
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
            <Link href="/dashboard/scores" className={`${styles.topbarActionBtn} ${styles.topbarActionPrimary}`}>
              <span>+</span>
              <span>Submit Score</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className={styles.content}>
          {children}
        </main>
      </div>

      {/* Mobile Menu Toggle Button */}
      <button
        className={styles.mobileToggle}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle navigation menu"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>
    </div>
  );
}
