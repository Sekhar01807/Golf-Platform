import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Partner Charities — GolfForGood',
  description: 'Explore the verified charities supported through our golf subscription platform.',
};

const defaultCharities = [
  {
    id: 'green-earth',
    name: 'Green Earth Initiative',
    description: 'Protecting natural habitats by promoting sustainable golf course management, conservation, and rewilding.',
    image_url: '/green-earth-initiative.png',
    is_featured: true,
    total_contributions: 238000,
    upcoming_events: 'Eco Golf Fairway Day — October 2026',
  },
  {
    id: 'veterans-fairway',
    name: 'Veterans on the Fairway',
    description: 'Supporting mental health recovery and rehabilitation for military service veterans through structured golf therapy.',
    image_url: '/veterans-fairway.png',
    is_featured: true,
    total_contributions: 189500,
    upcoming_events: 'Veterans Invitational — November 2026',
  },
  {
    id: 'youth-golf',
    name: 'Youth Golf Foundation',
    description: 'Bringing golf to underprivileged communities, providing coaching, equipment, and tournament pathways to young players.',
    image_url: '/youth-golf-foundation.png',
    is_featured: true,
    total_contributions: 142500,
    upcoming_events: 'Junior Open Championship — December 2026',
  },
  {
    id: 'women-in-golf',
    name: 'Women in Golf',
    description: 'Breaking barriers and expanding opportunities for women and girls in competitive and recreational golf.',
    image_url: '/women-in-golf.png',
    is_featured: false,
    total_contributions: 112000,
    upcoming_events: null,
  },
  {
    id: 'golf-for-good',
    name: 'Golf for Good',
    description: 'Funding grassroots golf programs, clinics, and equipment grants across developing communities.',
    image_url: '/golf-for-good.png',
    is_featured: false,
    total_contributions: 95000,
    upcoming_events: null,
  },
  {
    id: 'fairway-to-health',
    name: 'Fairway to Health',
    description: 'Using golf as physical therapy and mobility rehabilitation for people recovering from surgery, injury, or illness.',
    image_url: '/fairway-to-health.png',
    is_featured: false,
    total_contributions: 64000,
    upcoming_events: 'Charity Walk & Play — January 2027',
  },
];

const charityImages: Record<string, string> = {
  'Youth Golf Foundation': '/youth-golf-foundation.png',
  'Green Earth Initiative': '/green-earth-initiative.png',
  'Veterans on the Fairway': '/veterans-fairway.png',
  'Golf for Good': '/golf-for-good.png',
  'Fairway to Health': '/fairway-to-health.png',
  'Women in Golf': '/women-in-golf.png',
};

export default async function CharitiesPage() {
  const supabase = await createClient();

  let charityList = defaultCharities;

  try {
    const { data: charities, error } = await supabase
      .from('charities')
      .select('id, name, description, is_featured, upcoming_events, image_url, total_contributions')
      .order('is_featured', { ascending: false });

    if (!error && charities && charities.length > 0) {
      charityList = charities as any;
    }
  } catch {
    // Graceful fallback to static charity data
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroBadge}>
            <span>Meaningful Impact</span>
          </div>
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
            {charityList.map((charity) => {
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
                      <span className={styles.metricValue}>
                        ₹{Number(charity.total_contributions || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {charity.upcoming_events && (
                      <div className={styles.eventBadge}>
                        {charity.upcoming_events}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
