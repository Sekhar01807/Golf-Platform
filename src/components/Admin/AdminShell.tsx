'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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

  return (
    <div className={styles.dashLayout}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.25rem' }}>⚙️</span>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Admin Control</h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{adminEmail || 'Administrator'}</p>
        </div>

        <nav className={styles.sidebarNav}>
          {adminNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.sidebarLink} ${pathname === item.href ? styles.active : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.sidebarIcon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link
            href="/dashboard"
            className={styles.sidebarLink}
            style={{ marginBottom: '4px' }}
          >
            <span className={styles.sidebarIcon}>🏠</span>
            User Dashboard
          </Link>
          <button
            onClick={handleLogout}
            className={styles.sidebarLink}
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-error)' }}
          >
            <span className={styles.sidebarIcon}>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        {children}
      </main>

      <button
        className={styles.mobileToggle}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>
    </div>
  );
}
