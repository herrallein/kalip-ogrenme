import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, emptyState, exampleFor, gradePattern, movePattern, orderedPatterns, planDay,
} from './scheduler';
import { mkPatterns, mkProgress, withProgress } from './testutil';
import type { AppState, Pattern } from './types';

const A1 = mkPatterns('A1', 20);
const T = '2026-11-15';

describe('orderedPatterns', () => {
  const pats: Pattern[] = [
    ...mkPatterns('B1', 2), ...mkPatterns('A2', 2), ...mkPatterns('A1', 3),
  ];
  it('order boşsa düzey ve priority sırası', () => {
    expect(orderedPatterns(pats, []).map((p) => p.id))
      .toEqual(['a1-1', 'a1-2', 'a1-3', 'a2-1', 'a2-2', 'b1-1', 'b1-2']);
  });
  it('kullanıcı sırası önce, kalanlar varsayılan sırada; geçersiz ve tekrar eden id yok sayılır', () => {
    expect(orderedPatterns(pats, ['b1-2', 'yok', 'a2-1', 'b1-2']).map((p) => p.id))
      .toEqual(['b1-2', 'a2-1', 'a1-1', 'a1-2', 'a1-3', 'a2-2', 'b1-1']);
  });
  it('girdi dizisini değiştirmez', () => {
    const copy = structuredClone(pats);
    orderedPatterns(pats, ['b1-2']);
    expect(pats).toEqual(copy);
  });
});

describe('planDay: yeni kalıplar', () => {
  it('boş durumda newPerDay kadar yeni kalıp, sırayla', () => {
    const { state, queue } = planDay(emptyState(), A1, T);
    expect(state.days[T].newIds).toEqual(['a1-1', 'a1-2', 'a1-3']);
    expect(queue).toEqual([
      { id: 'a1-1', kind: 'new' }, { id: 'a1-2', kind: 'new' }, { id: 'a1-3', kind: 'new' },
    ]);
  });
  it('kullanıcı sırası yeni kalıp seçimini etkiler', () => {
    const s = { ...emptyState(), order: ['a1-10'] };
    expect(planDay(s, A1, T).state.days[T].newIds).toEqual(['a1-10', 'a1-1', 'a1-2']);
  });
  it('öğrenmedeki sayıya göre azalır: 7 öğrenmede 2 yeni', () => {
    const s = withProgress(A1.slice(0, 7).map((p) => mkProgress(p.id)));
    expect(planDay(s, A1, T).state.days[T].newIds).toEqual(['a1-8', 'a1-9']);
  });
  it('8 öğrenmede 1, 9 ve fazlasında 0 yeni', () => {
    const s8 = withProgress(A1.slice(0, 8).map((p) => mkProgress(p.id)));
    expect(planDay(s8, A1, T).state.days[T].newIds).toEqual(['a1-9']);
    const s9 = withProgress(A1.slice(0, 9).map((p) => mkProgress(p.id)));
    expect(planDay(s9, A1, T).state.days[T].newIds).toEqual([]);
    const s11 = withProgress(A1.slice(0, 11).map((p) => mkProgress(p.id)));
    expect(planDay(s11, A1, T).state.days[T].newIds).toEqual([]);
  });
  it('kalıcılıktakiler öğrenme sayısına dahil değil', () => {
    const s = withProgress(A1.slice(0, 9).map((p) => mkProgress(p.id, { phase: 'review' })));
    expect(planDay(s, A1, T).state.days[T].newIds).toEqual(['a1-10', 'a1-11', 'a1-12']);
  });
  it('görülmemiş kalıp kalmadıysa yeni verilmez', () => {
    const s = withProgress(A1.slice(0, 19).map((p) => mkProgress(p.id, { phase: 'review' })));
    expect(planDay(s, A1, T).state.days[T].newIds).toEqual(['a1-20']);
  });
  it('gün içinde tekrar çağrılınca newIds değişmez', () => {
    const first = planDay(emptyState(), A1, T).state;
    let s = gradePattern(first, 'a1-1', 'hard', T);
    // öğrenmedeki sayı değişti ama gün kaydı sabit kalır
    const again = planDay(s, A1, T);
    expect(again.state.days[T].newIds).toEqual(['a1-1', 'a1-2', 'a1-3']);
    expect(again.queue.map((q) => q.id)).toEqual(['a1-2', 'a1-3']);
    s = gradePattern(s, 'a1-2', 'good', T);
    expect(planDay(s, A1, T).state.days[T].newIds).toEqual(['a1-1', 'a1-2', 'a1-3']);
  });
  it('günlerce açılmazsa birikmiş yeni kalıp verilmez', () => {
    let s = planDay(emptyState(), A1, '2026-11-01').state;
    for (const id of s.days['2026-11-01'].newIds) s = gradePattern(s, id, 'good', '2026-11-01');
    const r = planDay(s, A1, '2026-11-10');
    expect(r.state.days['2026-11-10'].newIds).toEqual(['a1-4', 'a1-5', 'a1-6']);
    expect(r.state.days['2026-11-05']).toBeUndefined();
    const kinds = r.queue.map((q) => q.kind);
    expect(kinds).toEqual(['learning', 'learning', 'learning', 'new', 'new', 'new']);
  });
});

