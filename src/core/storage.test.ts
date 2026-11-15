import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, emptyState, gradePattern } from './scheduler';
import { STORAGE_KEY, exportState, importState, loadState, saveState } from './storage';

afterEach(() => vi.unstubAllGlobals());

function fakeStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

describe('localStorage yokken', () => {
  it('loadState boş durum verir, saveState false döner, hata yok', () => {
    expect(typeof localStorage).toBe('undefined');
    expect(loadState()).toEqual(emptyState());
    expect(saveState(emptyState())).toBe(false);
  });
});

describe('save / load', () => {
  it('kaydedilen durum geri okunur', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const s = gradePattern(emptyState(), 'a1-1', 'easy', '2026-11-15', 'Hallo');
    expect(saveState(s)).toBe(true);
    expect(loadState()).toEqual(s);
  });
  it('bozuk JSON veya şekil: emptyState', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [STORAGE_KEY]: '{bozuk' }));
    expect(loadState()).toEqual(emptyState());
    vi.stubGlobal('localStorage', fakeStorage({ [STORAGE_KEY]: '{"version":2}' }));
    expect(loadState()).toEqual(emptyState());
  });
  it('eksik ayar alanları varsayılanla tamamlanır', () => {
    const raw = { version: 1, settings: { newPerDay: 5 }, progress: {}, days: {}, order: [] };
    vi.stubGlobal('localStorage', fakeStorage({ [STORAGE_KEY]: JSON.stringify(raw) }));
    expect(loadState().settings).toEqual({ ...DEFAULT_SETTINGS, newPerDay: 5 });
  });
  it('saveState hata fırlatan depoda false döner', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('dolu'); },
    });
    expect(saveState(emptyState())).toBe(false);
  });
});

describe('export / import', () => {
  it('gidiş dönüş aynı durumu verir; çıktı girintili', () => {
    const s = gradePattern(emptyState(), 'a1-1', 'good', '2026-11-15');
    const text = exportState(s);
    expect(text).toContain('\n  "version": 1');
    expect(importState(text)).toEqual(s);
  });
  it('ayar tamamen eksikse varsayılan', () => {
    const t = JSON.stringify({ version: 1, progress: {}, days: {}, order: [] });
    expect(importState(t).settings).toEqual(DEFAULT_SETTINGS);
  });
  it('ayar eksik alanlarla varsayılana tamamlanır', () => {
    const t = JSON.stringify({
      version: 1, settings: { reviewIntervals: [2, 4] }, progress: {}, days: {}, order: [],
    });
    expect(importState(t).settings).toEqual({ ...DEFAULT_SETTINGS, reviewIntervals: [2, 4] });
  });
  it('geçersiz JSON: Türkçe hata', () => {
    expect(() => importState('merhaba')).toThrow(/JSON/);
  });
  it('version 1 değilse Türkçe hata', () => {
    expect(() => importState('{"version":2,"progress":{},"days":{},"order":[]}'))
      .toThrow(/sürüm/);
  });
  it('şekil bozuksa Türkçe hata', () => {
    expect(() => importState('[]')).toThrow(/yedek değil/);
    expect(() => importState('{"version":1,"days":{},"order":[]}')).toThrow(/progress/);
    expect(() => importState('{"version":1,"progress":{},"order":[]}')).toThrow(/days/);
    expect(() => importState('{"version":1,"progress":{},"days":{}}')).toThrow(/order/);
    expect(() => importState(
      '{"version":1,"settings":{"newPerDay":"x"},"progress":{},"days":{},"order":[]}',
    )).toThrow(/newPerDay/);
    expect(() => importState(
      '{"version":1,"progress":{"a":{"id":"a"}},"days":{},"order":[]}',
    )).toThrow(/bozuk/);
  });
});
