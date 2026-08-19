'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo/Logo';
import {
  DashboardIcon,
  UsersIcon,
  HeartIcon,
  TicketIcon,
  TrophyIcon,
  BarChartIcon,
  LogoutIcon,
} from '@/components/Icons/Icons';
import styles from '@/app/dashboard/dashboard.module.css';

const adminNavItems = [
  { href: '/admin', icon: <DashboardIcon size={18} />, label: 'Overview' },
  { href: '/admin/users', icon: <UsersIcon size={18} />, label: 'Users' },
  { href: '/admin/charities', icon: <HeartIcon size={18} />, label: 'Charities' },
  { href: '/admin/draws', icon: <TicketIcon size={18} />, label: 'Draws & Engine' },
  { href: '/admin/winners', icon: <TrophyIcon size={18} />, label: 'Winners & Payouts' },
  { href: '/admin/analytics', icon: <BarChartIcon size={18} />, label: 'Analytics' },
];

export default function AdminShell({
  children,
  adminEmail,
}: {
  children: React.ReactNode;
  adminEmail?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profilePopupOpen, setProfilePopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

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

  const initial = adminEmail ? adminEmail.trim().charAt(0).toUpperCase() : 'A';
  const displayEmail = adminEmail || 'admin@golfforgood.org';
  const displayName = displayEmail.split('@')[0];

  return (
    <div className={styles.dashLayout}>
      {/* ── Left Admin Sidebar ── */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
        {/* Brand Header */}
        <div className={styles.sidebarHeader}>
          <Link href="/admin" className={styles.brandLink}>
            <Logo size={36} />
            <span className={styles.brandTitle}>
              Golf<span>Admin</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className={styles.sidebarNav}>
          <div className={styles.navSectionLabel}>Administration</div>
          {adminNavItems.map((item) => {
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
            aria-label="Admin profile options"
          >
            <div className={styles.userAvatar} style={{ background: 'linear-gradient(135deg, #D4A84F 0%, #B88E39 100%)', color: '#18231C' }}>
              {initial}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName} title={displayName}>
                {displayName}
              </div>
              <div className={styles.userRole} style={{ color: '#E0BC6D' }} title="System Administrator">
                Administrator
              </div>
            </div>
            <span className={`${styles.sidebarChevron} ${profilePopupOpen ? styles.rotate : ''}`}>▼</span>
          </button>

          {profilePopupOpen && (
            <div className={styles.sidebarProfilePopup}>
              <Link
                href="/dashboard"
                className={styles.popupItem}
                onClick={() => setProfilePopupOpen(false)}
              >
                <DashboardIcon size={16} />
                <span>Member Portal</span>
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

      {/* ── Main Admin Area ── */}
      <div className={styles.mainContainer}>
        {/* Top Bar */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <h1>Admin Control Center</h1>
            <p>System Administration, Draw Automation & Verified Ledger</p>
          </div>

          <div className={styles.topbarRight}>
            <Link href="/admin/draws" className={`${styles.topbarActionBtn} ${styles.topbarActionPrimary}`}>
              <span>Simulate Draw</span>
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className={styles.content}>
          {children}
        </main>
      </div>

      {/* Mobile Toggle */}
      <button
        className={styles.mobileToggle}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle admin sidebar"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>
    </div>
  );
}
