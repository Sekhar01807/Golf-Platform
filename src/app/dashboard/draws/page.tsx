import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DrawsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch published / locked draws
  const { data: draws } = await supabase
    .from('draws')
    .select('id, draw_month, status, winning_numbers, total_prize_pool')
    .order('draw_month', { ascending: false })
    .limit(12);

  let entriesMap: Record<string, number[]> = {};
  let winsMap: Record<string, { matchType: string; prizeAmount: number }> = {};

  if (user && draws && draws.length > 0) {
    const drawIds = draws.map((d) => d.id);

    // Fetch user's entries
    const { data: entries } = await supabase
      .from('draw_entries')
      .select('draw_id, entry_numbers')
      .eq('user_id', user.id)
      .in('draw_id', drawIds);

    entries?.forEach((e) => {
      entriesMap[e.draw_id] = e.entry_numbers || [];
    });

    // Fetch user's winnings
    const { data: wins } = await supabase
      .from('draw_winners')
      .select('draw_id, match_type, prize_amount')
      .eq('user_id', user.id)
      .in('draw_id', drawIds);

    wins?.forEach((w) => {
      winsMap[w.draw_id] = { matchType: w.match_type, prizeAmount: Number(w.prize_amount) };
    });
  }

  const processedDraws = (draws || []).map((draw) => {
    const myNumbers = entriesMap[draw.id] || [];
    const winningNumbers: number[] = draw.winning_numbers || [];
    const matches = myNumbers.filter((n) => winningNumbers.includes(n));
    const month = new Date(draw.draw_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    return {
      id: draw.id,
      month,
      status: draw.status,
      prizePool: Number(draw.total_prize_pool || 0),
      myNumbers,
      winningNumbers: draw.status !== 'simulated' ? winningNumbers : null,
      matches: draw.status !== 'simulated' ? matches.length : null,
      winInfo: winsMap[draw.id] || null,
    };
  });

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          Monthly Prize Draws
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
          Track draw results, inspect winning numbers, and see if your 5 active score numbers hit a winning match tier.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {processedDraws.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--color-text-muted)' }}>No monthly draws published yet. Check back during draw week!</p>
          </div>
        ) : (
          processedDraws.map((draw) => (
            <div key={draw.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{draw.month} Draw</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Total Prize Pool: <strong style={{ color: 'var(--color-primary)' }}>₹{draw.prizePool.toLocaleString('en-IN')}</strong>
                  </p>
                </div>
                <span className={`badge ${draw.status === 'simulated' ? 'badge-pending' : 'badge-active'}`}>
                  {draw.status === 'simulated' ? 'Upcoming' : draw.status === 'locked' ? 'Verified & Locked' : 'Published'}
                </span>
              </div>

              {/* User Entry Numbers */}
              {draw.myNumbers.length > 0 ? (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div className="stat-label" style={{ marginBottom: '0.5rem' }}>Your Score Numbers</div>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {draw.myNumbers.map((num, i) => {
                      const isMatch = draw.winningNumbers?.includes(num);
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            background: isMatch ? 'var(--color-primary)' : '#FFFFFF',
                            color: isMatch ? '#FFFFFF' : 'var(--color-text-primary)',
                            border: `1px solid ${isMatch ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            boxShadow: isMatch ? '0 2px 8px rgba(33,78,52,0.2)' : 'none',
                          }}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  You did not have 5 active scores logged when this draw took place.
                </p>
              )}

              {/* Winning Numbers */}
              {draw.winningNumbers && (
                <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                  <div className="stat-label" style={{ marginBottom: '0.5rem' }}>Winning Drawn Numbers</div>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {draw.winningNumbers.map((num, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: 'var(--color-primary-subtle)',
                          color: 'var(--color-primary)',
                          border: '1px solid rgba(33, 78, 52, 0.25)',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                        }}
                      >
                        {num}
                      </div>
                    ))}

                    {draw.matches !== null && (
                      <div style={{ marginLeft: '0.75rem' }}>
                        {draw.matches >= 3 ? (
                          <span className="badge badge-active" style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}>
                            Won {draw.winInfo?.matchType} — ₹{draw.winInfo?.prizeAmount?.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                            {draw.matches} match{draw.matches !== 1 ? 'es' : ''} (minimum 3 required to win)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
