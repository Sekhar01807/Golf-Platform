import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  let totalImpact = '₹8,41,000';
  let activeMembersCount = '100+';
  let verifiedDrawsCount = '100%';
  let winnersRewardedCount = '12+';
  let isLiveMetrics = false;

  try {
    const supabase = await createClient();
    const [charitiesRes, usersRes, winnersRes] = await Promise.all([
      supabase.from('charities').select('total_contributions'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
      supabase.from('draw_winners').select('id', { count: 'exact', head: true }),
    ]);

    if (charitiesRes.data && charitiesRes.data.length > 0) {
      const sum = charitiesRes.data.reduce((acc, c) => acc + (Number(c.total_contributions) || 0), 0);
      if (sum > 0) {
        totalImpact = `₹${sum.toLocaleString('en-IN')}`;
        isLiveMetrics = true;
      }
    }

    if (usersRes.count !== null && usersRes.count > 0) {
      activeMembersCount = `${usersRes.count}`;
      isLiveMetrics = true;
    }

    if (winnersRes.count !== null && winnersRes.count > 0) {
      winnersRewardedCount = `${winnersRes.count}`;
      isLiveMetrics = true;
    }
  } catch {
    // Gracefully fallback to default benchmark metrics
  }

  const steps = [
    {
      num: '01',
      title: 'Subscribe',
      desc: 'Join with a transparent monthly or discounted yearly plan to activate your membership.',
    },
    {
      num: '02',
      title: 'Play Golf',
      desc: 'Play your regular rounds at any standard golf course using the Stableford scoring format.',
    },
    {
      num: '03',
      title: 'Enter Score',
      desc: 'Log your 5 most recent Stableford scores (1–45) into your verified dashboard.',
    },
    {
      num: '04',
      title: 'Support & Win',
      desc: 'Direct a percentage of fees to your chosen charity and enter monthly jackpot prize draws.',
    },
  ];

  const featuredCharities = [
    {
      id: 'green-earth',
      name: 'Green Earth Initiative',
      desc: 'Protecting natural habitats through sustainable golf course management, conservation, and rewilding.',
      img: '/green-earth-initiative.png',
      contributed: '₹2,38,000',
    },
    {
      id: 'veterans-fairway',
      name: 'Veterans on the Fairway',
      desc: 'Supporting physical recovery and mental health wellbeing for military service veterans through golf therapy.',
      img: '/veterans-fairway.png',
      contributed: '₹1,89,500',
    },
    {
      id: 'youth-golf',
      name: 'Youth Golf Foundation',
      desc: 'Providing coaching, equipment, and tournament pathways to underprivileged youth in grassroots communities.',
      img: '/youth-golf-foundation.png',
      contributed: '₹1,42,500',
    },
  ];

  return (
    <>
      {/* ── Hero Section ── */}
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroContent}>
            <div className={styles.heroTag}>
              ⛳ Purpose-Driven Golf Platform
            </div>
            <h1 className={styles.heroTitle}>
              Play Golf. <span>Make An Impact.</span>
            </h1>
            <p className={styles.heroDesc}>
              Your golf scores can help support charities doing meaningful work.
              Track your Stableford rounds, fund verified causes, and enter monthly prize draws.
            </p>
            <div className={styles.heroCTA}>
              <Link href="/auth/signup" className="btn btn-primary btn-lg">
                Get Started
              </Link>
              <Link href="/how-it-works" className="btn btn-secondary btn-lg">
                See How It Works
              </Link>
            </div>
          </div>

          {/* Hero Featured Photography */}
          <div className={styles.heroImageFrame}>
            <Image
              src="/golf-for-good.png"
              alt="Golf course fairway and community impact"
              fill
              priority
              sizes="(max-width: 1200px) 100vw, 1060px"
              style={{ objectFit: 'cover' }}
            />
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className={`section ${styles.howSection}`}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionPretitle}>Simple & Transparent</div>
            <h2 className={styles.sectionTitle}>How GolfForGood Works</h2>
            <p className={styles.sectionSubtitle}>
              Four seamless steps that turn your regular weekend rounds into genuine philanthropic impact.
            </p>
          </div>

          <div className={styles.stepsGrid}>
            {steps.map((step) => (
              <div key={step.num} className={styles.stepCard}>
                <div className={styles.stepNumber}>{step.num}</div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Charities ── */}
      <section className={`section ${styles.charitiesSection}`}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionPretitle}>Verified Non-Profits</div>
            <h2 className={styles.sectionTitle}>Partner Charities</h2>
            <p className={styles.sectionSubtitle}>
              Every subscription directly contributes to certified initiatives creating lasting community change.
            </p>
          </div>

          <div className={styles.charityGrid}>
            {featuredCharities.map((charity) => (
              <div key={charity.id} className={styles.charityCard}>
                <div className={styles.charityImageFrame}>
                  <Image
                    src={charity.img}
                    alt={charity.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div className={styles.charityBody}>
                  <h3 className={styles.charityName}>{charity.name}</h3>
                  <p className={styles.charityDesc}>{charity.desc}</p>
                  <div className={styles.charityFooter}>
                    <span className={styles.charityRaised}>{charity.contributed} contributed</span>
                    <Link href="/charities" className={styles.charityLink}>
                      View charity →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>
            <Link href="/charities" className="btn btn-secondary">
              Explore All 6 Partner Charities →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Platform Stats ── */}
      <section className={styles.statsSection}>
        <div className="container">
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{totalImpact}</div>
              <div className={styles.statLabel}>Charity Contributions</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{activeMembersCount}</div>
              <div className={styles.statLabel}>Active Members</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{verifiedDrawsCount}</div>
              <div className={styles.statLabel}>Cryptographic Verification</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{winnersRewardedCount}</div>
              <div className={styles.statLabel}>Winners Recorded</div>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
            {isLiveMetrics ? '● Live platform verified metrics' : '✦ Demo benchmark metrics for demonstration'}
          </p>
        </div>
      </section>

      {/* ── Call To Action ── */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaBox}>
            <h2 className={styles.ctaTitle}>Ready to Play with Purpose?</h2>
            <p className={styles.ctaDesc}>
              Join golfers across the country who are elevating their game and funding critical causes.
            </p>
            <Link href="/auth/signup" className="btn btn-primary btn-lg">
              Join GolfForGood Today
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
