import { createClient } from '@/lib/supabase/server';
import CharitiesClient from './CharitiesClient';
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
          <CharitiesClient charities={charityList} />
        </div>
      </section>
    </main>
  );
}
