'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo/Logo';
import styles from '@/app/dashboard/dashboard.module.css';

const adminNavItems = [
  { href: '/admin', icon: '📊', label: 'Overview' },
  { href: '/admin/users', icon: '👥', label: 'Users' },
  { href: '/admin/charities', icon: '💚', label: 'Charities' },
  { href: '/admin/draws', icon: '🎰', label: 'Draws & Engine' },
  { href: '/admin/winners', icon: '🏆', label: 'Winners & Payouts' },
  { href: '/admin/analytics', icon: '📈', label: 'Analytics' },
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
  const supabase = createClient();

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

        {/* User Profile Card (Bottom of Sidebar) */}
        <div className={styles.sidebarFooter}>
          <div className={styles.userProfileCard}>
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
            <button
              onClick={handleLogout}
              className={styles.signOutBtn}
              title="Sign Out"
              aria-label="Sign Out"
            >
              🚪
            </button>
          </div>
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
              <span>🎰 Simulate Draw</span>
            </Link>
            <Link href="/dashboard" className={`${styles.topbarActionBtn} ${styles.topbarActionSecondary}`}>
              <span>Member Portal ↗</span>
            </Link>
            <Link href="/" className={`${styles.topbarActionBtn} ${styles.topbarActionSecondary}`} title="View Public Website">
              <span>Home ↗</span>
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
