'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './dashboard.module.css';

const navItems = [
  { href: '/dashboard', icon: '🏠', label: 'Overview' },
  { href: '/dashboard/scores', icon: '⛳', label: 'My Scores' },
  { href: '/dashboard/charity', icon: '💚', label: 'My Charity' },
  { href: '/dashboard/draws', icon: '🎰', label: 'Draws' },
  { href: '/dashboard/winnings', icon: '🏆', label: 'Winnings' },
  { href: '/dashboard/subscription', icon: '💳', label: 'Subscription' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
          <h2>Member Dashboard</h2>
          <p>Track your golf & charitable impact</p>
        </div>
        <nav className={styles.sidebarNav}>
          {navItems.map((item) => (
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
        aria-label="Toggle navigation menu"
      >
        ☰
      </button>
    </div>
  );
}
