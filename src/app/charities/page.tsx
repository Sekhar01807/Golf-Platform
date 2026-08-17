import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Partner Charities — GolfCharity',
  description: 'Explore the verified charities supported through our golf subscription platform.',
};

const charityImages: Record<string, string> = {
  'Youth Golf Foundation': '/youth-golf-foundation.png',
  'Green Earth Initiative': '/green-earth-initiative.png',
  'Veterans on the Fairway': '/veterans-fairway.png',
  'Golf for Good': '/golf-for-good.png',
  'Fairway to Health': '/fairway-to-health.png',
  'Women in Golf': '/women-in-golf.png',
};

export default async function CharitiesPage() {
  // Public page uses standard server client, NOT admin service-role client
  const supabase = await createClient();

  const { data: charities } = await supabase
    .from('charities')
    .select('id, name, description, is_featured, upcoming_events, image_url, total_contributions')
    .order('is_featured', { ascending: false });

  const charityList = charities || [];

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroBadge}>🌿 Meaningful Impact</div>
          <h1 className={styles.title}>
            Partner <span className={styles.highlight}>Charities</span>
          </h1>
          <p className={styles.subtitle}>
            Every subscription and score entered directly empowers causes doing vital work on and off the course.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className={styles.grid}>
            {charityList.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '3rem' }}>
                <p style={{ color: 'var(--color-text-muted)' }}>No charities registered yet. Please check back shortly.</p>
              </div>
            ) : (
              charityList.map((charity) => {
                const imgSrc = charity.image_url || charityImages[charity.name] || '/youth-golf-foundation.png';
                return (
                  <div key={charity.id} className={`card ${styles.charityCard}`}>
                    <div className={styles.imageContainer}>
                      <Image
                        src={imgSrc}
                        alt={charity.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        style={{ objectFit: 'cover' }}
                      />
                      {charity.is_featured && (
                        <span className={`badge badge-accent ${styles.featuredBadge}`}>Featured Cause</span>
                      )}
                    </div>
                    <div className={styles.cardContent}>
                      <h3 className={styles.charityName}>{charity.name}</h3>
                      <p className={styles.charityDesc}>{charity.description}</p>
                      
                      <div className={styles.contributedMetric}>
                        <span className={styles.metricLabel}>Community Contributions</span>
                        <span className={styles.metricValue}>₹{Number(charity.total_contributions || 0).toLocaleString('en-IN')}</span>
                      </div>

                      {charity.upcoming_events && (
                        <div className={styles.eventBadge}>
                          <span>📅</span> {charity.upcoming_events}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
