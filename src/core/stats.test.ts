import { describe, expect, it } from 'vitest';
import { emptyState, gradePattern } from './scheduler';
import { dueCount, levelStats, studyStreak } from './stats';
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
