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
  } else {
    // Eşitleme sonrası: başka cihazda daha önceki bir günde tanıtılmış kalıpları bugünün
    // yeni listesinden çıkar ve eksiği tamamla. Hiçbiri çıkmadıysa kayıt aynen kalır.
    const rec = next.days[today];
    const doneNow = new Set(rec.done);
    const kept = rec.newIds.filter((id) => {
      const pr = next.progress[id];
      return !(pr && pr.introduced < today && !doneNow.has(id));
    });
    if (kept.length !== rec.newIds.length) {
      const L = Object.values(next.progress)
        .filter((pr) => pr.phase === 'learning' && known.has(pr.id) && pr.introduced < today).length;
      const n = Math.max(0, Math.min(next.settings.newPerDay, next.settings.learningCap - L));
      const have = new Set(kept);
      for (const p of ordered) {
        if (kept.length >= n) break;
        if (!next.progress[p.id] && !have.has(p.id)) { kept.push(p.id); have.add(p.id); }
      }
      rec.newIds = kept;
    }
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

// Tek kalıbın tek derecelendirme geçişi (saf). gradePattern ve birleştirme yeniden oynatması aynı kuralı kullanır.
export function applyGrade(
  pr: Progress, grade: Grade, date: string, settings: Settings, sentence?: string,
): Progress {
  const next = structuredClone(pr);
  const { easyStreakToGraduate, reviewIntervals } = settings;
  const last = reviewIntervals.length - 1;

  next.history.push({ date, grade });
  next.seen += 1;
  next.lastSeen = date;
  const text = sentence?.trim();
  if (text) next.sentences.push({ date, text });

  if (next.phase === 'learning') {
    if (grade === 'easy') next.easyStreak += 1;
    else if (grade === 'hard') next.easyStreak = 0;
    if (next.easyStreak >= easyStreakToGraduate) {
      next.phase = 'review';
      next.step = 0;
      next.due = addDays(date, reviewIntervals[0]);
    } else {
      next.due = addDays(date, 1);
    }
  } else if (grade === 'hard') {
    next.phase = 'learning';
    next.easyStreak = 0;
    next.lapses += 1;
    next.due = addDays(date, 1);
  } else {
    if (grade === 'easy') next.step = Math.min(next.step + 1, last);
    next.due = addDays(date, reviewIntervals[next.step]);
  }
  return next;
}

export function gradePattern(
  state: AppState, id: string, grade: Grade, today: string, sentence?: string,
): AppState {
  if (state.days[today]?.done.includes(id)) return state;
  const next = structuredClone(state);
  const pr: Progress = next.progress[id] ?? {
    id, phase: 'learning', introduced: today, easyStreak: 0, step: 0,
    due: today, seen: 0, lapses: 0, history: [], sentences: [],
  };
  next.progress[id] = applyGrade(pr, grade, today, next.settings, sentence);
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
