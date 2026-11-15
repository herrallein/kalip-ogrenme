import { addDays } from '../core/date';
import { levelStats, studyStreak } from '../core/stats';
import type { AppState, Level, Pattern } from '../core/types';

interface Props { state: AppState; patterns: Pattern[]; today: string }

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export function ProgressTab({ state, patterns, today }: Props) {
  const stats = levelStats(state, patterns);
  const streak = studyStreak(state, today);
  const totalReview = LEVELS.reduce((n, l) => n + stats[l].review, 0);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));

  return (
    <section>
      <h1>İlerleme</h1>
      <div className="tiles">
        <div className="tile"><span className="big">{streak}</span><span className="muted small">gün seri</span></div>
        <div className="tile"><span className="big">{totalReview}</span><span className="muted small">kalıcı kalıp</span></div>
      </div>

      <h2>Düzeyler</h2>
      {patterns.length === 0 && <p className="empty">Henüz kalıp yok.</p>}
      {LEVELS.map((l) => {
        const s = stats[l];
        if (s.total === 0) return null;
        const pct = (n: number) => `${(n / s.total) * 100}%`;
        return (
          <div key={l} className="level-row">
            <div className="level-head">
              <strong>{l}</strong>
              <span className="muted small">
                {s.review} kalıcı · {s.learning} öğreniliyor · {s.unseen} yeni / {s.total}
              </span>
            </div>
            <div
              className="bar stacked"
              role="img"
              aria-label={`${l}: ${s.review} kalıcı, ${s.learning} öğreniliyor, ${s.unseen} yeni, toplam ${s.total}`}
            >
              <span className="seg review" style={{ width: pct(s.review) }} />
              <span className="seg learning" style={{ width: pct(s.learning) }} />
            </div>
          </div>
        );
      })}

      <h2>Son 14 gün</h2>
      <ol className="plain cal">
        {days.map((d) => {
          const n = state.days[d]?.done.length ?? 0;
          return (
            <li
              key={d}
              className={n > 0 ? 'cal-day on' : 'cal-day'}
              aria-label={`${d}: ${n} kalıp`}
            >
              <span className="small muted">{d.slice(8)}</span>
              <span className="cal-n">{n > 0 ? n : '·'}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
