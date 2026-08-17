'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className={styles.navbar}>
      <div className={`container ${styles.navContainer}`}>
        <Link href="/" className={styles.logo}>
          <div className={styles.logoMark}>⛳</div>
          <span className={styles.logoText}>
            Golf<span>ForGood</span>
          </span>
        </Link>

        <nav className={`${styles.navLinks} ${mobileOpen ? styles.open : ''}`}>
          <Link
            href="/how-it-works"
            className={`${styles.navLink} ${isActive('/how-it-works') ? styles.active : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            How It Works
          </Link>
          <Link
            href="/charities"
            className={`${styles.navLink} ${isActive('/charities') ? styles.active : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Charities
          </Link>
          <Link
            href="/dashboard"
            className={`${styles.navLink} ${isActive('/dashboard') ? styles.active : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href="/auth/login"
            className={`${styles.navLink} ${isActive('/auth/login') ? styles.active : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="btn btn-primary btn-sm"
            onClick={() => setMobileOpen(false)}
          >
            Join GolfForGood
          </Link>
        </nav>

        <button
          className={styles.hamburger}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
        >
          <span className={`${styles.bar} ${mobileOpen ? styles.barOpen : ''}`} />
          <span className={`${styles.bar} ${mobileOpen ? styles.barOpen : ''}`} />
          <span className={`${styles.bar} ${mobileOpen ? styles.barOpen : ''}`} />
        </button>
      </div>
    </header>
  );
}