describe('planDay: kuyruk', () => {
  it('sıra: öğrenme (eski due önce), kalıcılık, yeni', () => {
    const s = withProgress([
      mkProgress('a1-10', { phase: 'review', due: '2026-11-10' }),
      mkProgress('a1-11', { phase: 'learning', due: '2026-11-14' }),
      mkProgress('a1-12', { phase: 'learning', due: '2026-11-12' }),
      mkProgress('a1-13', { phase: 'review', due: '2026-11-15' }),
      mkProgress('a1-14', { phase: 'learning', due: '2026-11-16' }), // vadesi gelmedi
      mkProgress('a1-15', { phase: 'review', due: '2026-11-16' }),   // vadesi gelmedi
    ]);
    const { queue } = planDay(s, A1, T);
    expect(queue).toEqual([
      { id: 'a1-12', kind: 'learning' },
      { id: 'a1-11', kind: 'learning' },
      { id: 'a1-10', kind: 'review' },
      { id: 'a1-13', kind: 'review' },
      { id: 'a1-1', kind: 'new' },
      { id: 'a1-2', kind: 'new' },
      { id: 'a1-3', kind: 'new' },
    ]);
  });
  it('bugün yapılanlar ve listede olmayan id çıkarılır', () => {
    let s = withProgress([
      mkProgress('a1-10', { phase: 'learning', due: '2026-11-14' }),
      mkProgress('silinmis', { phase: 'learning', due: '2026-11-14' }),
    ]);
    s = gradePattern(planDay(s, A1, T).state, 'a1-10', 'good', T);
    const { queue } = planDay(s, A1, T);
    expect(queue.map((q) => q.id)).not.toContain('a1-10');
    expect(queue.map((q) => q.id)).not.toContain('silinmis');
  });
  it('vadesi geçmiş kalıplar kuyrukta kalır', () => {
    const s = withProgress([mkProgress('a1-10', { phase: 'review', due: '2026-10-01' })]);
    expect(planDay(s, A1, T).queue[0]).toEqual({ id: 'a1-10', kind: 'review' });
  });
  it('girdi state değişmez (deep equal)', () => {
    const s = withProgress([mkProgress('a1-10', { due: '2026-11-14' })]);
    const before = structuredClone(s);
    planDay(s, A1, T);
    expect(s).toEqual(before);
  });
});

