import { useState } from 'react';
import { addDays } from '../core/date';
import { levelStats, sentenceBook, studyStreak, weakPatterns, weekSummary } from '../core/stats';
import type { WeakPattern, WeekStat } from '../core/stats';
import type { AppState, Level, Pattern } from '../core/types';
import { PatternVisual } from './PatternVisual';

interface Props { state: AppState; patterns: Pattern[]; today: string }

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

const WEEK_ROWS: { key: keyof WeekStat; label: string }[] = [
  { key: 'days', label: 'gün çalışıldı' },
  { key: 'graded', label: 'kart' },
  { key: 'introduced', label: 'yeni kalıp' },
  { key: 'graduated', label: 'kalıcıya geçti' },
  { key: 'hard', label: 'Zor' },
];

function reasons(w: WeakPattern): string {
  const parts: string[] = [];
  if (w.hard > 0) parts.push(`${w.hard}× Zor`);
  if (w.lapses > 0) parts.push(`${w.lapses} unutma`);
  if (w.stuck) parts.push('takıldı');
  return parts.join(', ');
}

function WeakRow({ w }: { w: WeakPattern }) {
  const [open, setOpen] = useState(false);
  const p = w.pattern;
  return (
    <li className="prog-weak">
      <button type="button" className="prog-weak-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="prog-weak-text">
          <strong lang="de">{p.pattern}</strong>
          <span className="muted small">{p.meaning}</span>
        </span>
        <span className="badge learning prog-badge">{reasons(w)}</span>
      </button>
      {open && (
        <div className="prog-weak-body">
          <PatternVisual id={p.id} size="tiny" />
          <ul className="examples">
            {p.examples.slice(0, 3).map((e, k) => (
              <li key={k}>
                <span lang="de" className="de">{e.de}</span>
                <span className="tr">{e.tr}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export function ProgressTab({ state, patterns, today }: Props) {
  const stats = levelStats(state, patterns);
  const streak = studyStreak(state, today);
  const totalReview = LEVELS.reduce((n, l) => n + stats[l].review, 0);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const week = weekSummary(state, today);
  const weak = weakPatterns(state, patterns, today, 8);
  const book = sentenceBook(state, patterns);
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase('de');
  const groups = book.groups
    .map((g) => ({
      ...g,
      sentences: q ? g.sentences.filter((x) => x.text.toLocaleLowerCase('de').includes(q)) : g.sentences,
    }))
    .filter((g) => g.sentences.length > 0);
  const shown = groups.reduce((n, g) => n + g.sentences.length, 0);

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

      <h2>Bu hafta</h2>
      <ul className="plain prog-week">
        {WEEK_ROWS.map((r) => (
          <li key={r.key}>
            <span className="prog-week-n">{week.current[r.key]}</span>
            <span className="small">{r.label}</span>
            <span className="muted small">geçen hafta: {week.previous[r.key]}</span>
          </li>
        ))}
      </ul>

      <h2>Zorlandığın kalıplar</h2>
      {weak.length === 0 ? (
        <p className="muted small">Şimdilik zorlandığın kalıp yok. Güzel gidiyor.</p>
      ) : (
        <ul className="plain prog-weak-list">
          {weak.map((w) => <WeakRow key={w.pattern.id} w={w} />)}
        </ul>
      )}

      <h2>Cümle defterim</h2>
      <details className="prog-book">
        <summary>{book.total} cümle</summary>
        {book.total === 0 ? (
          <p className="muted small">
            Cevap ekranında kendi cümleni yazarsan burada birikir. İlk cümleni bir kalıbı çalışırken yaz.
          </p>
        ) : (
          <>
            <input
              type="text"
              className="prog-search"
              placeholder="Cümlelerde ara"
              aria-label="Cümlelerde ara"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {q && <p className="muted small">{shown} / {book.total} cümle</p>}
            {shown === 0 && <p className="muted small">Eşleşen cümle yok.</p>}
            {groups.map((g) => (
              <div key={g.pattern.id} className="prog-group">
                <h3 className="mini" lang="de">{g.pattern.pattern}</h3>
                <ul className="plain">
                  {g.sentences.map((x, k) => (
                    <li key={k} className="prog-sentence">
                      <span lang="de">{x.text}</span>
                      <span className="muted small">{x.date}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </details>
    </section>
  );
}
