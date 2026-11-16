import { describe, expect, it } from 'vitest';
import { mergeStates, stampChanges, withNewEpoch } from './merge';
import { emptyState, gradePattern } from './scheduler';
import type { AppState } from './types';

const D1 = '2026-11-01';
const D2 = '2026-11-02';
const D3 = '2026-11-03';
const meta = (o: Partial<NonNullable<AppState['meta']>> = {}) =>
  ({ epoch: '', resetAt: '', settingsAt: '', orderAt: '', ...o });

describe('mergeStates', () => {
  it('idempotent: merge(a, a) = a', () => {
    let a = gradePattern(emptyState(), 'p1', 'easy', D1, 'Hallo');
    a = gradePattern(a, 'p1', 'good', D2);
    expect(mergeStates(a, a)).toEqual(a);
    const b = { ...a, meta: meta({ epoch: 'x', resetAt: '2026-01-01T00:00:00Z' }) };
    expect(mergeStates(b, b)).toEqual(b);
  });

  it('telefon 2 gün + PC 3. gün = üç derecelendirmeyi sırayla uygulamakla aynı', () => {
    const base = gradePattern(emptyState(), 'p1', 'easy', D1);
    const phone = gradePattern(base, 'p1', 'easy', D2);
    const pc = gradePattern(base, 'p1', 'easy', D3);
    const merged = mergeStates(pc, phone);
    expect(merged.progress.p1.history).toHaveLength(3);
    let seq = gradePattern(emptyState(), 'p1', 'easy', D1);
    seq = gradePattern(seq, 'p1', 'easy', D2);
    seq = gradePattern(seq, 'p1', 'easy', D3);
    expect(merged.progress.p1).toEqual(seq.progress.p1);
    expect(merged.progress.p1.phase).toBe('review');
    // iki yönde de aynı sonuç
    expect(mergeStates(phone, pc).progress.p1).toEqual(seq.progress.p1);
  });

  it('geçmiş bir tarafınkinin üst kümesiyse o tarafın Progress değeri aynen alınır', () => {
    const base = gradePattern(emptyState(), 'p1', 'good', D1);
    const ahead = gradePattern(base, 'p1', 'hard', D2);
    expect(mergeStates(base, ahead).progress.p1).toEqual(ahead.progress.p1);
    expect(mergeStates(ahead, base).progress.p1).toEqual(ahead.progress.p1);
  });

  it('aynı gün çakışması: yerel not kalır', () => {
    const a = gradePattern(emptyState(), 'p1', 'hard', D1);
    const b = gradePattern(emptyState(), 'p1', 'easy', D1);
    const m = mergeStates(a, b);
    expect(m.progress.p1.history).toEqual([{ date: D1, grade: 'hard' }]);
    expect(m.progress.p1).toEqual(a.progress.p1);
  });

  it('ayrık kalıplar iki taraftan da korunur; days birleşir', () => {
    const a = gradePattern(emptyState(), 'p1', 'good', D1);
    a.days[D1].newIds = ['p1', 'p2'];
    const b = gradePattern(emptyState(), 'p2', 'easy', D1);
    b.days[D1].newIds = ['p3', 'p2'];
    const m = mergeStates(a, b);
    expect(Object.keys(m.progress).sort()).toEqual(['p1', 'p2']);
    expect(m.days[D1].newIds).toEqual(['p1', 'p2', 'p3']);
    expect([...m.days[D1].done].sort()).toEqual(['p1', 'p2']);
  });

  it('ayar ve sıralama: yeni zaman damgası kazanır', () => {
    const a: AppState = { ...emptyState(), order: ['x'], meta: meta({ settingsAt: '2026-11-01T10:00:00Z', orderAt: '2026-11-01T10:00:00Z' }) };
    a.settings = { ...a.settings, newPerDay: 5 };
    const b: AppState = { ...emptyState(), order: ['y'], meta: meta({ settingsAt: '2026-11-02T10:00:00Z', orderAt: '2026-10-30T10:00:00Z' }) };
    b.settings = { ...b.settings, newPerDay: 7 };
    const m = mergeStates(a, b);
    expect(m.settings.newPerDay).toBe(7);
    expect(m.order).toEqual(['x']);
    expect(m.meta).toEqual(meta({ settingsAt: '2026-11-02T10:00:00Z', orderAt: '2026-11-01T10:00:00Z' }));
    expect(mergeStates(b, a).settings.newPerDay).toBe(7);
  });

  it('farklı epoch: resetAt yeni olan taraf bütünüyle kazanır', () => {
    const old = gradePattern(emptyState(), 'p1', 'easy', D1);
    const fresh = withNewEpoch(emptyState(), new Date('2026-11-05T00:00:00Z'));
    expect(mergeStates(old, fresh)).toEqual(fresh);
    expect(mergeStates(fresh, old)).toEqual(fresh);
    expect(Object.keys(mergeStates(old, fresh).progress)).toEqual([]);
  });

  it('eski (metasız) durumlar birleşir ve meta eklenmez', () => {
    const a = gradePattern(emptyState(), 'p1', 'good', D1);
    const b = gradePattern(emptyState(), 'p1', 'good', D2);
    const m = mergeStates(a, b);
    expect(m.meta).toBeUndefined();
    expect(m.progress.p1.history).toHaveLength(2);
    const withMeta = { ...b, meta: meta({ settingsAt: '2026-11-02T00:00:00Z' }) };
    expect(mergeStates(a, withMeta).meta).toEqual(meta({ settingsAt: '2026-11-02T00:00:00Z' }));
  });

  it('cümleler tekilleştirilir', () => {
    const a = gradePattern(emptyState(), 'p1', 'good', D1, 'Ich bin hier');
    const b = gradePattern(emptyState(), 'p1', 'good', D1, 'Ich bin hier');
    b.progress.p1.sentences.push({ date: D2, text: 'Noch ein Satz' });
    const m = mergeStates(a, b);
    expect(m.progress.p1.sentences).toEqual([
      { date: D1, text: 'Ich bin hier' }, { date: D2, text: 'Noch ein Satz' },
    ]);
  });

  it('girdileri değiştirmez', () => {
    const base = gradePattern(emptyState(), 'p1', 'easy', D1);
    const a = gradePattern(base, 'p1', 'easy', D2);
    const b = gradePattern(base, 'p1', 'hard', D3, 'cümle');
    const ca = structuredClone(a);
    const cb = structuredClone(b);
    mergeStates(a, b);
    expect(a).toEqual(ca);
    expect(b).toEqual(cb);
  });
});

