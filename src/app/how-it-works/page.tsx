import Link from 'next/link';
import styles from './page.module.css';

export const metadata = {
  title: 'How It Works — GolfForGood',
  description: 'Understand how GolfForGood combines golf score tracking, verified charitable giving, and monthly prize draws.',
};

export default function HowItWorksPage() {
  const steps = [
    {
      num: '01',
      title: 'Select Your Plan',
      desc: 'Choose a flexible monthly membership (₹499/mo) or save 17% with an annual pass (₹4,999/yr). A fixed percentage immediately funds your chosen charity.',
    },
    {
      num: '02',
      title: 'Log Stableford Scores',
      desc: 'Enter up to 5 of your latest Stableford golf scores (1–45) with dates played. When you log new rounds, our system automatically keeps the 5 newest scores via FIFO.',
    },
    {
      num: '03',
      title: 'Direct Charity Impact',
      desc: 'Select from 6 verified partner non-profits. Set your contribution percentage (10% to 50%) to direct funds directly to youth golf, veteran therapy, or conservation.',
    },
    {
      num: '04',
      title: 'Monthly Prize Draws',
      desc: 'Every month, 5 winning numbers are drawn. Match 5, 4, or 3 of your active score numbers to claim your share of the monthly prize pool.',
    },
    {
      num: '05',
      title: 'Verification & Payout',
      desc: 'Prize winners upload a photo/screenshot proof of their round. Our administrators verify the scorecard and process the payout directly.',
    },
    {
      num: '06',
      title: 'Track Everything',
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
          <div className={styles.badge}>
            <span>Fair & Transparent Rules</span>
          </div>
          <h1 className={styles.title}>
            How <span className={styles.highlight}>GolfForGood</span> Works
          </h1>
          <p className={styles.subtitle}>
            A skill-based golf subscription platform that connects personal athletic progress with real charitable impact.
          </p>
        </div>
      </section>

      {/* Steps Grid */}
      <section className={styles.stepsSection}>
        <div className="container">
          <h2 className="section-title">Step-by-Step Overview</h2>
          <p className="section-subtitle">
            Everything you need to know about participating, giving, and winning.
          </p>

          <div className={styles.grid}>
            {steps.map((step) => (
              <div key={step.title} className={styles.card}>
                <div className={styles.icon} style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {step.num}
                </div>
                <h3 className={styles.cardTitle}>{step.title}</h3>
                <p className={styles.cardDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prize Breakdown Table */}
      <section className={styles.prizeSection}>
        <div className="container">
          <h2 className="section-title">Prize Pool Distribution</h2>
          <p className="section-subtitle">
            Transparent breakdown of monthly prize allocation across winning tiers.
          </p>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Winning Match Tier</th>
                  <th>Share of Prize Pool</th>
                  <th>Rollover & Distribution Policy</th>
                </tr>
              </thead>
              <tbody>
                {prizeBreakdown.map((row) => (
                  <tr key={row.match}>
                    <td className={styles.matchCell}>{row.match}</td>
                    <td>{row.pool}</td>
                    <td>{row.rollover}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>Ready to Make Every Swing Count?</h2>
            <p className={styles.ctaSubtitle}>
              Join golfers across the country supporting noble causes while playing for verified monthly cash prizes.
            </p>
            <div className={styles.ctaActions}>
              <Link href="/auth/signup" className="btn btn-accent btn-lg">
                Join GolfForGood Today
              </Link>
              <Link href="/charities" className="btn btn-secondary btn-lg">
                Explore Charity Partners
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