describe('gradePattern: öğrenme evresi', () => {
  it('ilk not: progress oluşur, hard/good ile due yarın', () => {
    const s = gradePattern(emptyState(), 'a1-1', 'good', T, '  Ich bin hier.  ');
    const p = s.progress['a1-1'];
    expect(p).toMatchObject({
      phase: 'learning', introduced: T, easyStreak: 0, seen: 1, lapses: 0,
      lastSeen: T, due: '2026-11-16',
    });
    expect(p.history).toEqual([{ date: T, grade: 'good' }]);
    expect(p.sentences).toEqual([{ date: T, text: 'Ich bin hier.' }]);
    expect(s.days[T].done).toEqual(['a1-1']);
  });
  it('boş cümle kaydedilmez', () => {
    const s = gradePattern(emptyState(), 'a1-1', 'easy', T, '   ');
    expect(s.progress['a1-1'].sentences).toEqual([]);
  });
  it('3 art arda easy ile mezuniyet, due = +3 gün', () => {
    let s = emptyState();
    s = gradePattern(s, 'a1-1', 'easy', '2026-11-01');
    expect(s.progress['a1-1']).toMatchObject({ phase: 'learning', easyStreak: 1, due: '2026-11-02' });
    s = gradePattern(s, 'a1-1', 'easy', '2026-11-02');
    expect(s.progress['a1-1']).toMatchObject({ phase: 'learning', easyStreak: 2, due: '2026-11-03' });
    s = gradePattern(s, 'a1-1', 'easy', '2026-11-03');
    expect(s.progress['a1-1']).toMatchObject({
      phase: 'review', step: 0, due: '2026-11-06', seen: 3,
    });
  });
  it('good seriyi bozmaz, artırmaz', () => {
    let s = gradePattern(emptyState(), 'a1-1', 'easy', '2026-11-01');
    s = gradePattern(s, 'a1-1', 'easy', '2026-11-02');
    s = gradePattern(s, 'a1-1', 'good', '2026-11-03');
    expect(s.progress['a1-1']).toMatchObject({ phase: 'learning', easyStreak: 2, due: '2026-11-04' });
    s = gradePattern(s, 'a1-1', 'easy', '2026-11-04');
    expect(s.progress['a1-1'].phase).toBe('review');
  });
  it('hard seriyi sıfırlar', () => {
    let s = gradePattern(emptyState(), 'a1-1', 'easy', '2026-11-01');
    s = gradePattern(s, 'a1-1', 'easy', '2026-11-02');
    s = gradePattern(s, 'a1-1', 'hard', '2026-11-03');
    expect(s.progress['a1-1']).toMatchObject({ phase: 'learning', easyStreak: 0, due: '2026-11-04' });
    expect(s.progress['a1-1'].lapses).toBe(0); // öğrenmede hard lapse sayılmaz
  });
  it('easyStreakToGraduate ayarı uygulanır', () => {
    const base: AppState = { ...emptyState(), settings: { ...DEFAULT_SETTINGS, easyStreakToGraduate: 1 } };
    const s = gradePattern(base, 'a1-1', 'easy', T);
    expect(s.progress['a1-1']).toMatchObject({ phase: 'review', due: '2026-11-18' });
  });
});

describe('gradePattern: kalıcılık evresi', () => {
  const rev = (over = {}) =>
    withProgress([mkProgress('a1-1', { phase: 'review', step: 1, seen: 5, due: T, ...over })]);

  it('hard öğrenmeye döndürür, lapses +1, due yarın', () => {
    const s = gradePattern(rev({ easyStreak: 2 }), 'a1-1', 'hard', T);
    expect(s.progress['a1-1']).toMatchObject({
      phase: 'learning', easyStreak: 0, lapses: 1, due: '2026-11-16', seen: 6,
    });
  });
  it('good adımı korur, due = bugün + aralık[step]', () => {
    const s = gradePattern(rev(), 'a1-1', 'good', T);
    expect(s.progress['a1-1']).toMatchObject({ phase: 'review', step: 1, due: '2026-11-22' });
  });
  it('easy adımı ilerletir', () => {
    const s = gradePattern(rev(), 'a1-1', 'easy', T);
    expect(s.progress['a1-1']).toMatchObject({ phase: 'review', step: 2, due: '2026-12-06' });
  });
  it('easy son aralıkta kalır', () => {
    const s = gradePattern(rev({ step: 4 }), 'a1-1', 'easy', T);
    expect(s.progress['a1-1']).toMatchObject({ step: 4, due: '2027-03-15' });
  });
  it('geri dönen kalıp tekrar mezun olunca step 0', () => {
    let s = gradePattern(rev({ step: 3 }), 'a1-1', 'hard', '2026-11-15');
    s = gradePattern(s, 'a1-1', 'easy', '2026-11-16');
    s = gradePattern(s, 'a1-1', 'easy', '2026-11-17');
    s = gradePattern(s, 'a1-1', 'easy', '2026-11-18');
    expect(s.progress['a1-1']).toMatchObject({ phase: 'review', step: 0, due: '2026-11-21', lapses: 1 });
  });
});