describe('stampChanges', () => {
  it('yalnız değişen alanın damgasını basar', () => {
    const prev = emptyState();
    const next = { ...prev, order: ['a'] };
    const now = new Date('2026-11-09T10:00:00Z');
    const s = stampChanges(prev, next, now);
    expect(s.meta).toEqual(meta({ orderAt: now.toISOString() }));
    const t = stampChanges(prev, { ...prev, settings: { ...prev.settings, newPerDay: 9 } }, now);
    expect(t.meta).toEqual(meta({ settingsAt: now.toISOString() }));
    expect(stampChanges(prev, structuredClone(prev), now).meta).toBeUndefined();
  });
});

describe('mergeStates: görsel işaretleri', () => {
  const at = (n: number) => `2026-11-0${n}T10:00:00.000Z`;
  const base = emptyState();
  it('iki tarafın işaretleri birleşir', () => {
    const a = { ...base, flags: { p1: at(1) } };
    const b = { ...base, flags: { p2: at(2) } };
    expect(mergeStates(a, b).flags).toEqual({ p1: at(1), p2: at(2) });
    expect(mergeStates(b, a).flags).toEqual({ p1: at(1), p2: at(2) });
  });
  it('daha yeni geri alma eski işareti siler, daha yeni işaret geri almayı geçer', () => {
    const flagged = { ...base, flags: { p1: at(1) } };
    const cleared = { ...base, flagsCleared: { p1: at(2) } };
    const m = mergeStates(flagged, cleared);
    expect(m.flags).toBeUndefined();
    expect(m.flagsCleared).toEqual({ p1: at(2) });
    const reflagged = { ...base, flags: { p1: at(3) } };
    expect(mergeStates(m, reflagged).flags).toEqual({ p1: at(3) });
    expect(mergeStates(reflagged, m).flagsCleared).toBeUndefined();
  });
  it('işaret yoksa alan eklenmez; idempotent', () => {
    expect('flags' in mergeStates(base, base)).toBe(false);
    const a = { ...base, flags: { p1: at(1) }, flagsCleared: { p2: at(1) } };
    expect(mergeStates(a, a)).toEqual(a);
  });
});
