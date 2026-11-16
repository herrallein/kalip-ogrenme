import { describe, expect, it } from 'vitest';
import { addDays } from './date';
import { emptyState, gradePattern } from './scheduler';
import { dueCount, levelStats, sentenceBook, studyStreak, weakPatterns, weekSummary } from './stats';
import { mkPatterns, mkProgress, withProgress } from './testutil';
import type { AppState } from './types';

const T = '2026-11-15';

function dayDone(s: AppState, date: string): AppState {
  return { ...s, days: { ...s.days, [date]: { newIds: [], done: ['x'] } } };
}

describe('levelStats', () => {
  it('düzey başına toplam, öğrenen, kalıcı, görülmemiş', () => {
    const pats = [...mkPatterns('A1', 5), ...mkPatterns('B1', 2)];
    const s = withProgress([
      mkProgress('a1-1', { phase: 'review' }),
      mkProgress('a1-2', { phase: 'review' }),
      mkProgress('a1-3', { phase: 'learning' }),
      mkProgress('b1-1', { phase: 'learning' }),
      mkProgress('listede-yok', { phase: 'review' }),
    ]);
    const st = levelStats(s, pats);
    expect(st.A1).toEqual({ total: 5, learning: 1, review: 2, unseen: 2 });
    expect(st.B1).toEqual({ total: 2, learning: 1, review: 0, unseen: 1 });
    expect(st.A2).toEqual({ total: 0, learning: 0, review: 0, unseen: 0 });
    expect(Object.keys(st)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
  });
});

describe('studyStreak', () => {
  it('hiç çalışılmadıysa 0', () => {
    expect(studyStreak(emptyState(), T)).toBe(0);
  });
  it('bugün çalışıldıysa bugünden sayar', () => {
    let s = dayDone(emptyState(), T);
    s = dayDone(s, '2026-11-14');
    s = dayDone(s, '2026-11-13');
    s = dayDone(s, '2026-11-11'); // boşluk
    expect(studyStreak(s, T)).toBe(3);
  });
  it('bugün çalışılmadıysa dünden sayar (seri kopmaz)', () => {
    let s = dayDone(emptyState(), '2026-11-14');
    s = dayDone(s, '2026-11-13');
    expect(studyStreak(s, T)).toBe(2);
  });
  it('dün de yoksa 0; done boş gün sayılmaz', () => {
    let s = dayDone(emptyState(), '2026-11-13');
    s = { ...s, days: { ...s.days, [T]: { newIds: ['a'], done: [] } } };
    expect(studyStreak(s, T)).toBe(0);
  });
  it('ay sınırını geçer', () => {
    let s = dayDone(emptyState(), '2026-11-01');
    s = dayDone(s, '2026-10-31');
    expect(studyStreak(s, '2026-11-01')).toBe(2);
  });
});

describe('dueCount', () => {
  it('kuyruk uzunluğu; state değişmez', () => {
    const pats = mkPatterns('A1', 10);
    const s = withProgress([mkProgress('a1-9', { due: '2026-11-14' })]);
    const before = structuredClone(s);
    expect(dueCount(s, pats, T)).toBe(1 + 3);
    expect(s).toEqual(before);
  });
  it('yapılan işler düşer', () => {
    const pats = mkPatterns('A1', 10);
    const s = gradePattern(emptyState(), 'a1-1', 'good', T);
    // newIds henüz yok: gün kaydı gradePattern ile boş newIds ile oluştu
    expect(dueCount(s, pats, T)).toBe(0);
  });
});

describe('weekSummary', () => {
  it('boş durumda hepsi sıfır', () => {
    const z = { days: 0, graded: 0, introduced: 0, graduated: 0, hard: 0 };
    expect(weekSummary(emptyState(), T)).toEqual({ current: z, previous: z });
  });
  it('pencere sınırları: bugün-6 dahil, bugün-7 geçen haftada, bugün-14 dışarıda', () => {
    const d = (n: number) => addDays(T, n);
    const base: AppState = { ...emptyState(), days: {
      [d(0)]: { newIds: [], done: ['a', 'b'] },
      [d(-6)]: { newIds: [], done: ['a'] },
      [d(-7)]: { newIds: [], done: ['a', 'b', 'c'] },
      [d(-13)]: { newIds: [], done: ['a'] },
      [d(-14)]: { newIds: [], done: ['a'] },
      [d(1)]: { newIds: [], done: ['a'] },
      [d(-2)]: { newIds: [], done: [] },
    } };
    const s = withProgress([
      mkProgress('a', { introduced: d(-6), history: [{ date: d(0), grade: 'hard' }, { date: d(-7), grade: 'hard' }] }),
      mkProgress('b', { introduced: d(-7) }),
      mkProgress('c', { introduced: d(-14) }),
    ], base);
    const w = weekSummary(s, T);
    expect(w.current).toMatchObject({ days: 2, graded: 3, introduced: 1, hard: 1 });
    expect(w.previous).toMatchObject({ days: 2, graded: 4, introduced: 1, hard: 1 });
  });
  it('kalıcıya geçişi geçmişten bulur; unutup yeniden öğrenmeyi ayrı sayar', () => {
    const e = (date: string) => ({ date, grade: 'easy' as const });
    const hist = [
      e('2026-11-01'), e('2026-11-02'), e('2026-11-03'),
      { date: '2026-11-08', grade: 'hard' as const },
      e('2026-11-10'), e('2026-11-11'), e('2026-11-12'),
    ];
    const s = withProgress([mkProgress('a', { history: hist, introduced: '2026-11-01' })]);
    const w = weekSummary(s, T);
    expect(w.current.graduated).toBe(1);   // 11-12 (11-09..11-15)
    expect(w.previous.graduated).toBe(1);  // 11-03 (11-02..11-08)
    expect(w.previous.hard).toBe(1);
    expect(w.current.hard).toBe(0);
  });
});

describe('weakPatterns', () => {
  const pats = mkPatterns('A1', 4);
  it('boş durumda boş', () => {
    expect(weakPatterns(emptyState(), pats, T, 8)).toEqual([]);
  });
  it('puan = unutma*2 + son 14 gün Zor + takılma; 0 puan listelenmez', () => {
    const s = withProgress([
      mkProgress('a1-1', { lapses: 1, history: [{ date: addDays(T, -13), grade: 'hard' }, { date: addDays(T, -14), grade: 'hard' }] }),
      mkProgress('a1-2', { seen: 5 }),
      mkProgress('a1-3', { seen: 5, phase: 'review' }),
      mkProgress('a1-4', {}),
    ]);
    const r = weakPatterns(s, pats, T, 8);
    expect(r.map((x) => [x.pattern.id, x.score])).toEqual([['a1-1', 3], ['a1-2', 1]]);
    expect(r[0]).toMatchObject({ hard: 1, lapses: 1, stuck: false });
    expect(r[1].stuck).toBe(true);
  });
  it('eşitlikte unutması çok olan, sonra liste sırası; n sınırlar', () => {
    const s = withProgress([
      mkProgress('a1-1', { history: [{ date: T, grade: 'hard' }, { date: T, grade: 'hard' }] }),
      mkProgress('a1-2', { lapses: 1 }),
      mkProgress('a1-3', { lapses: 1 }),
    ]);
    expect(weakPatterns(s, pats, T, 8).map((x) => x.pattern.id)).toEqual(['a1-2', 'a1-3', 'a1-1']);
    expect(weakPatterns(s, pats, T, 2)).toHaveLength(2);
    expect(weakPatterns(s, pats, T, 0)).toEqual([]);
  });
});

describe('sentenceBook', () => {
  const pats = mkPatterns('A1', 3);
  it('boş durumda toplam 0', () => {
    expect(sentenceBook(emptyState(), pats)).toEqual({ total: 0, groups: [] });
  });
  it('kalıba göre gruplar, yeniden eskiye; aynı günde sonradan yazılan önce', () => {
    const s = withProgress([
      mkProgress('a1-1', { sentences: [{ date: '2026-11-01', text: 'x' }, { date: '2026-11-03', text: 'y1' }, { date: '2026-11-03', text: 'y2' }] }),
      mkProgress('a1-2', { sentences: [{ date: '2026-11-05', text: 'z' }] }),
      mkProgress('a1-3', {}),
    ]);
    const b = sentenceBook(s, pats);
    expect(b.total).toBe(4);
    expect(b.groups.map((g) => g.pattern.id)).toEqual(['a1-2', 'a1-1']);
    expect(b.groups[1].sentences.map((x) => x.text)).toEqual(['y2', 'y1', 'x']);
  });
  it('listede olmayan kalıbın cümleleri atlanır', () => {
    const s = withProgress([mkProgress('yok', { sentences: [{ date: T, text: 'a' }] })]);
    expect(sentenceBook(s, pats).total).toBe(0);
  });
});
