import Link from 'next/link';
import Logo from '@/components/Logo/Logo';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerContainer}`}>
        <div className={styles.footerGrid}>
          <div className={styles.brand}>
            <Link href="/" className={styles.logo}>
              <Logo size={36} />
              <span>GolfForGood</span>
            </Link>
            <p className={styles.tagline}>
              Empowering communities and environmental sustainability through golf score tracking, charity contributions, and monthly prize draws.
            </p>
          </div>

          <div className={styles.linkGroup}>
            <h4>Platform</h4>
            <Link href="/how-it-works">How It Works</Link>
            <Link href="/charities">Partner Charities</Link>
            <Link href="/auth/signup">Join Platform</Link>
          </div>

          <div className={styles.linkGroup}>
            <h4>Account</h4>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard/scores">Submit Scores</Link>
            <Link href="/dashboard/charity">My Charity</Link>
            <Link href="/dashboard/draws">Prize Draws</Link>
          </div>

          <div className={styles.linkGroup}>
            <h4>Transparency</h4>
            <Link href="/how-it-works">Prize Breakdown</Link>
            <Link href="/charities">Impact Ledger</Link>
            <Link href="/auth/login">Admin Portal</Link>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p>&copy; {new Date().getFullYear()} GolfForGood Platform. All rights reserved.</p>
          <p className={styles.footerDisclaimer}>
            A simulated golf charity subscription & skill-based prize platform.
          </p>
        </div>
      </div>
    </footer>
  );
}
