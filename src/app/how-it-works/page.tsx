import Link from 'next/link';
import styles from './page.module.css';

export const metadata = {
  title: 'How It Works — GolfForGood',
  description: 'Understand how GolfForGood combines golf score tracking, verified charitable giving, and monthly prize draws.',
};

export default function HowItWorksPage() {
  const steps = [
    {
      icon: '🎯',
      title: '1. Select Your Plan',
      desc: 'Choose a flexible monthly membership (₹499/mo) or save 17% with an annual pass (₹4,999/yr). A fixed percentage immediately funds your chosen charity.',
    },
    {
      icon: '⛳',
      title: '2. Log Stableford Scores',
      desc: 'Enter up to 5 of your latest Stableford golf scores (1–45) with dates played. When you log new rounds, our system automatically keeps the 5 newest scores via FIFO.',
    },
    {
      icon: '💚',
      title: '3. Direct Charity Impact',
      desc: 'Select from 6 verified partner non-profits. Set your contribution percentage (10% to 50%) to direct funds directly to youth golf, veteran therapy, or conservation.',
    },
    {
      icon: '🎰',
      title: '4. Monthly Prize Draws',
      desc: 'Every month, 5 winning numbers are drawn. Match 5, 4, or 3 of your active score numbers to claim your share of the monthly prize pool.',
    },
    {
      icon: '🏆',
      title: '5. Verification & Payout',
      desc: 'Prize winners upload a photo/screenshot proof of their round. Our administrators verify the scorecard and process the payout directly.',
    },
    {
      icon: '📈',
      title: '6. Track Everything',
      desc: 'Your private dashboard provides full visibility over your score history, lifetime charitable donations, draw entries, and prize payouts.',
    },
  ];

  const prizeBreakdown = [
    { match: '5-Number Match (Jackpot)', pool: '40% of Prize Pool', rollover: 'Yes (Rollover if no winners)' },
    { match: '4-Number Match', pool: '35% of Prize Pool', rollover: 'Split equally among tier winners' },
    { match: '3-Number Match', pool: '25% of Prize Pool', rollover: 'Split equally among tier winners' },
  ];

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.badge}>Fair & Transparent Rules</div>
          <h1 className={styles.title}>
            How <span className={styles.highlight}>GolfForGood</span> Works
          </h1>
          <p className={styles.subtitle}>
            A skill-based golf subscription platform that connects personal athletic progress with real charitable impact.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="section">
        <div className="container">
          <div className={styles.stepsGrid}>
            {steps.map((step, i) => (
              <div key={i} className={styles.stepCard}>
                <div className={styles.stepIcon}>{step.icon}</div>
                <div className={styles.stepNum}>Step 0{i + 1}</div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prize Pool Distribution */}
      <section className={`section ${styles.tableSection}`}>
        <div className="container">
          <h2 className={styles.sectionTitle}>Prize Pool Allocation Formula</h2>
          <p className={styles.sectionSub}>
            Pools are funded from monthly subscriber dues. Tier prizes are divided equally among all eligible winners.
          </p>
          <div className="table-wrapper" style={{ maxWidth: 780, margin: '0 auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tier & Match Type</th>
                  <th>Pool Share</th>
                  <th>Distribution Rule</th>
                </tr>
              </thead>
              <tbody>
                {prizeBreakdown.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.match}</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{row.pool}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{row.rollover}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ textAlign: 'center' }}>
        <div className="container">
          <h2 className={styles.sectionTitle}>Ready to Join?</h2>
          <p className={styles.sectionSub}>
            Start your membership today and your scores will be eligible for the next monthly draw.
          </p>
          <Link href="/auth/signup" className="btn btn-primary btn-lg">
            Create Free Account
          </Link>
        </div>
      </section>
    </div>
  );
}
