import { addDays } from './date';
import { planDay } from './scheduler';
import type { AppState, Level, Pattern, Progress } from './types';

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

export interface WeekStat { days: number; graded: number; introduced: number; graduated: number; hard: number }
export interface WeekSummary { current: WeekStat; previous: WeekStat }

// Geçmişi baştan oynatarak öğrenme -> kalıcı geçiş günlerini bulur
// (geçiş tarihi ayrıca saklanmaz).
function graduationDates(p: Progress, need: number): string[] {
  const out: string[] = [];
  let phase: 'learning' | 'review' = 'learning';
  let streak = 0;
  for (const h of p.history) {
    if (phase === 'learning') {
      if (h.grade === 'easy') streak += 1;
      else if (h.grade === 'hard') streak = 0;
      if (streak >= need) { phase = 'review'; out.push(h.date); }
    } else if (h.grade === 'hard') { phase = 'learning'; streak = 0; }
  }
  return out;
}

// Son 7 gün (bugün dahil) ve ondan önceki 7 gün.
export function weekSummary(state: AppState, today: string): WeekSummary {
  const stat = (from: string, to: string): WeekStat => {
    const inWin = (d: string) => d >= from && d <= to;
    const r: WeekStat = { days: 0, graded: 0, introduced: 0, graduated: 0, hard: 0 };
    for (const [d, rec] of Object.entries(state.days)) {
      if (inWin(d) && rec.done.length > 0) { r.days += 1; r.graded += rec.done.length; }
    }
    for (const p of Object.values(state.progress)) {
      if (inWin(p.introduced)) r.introduced += 1;
      r.hard += p.history.filter((h) => h.grade === 'hard' && inWin(h.date)).length;
      r.graduated += graduationDates(p, state.settings.easyStreakToGraduate).filter(inWin).length;
    }
    return r;
  };
  return {
    current: stat(addDays(today, -6), today),
    previous: stat(addDays(today, -13), addDays(today, -7)),
  };
}

export interface WeakPattern {
  pattern: Pattern; score: number; hard: number; lapses: number; stuck: boolean;
}

// Zayıflık puanı = unutma*2 + son 14 gündeki 'Zor' sayısı + (öğreniyor ve >=5 kez görüldü ? 1 : 0).
// Eşitlikte önce unutması çok olan, sonra listedeki sıra.
export function weakPatterns(
  state: AppState, patterns: Pattern[], today: string, n: number,
): WeakPattern[] {
  const from = addDays(today, -13);
  const out: (WeakPattern & { idx: number })[] = [];
  patterns.forEach((pattern, idx) => {
    const pr = state.progress[pattern.id];
    if (!pr) return;
    const hard = pr.history.filter((h) => h.grade === 'hard' && h.date >= from && h.date <= today).length;
    const stuck = pr.phase === 'learning' && pr.seen >= 5;
    const score = pr.lapses * 2 + hard + (stuck ? 1 : 0);
    if (score > 0) out.push({ pattern, score, hard, lapses: pr.lapses, stuck, idx });
  });
  out.sort((a, b) => b.score - a.score || b.lapses - a.lapses || a.idx - b.idx);
  return out.slice(0, Math.max(0, n)).map(({ idx: _i, ...w }) => w);
}

export interface BookGroup {
  pattern: Pattern;
  sentences: { date: string; text: string }[];   // yeniden eskiye
}
export interface SentenceBook { total: number; groups: BookGroup[] }

// Kullanıcı cümleleri kalıba göre gruplu; gruplar en yeni cümleye göre, cümleler yeniden eskiye.
export function sentenceBook(state: AppState, patterns: Pattern[]): SentenceBook {
  const groups: (BookGroup & { idx: number })[] = [];
  patterns.forEach((pattern, idx) => {
    const list = state.progress[pattern.id]?.sentences ?? [];
    if (list.length === 0) return;
    // Aynı günde sonradan yazılan önce.
    const sentences = list
      .map((s, i) => ({ s, i }))
      .sort((a, b) => (a.s.date < b.s.date ? 1 : a.s.date > b.s.date ? -1 : b.i - a.i))
      .map((x) => x.s);
    groups.push({ pattern, sentences, idx });
  });
  groups.sort((a, b) =>
    a.sentences[0].date < b.sentences[0].date ? 1
      : a.sentences[0].date > b.sentences[0].date ? -1 : a.idx - b.idx);
  return {
    total: groups.reduce((n, g) => n + g.sentences.length, 0),
    groups: groups.map(({ idx: _i, ...g }) => g),
  };
}
