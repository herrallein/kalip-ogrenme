import { useMemo, useState } from 'react';
import { movePattern, orderedPatterns } from '../core/scheduler';
import type { AppState, Level, Pattern } from '../core/types';
import { daysBetween, fmtDay } from './util';

interface Props {
  state: AppState;
  setState: (s: AppState) => void;
  patterns: Pattern[];
  today: string;
}

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

function status(state: AppState, id: string, today: string): { cls: string; text: string } {
  const pr = state.progress[id];
  if (!pr) return { cls: 'new', text: 'yeni' };
  const n = daysBetween(today, pr.due);
  const when = n <= 0 ? 'bugün' : fmtDay(pr.due);
  return pr.phase === 'learning'
    ? { cls: 'learning', text: `öğreniliyor · ${when}` }
    : { cls: 'review', text: `kalıcı · ${when}` };
}

export function PatternsTab({ state, setState, patterns, today }: Props) {
  const [filter, setFilter] = useState<Level | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const ordered = useMemo(() => orderedPatterns(patterns, state.order), [patterns, state.order]);

  if (patterns.length === 0) {
    return (
      <section>
        <h1>Kalıplar</h1>
        <p className="empty">Henüz kalıp yok.</p>
      </section>
    );
  }

  // Aynı düzeydeki komşuyla yer değiştir: movePattern'i komşuyu geçene kadar uygula.
  const move = (id: string, level: Level, delta: -1 | 1) => {
    const full = ordered.map((p) => p.id);
    const group = ordered.filter((p) => p.level === level).map((p) => p.id);
    const gi = group.indexOf(id);
    const neighbor = group[gi + delta];
    if (!neighbor) return;
    const steps = Math.abs(full.indexOf(neighbor) - full.indexOf(id));
    let order = state.order;
    for (let k = 0; k < steps; k++) order = movePattern(order, patterns, id, delta);
    setState({ ...state, order });
  };

  const shown = LEVELS.filter((l) => filter === 'all' || filter === l);

  return (
    <section>
      <h1>Kalıplar</h1>
      <div className="chips" role="group" aria-label="Düzey süzgeci">
        {(['all', ...LEVELS] as const).map((l) => (
          <button
            key={l}
            type="button"
            className={filter === l ? 'chip active' : 'chip'}
            aria-pressed={filter === l}
            onClick={() => setFilter(l)}
          >
            {l === 'all' ? 'Hepsi' : l}
          </button>
        ))}
      </div>

      {shown.map((level) => {
        const list = ordered.filter((p) => p.level === level);
        if (list.length === 0) return null;
        return (
          <div key={level} className="group">
            <h2 className="group-title">{level} <span className="muted small">({list.length})</span></h2>
            <ul className="plain rows">
              {list.map((p, i) => {
                const st = status(state, p.id, today);
                const isOpen = open === p.id;
                const pr = state.progress[p.id];
                return (
                  <li key={p.id} className="row">
                    <div className="row-head">
                      <button
                        type="button"
                        className="row-main"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : p.id)}
                      >
                        <span lang="de" className="row-pattern">{p.pattern}</span>
                        <span className="row-meaning">{p.meaning}</span>
                        <span className={`badge ${st.cls}`}>{st.text}</span>
                      </button>
                      <div className="movers">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`${p.pattern} kalıbını yukarı taşı`}
                          disabled={i === 0}
                          onClick={() => move(p.id, level, -1)}
                        >↑</button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`${p.pattern} kalıbını aşağı taşı`}
                          disabled={i === list.length - 1}
                          onClick={() => move(p.id, level, 1)}
                        >↓</button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="row-body">
                        {p.note && <p className="note">{p.note}</p>}
                        <ul className="examples">
                          {p.examples.map((e, k) => (
                            <li key={k}>
                              <span lang="de" className="de">{e.de}</span>
                              <span className="tr">{e.tr}</span>
                            </li>
                          ))}
                        </ul>
                        <h3 className="mini">Kendi cümlelerin</h3>
                        {pr && pr.sentences.length > 0 ? (
                          <ul className="plain">
                            {pr.sentences.map((s, k) => (
                              <li key={k} className="own">
                                <span lang="de">{s.text}</span>
                                <span className="muted small"> · {fmtDay(s.date)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted small">Henüz yok.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