describe('gradePattern: genel', () => {
  it('aynı gün ikinci not yok sayılır', () => {
    const once = gradePattern(emptyState(), 'a1-1', 'easy', T, 'bir');
    const twice = gradePattern(once, 'a1-1', 'hard', T, 'iki');
    expect(twice).toEqual(once);
    expect(twice.progress['a1-1'].seen).toBe(1);
    expect(twice.days[T].done).toEqual(['a1-1']);
  });
  it('ertesi gün yeni not geçerli', () => {
    let s = gradePattern(emptyState(), 'a1-1', 'good', T);
    s = gradePattern(s, 'a1-1', 'good', '2026-11-16');
    expect(s.progress['a1-1'].seen).toBe(2);
  });
  it('girdi state değişmez (deep equal)', () => {
    const s = planDay(emptyState(), A1, T).state;
    const before = structuredClone(s);
    const out = gradePattern(s, 'a1-1', 'easy', T, 'cümle');
    expect(s).toEqual(before);
    expect(out).not.toBe(s);
  });
  it('gün kaydı yoksa oluşturulur', () => {
    const s = gradePattern(emptyState(), 'a1-1', 'good', T);
    expect(s.days[T]).toEqual({ newIds: [], done: ['a1-1'] });
  });
});

describe('exampleFor', () => {
  const p = A1[0];
  it('progress yoksa ilk örnek', () => {
    expect(exampleFor(p, undefined)).toBe(p.examples[0]);
  });
  it('seen ile dönüşümlü ilerler', () => {
    expect(exampleFor(p, mkProgress(p.id, { seen: 1 }))).toBe(p.examples[1]);
    expect(exampleFor(p, mkProgress(p.id, { seen: 3 }))).toBe(p.examples[3]);
    expect(exampleFor(p, mkProgress(p.id, { seen: 4 }))).toBe(p.examples[0]);
    expect(exampleFor(p, mkProgress(p.id, { seen: 9 }))).toBe(p.examples[1]);
  });
});

describe('movePattern', () => {
  const pats = mkPatterns('A1', 4);
  it('bir aşağı taşır ve tam liste döner', () => {
    expect(movePattern([], pats, 'a1-1', 1)).toEqual(['a1-2', 'a1-1', 'a1-3', 'a1-4']);
  });
  it('bir yukarı taşır', () => {
    expect(movePattern([], pats, 'a1-3', -1)).toEqual(['a1-1', 'a1-3', 'a1-2', 'a1-4']);
  });
  it('başta yukarı, sonda aşağı: sıra aynı kalır', () => {
    expect(movePattern([], pats, 'a1-1', -1)).toEqual(['a1-1', 'a1-2', 'a1-3', 'a1-4']);
    expect(movePattern([], pats, 'a1-4', 1)).toEqual(['a1-1', 'a1-2', 'a1-3', 'a1-4']);
  });
  it('bilinmeyen id: sıra aynı; mevcut order kullanılır; girdi değişmez', () => {
    const order = ['a1-4', 'a1-3'];
    expect(movePattern(order, pats, 'yok', 1)).toEqual(['a1-4', 'a1-3', 'a1-1', 'a1-2']);
    expect(movePattern(order, pats, 'a1-1', -1)).toEqual(['a1-4', 'a1-1', 'a1-3', 'a1-2']);
    expect(order).toEqual(['a1-4', 'a1-3']);
  });
});

describe('emptyState', () => {
  it('her çağrıda bağımsız nesne verir', () => {
    const a = emptyState();
    a.settings.reviewIntervals.push(999);
    expect(emptyState().settings.reviewIntervals).toEqual([3, 7, 21, 60, 120]);
    expect(DEFAULT_SETTINGS.reviewIntervals).toEqual([3, 7, 21, 60, 120]);
  });
});
