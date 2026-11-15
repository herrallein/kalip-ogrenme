import { addDays } from './date';
import type {
  AppState, Example, Grade, Level, Pattern, Progress, QueueItem, Settings,
} from './types';

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 3,
  learningCap: 9,
  easyStreakToGraduate: 3,
  reviewIntervals: [3, 7, 21, 60, 120],
};

export function emptyState(): AppState {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, reviewIntervals: [...DEFAULT_SETTINGS.reviewIntervals] },
    progress: {},
    days: {},
    order: [],
  };
}

const LEVEL_RANK: Record<Level, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4 };

// Önce kullanıcı sırası (geçerli ve tekil id'ler), sonra kalanlar düzey + priority.
export function orderedPatterns(patterns: Pattern[], order: string[]): Pattern[] {
  const byId = new Map(patterns.map((p) => [p.id, p]));
  const used = new Set<string>();
  const out: Pattern[] = [];
  for (const id of order) {
    const p = byId.get(id);
    if (p && !used.has(id)) { used.add(id); out.push(p); }
  }
  const rest = patterns
    .filter((p) => !used.has(p.id))
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.priority - b.priority);
  return out.concat(rest);
}

export function planDay(
  state: AppState, patterns: Pattern[], today: string,
): { state: AppState; queue: QueueItem[] } {
  const next = structuredClone(state);
  const ordered = orderedPatterns(patterns, next.order);
  const known = new Set(patterns.map((p) => p.id));

  if (!next.days[today]) {
    // Öğrenme evresindeki (listede olan) kalıp sayısı
    const L = Object.values(next.progress)
      .filter((pr) => pr.phase === 'learning' && known.has(pr.id)).length;
    const n = Math.max(0, Math.min(next.settings.newPerDay, next.settings.learningCap - L));
    const newIds = ordered.filter((p) => !next.progress[p.id]).slice(0, n).map((p) => p.id);
    next.days[today] = { newIds, done: [] };
  }
  const day = next.days[today];
  const done = new Set(day.done);

  const rank = new Map(ordered.map((p, i) => [p.id, i]));
  const due = (phase: Progress['phase']) =>
    Object.values(next.progress)
      .filter((pr) => pr.phase === phase && pr.due <= today && known.has(pr.id) && !done.has(pr.id))
      .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : (rank.get(a.id)! - rank.get(b.id)!)));

  const queue: QueueItem[] = [
    ...due('learning').map((pr) => ({ id: pr.id, kind: 'learning' as const })),
    ...due('review').map((pr) => ({ id: pr.id, kind: 'review' as const })),
    ...day.newIds
      .filter((id) => known.has(id) && !done.has(id) && !next.progress[id])
      .map((id) => ({ id, kind: 'new' as const })),
  ];
  return { state: next, queue };
}

export function gradePattern(
  state: AppState, id: string, grade: Grade, today: string, sentence?: string,
): AppState {
  if (state.days[today]?.done.includes(id)) return state;
  const next = structuredClone(state);
  const { easyStreakToGraduate, reviewIntervals } = next.settings;
  const last = reviewIntervals.length - 1;

  const pr: Progress = next.progress[id] ?? {
    id, phase: 'learning', introduced: today, easyStreak: 0, step: 0,
    due: today, seen: 0, lapses: 0, history: [], sentences: [],
  };
  pr.history.push({ date: today, grade });
  pr.seen += 1;
  pr.lastSeen = today;
  const text = sentence?.trim();
  if (text) pr.sentences.push({ date: today, text });

  if (pr.phase === 'learning') {
    if (grade === 'easy') pr.easyStreak += 1;
    else if (grade === 'hard') pr.easyStreak = 0;
    if (pr.easyStreak >= easyStreakToGraduate) {
      pr.phase = 'review';
      pr.step = 0;
      pr.due = addDays(today, reviewIntervals[0]);
    } else {
      pr.due = addDays(today, 1);
    }
  } else if (grade === 'hard') {
    pr.phase = 'learning';
    pr.easyStreak = 0;
    pr.lapses += 1;
    pr.due = addDays(today, 1);
  } else {
    if (grade === 'easy') pr.step = Math.min(pr.step + 1, last);
    pr.due = addDays(today, reviewIntervals[pr.step]);
  }

  next.progress[id] = pr;
  const day = next.days[today] ?? (next.days[today] = { newIds: [], done: [] });
  day.done.push(id);
  return next;
}

export function exampleFor(pattern: Pattern, progress: Progress | undefined): Example {
  return pattern.examples[(progress?.seen ?? 0) % pattern.examples.length];
}

export function movePattern(
  order: string[], patterns: Pattern[], id: string, delta: -1 | 1,
): string[] {
  const full = orderedPatterns(patterns, order).map((p) => p.id);
  const i = full.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= full.length) return full;
  [full[i], full[j]] = [full[j], full[i]];
  return full;
}
