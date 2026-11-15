import { addDays } from './date';
import { planDay } from './scheduler';
import type { AppState, Level, Pattern } from './types';

export interface LevelStat { total: number; learning: number; review: number; unseen: number }

export function levelStats(state: AppState, patterns: Pattern[]): Record<Level, LevelStat> {
  const out = {} as Record<Level, LevelStat>;
  for (const l of ['A1', 'A2', 'B1', 'B2', 'C1'] as Level[]) {
    out[l] = { total: 0, learning: 0, review: 0, unseen: 0 };
  }
  for (const p of patterns) {
    const s = out[p.level];
    s.total += 1;
    const pr = state.progress[p.id];
    if (!pr) s.unseen += 1;
    else if (pr.phase === 'learning') s.learning += 1;
    else s.review += 1;
  }
  return out;
}

// Bugün çalışıldıysa bugünden, değilse dünden geriye ardışık çalışılan gün sayısı.
export function studyStreak(state: AppState, today: string): number {
  const worked = (d: string) => (state.days[d]?.done.length ?? 0) > 0;
  let d = worked(today) ? today : addDays(today, -1);
  let n = 0;
  while (worked(d)) { n += 1; d = addDays(d, -1); }
  return n;
}

export function dueCount(state: AppState, patterns: Pattern[], today: string): number {
  return planDay(state, patterns, today).queue.length;
}
