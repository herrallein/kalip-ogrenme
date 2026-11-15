import { describe, expect, it } from 'vitest';
import { patterns } from './index';
import A1 from './patterns/A1.json';
import A2 from './patterns/A2.json';
import B1 from './patterns/B1.json';
import B2 from './patterns/B2.json';
import C1 from './patterns/C1.json';
import type { Pattern } from '../core/types';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
const files: Record<(typeof LEVELS)[number], Pattern[]> = {
  A1: A1 as unknown as Pattern[],
  A2: A2 as unknown as Pattern[],
  B1: B1 as unknown as Pattern[],
  B2: B2 as unknown as Pattern[],
  C1: C1 as unknown as Pattern[],
};

const nonEmpty = (s: unknown): boolean => typeof s === 'string' && s.trim().length > 0;

function normalizePattern(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('Kalıp verisi: genel', () => {
  it('patterns dizisi tüm düzey dosyalarının birleşimidir', () => {
    const total = LEVELS.reduce((n, l) => n + files[l].length, 0);
    expect(patterns.length).toBe(total);
  });

  it('her düzey dosyası bir dizidir', () => {
    for (const l of LEVELS) expect(Array.isArray(files[l])).toBe(true);
  });

  it('id tüm dosyalarda tekildir', () => {
    const ids = LEVELS.flatMap((l) => files[l].map((p) => p.id));
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dup).toEqual([]);
  });

  it('düzeyler arasında aynı pattern metni yoktur', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const l of LEVELS) {
      for (const p of files[l]) {
        const key = normalizePattern(p.pattern);
        const prev = seen.get(key);
        if (prev !== undefined && prev !== l) clashes.push(`${p.id} (${prev} ve ${l}): ${p.pattern}`);
        if (prev === undefined) seen.set(key, l);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('aynı Almanca örnek cümle iki kez geçmez', () => {
    const all = LEVELS.flatMap((l) => files[l].flatMap((p) => p.examples.map((e) => e.de.trim())));
    const dup = all.filter((s, i) => all.indexOf(s) !== i);
    expect(dup).toEqual([]);
  });
});

for (const level of LEVELS) {
  describe(`Kalıp verisi: ${level}`, () => {
    const list = files[level];

    it('boş dosya kabul edilir; doluysa kurallar geçerlidir', () => {
      expect(Array.isArray(list)).toBe(true);
    });

    it('şema alanları ve türleri doğru', () => {
      for (const p of list) {
        expect(typeof p.id).toBe('string');
        expect(p.level).toBe(level);
        expect(Number.isInteger(p.priority)).toBe(true);
        expect(nonEmpty(p.pattern)).toBe(true);
        expect(nonEmpty(p.meaning)).toBe(true);
        if (p.note !== undefined) expect(nonEmpty(p.note)).toBe(true);
        expect(Array.isArray(p.examples)).toBe(true);
      }
    });

    it('id biçimi ve önek düzeyle uyumlu', () => {
      const re = new RegExp(`^${level.toLowerCase()}-[a-z0-9]+(-[a-z0-9]+)*$`);
      for (const p of list) expect(p.id, p.id).toMatch(re);
    });

    it('priority 1..n sıralı', () => {
      expect(list.map((p) => p.priority)).toEqual(list.map((_, i) => i + 1));
    });

    it('4-8 örnek var, metinler boş değil', () => {
      for (const p of list) {
        expect(p.examples.length, p.id).toBeGreaterThanOrEqual(4);
        expect(p.examples.length, p.id).toBeLessThanOrEqual(8);
        for (const e of p.examples) {
          expect(nonEmpty(e.de), p.id).toBe(true);
          expect(nonEmpty(e.tr), p.id).toBe(true);
        }
      }
    });

    it('düzey içinde aynı kalıp tekrarlanmaz', () => {
      const keys = list.map((p) => normalizePattern(p.pattern));
      expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
    });
  });
}

import visuals from './visuals.json';

describe('görsel metinleri', () => {
  const ids = new Set(patterns.map((p) => p.id));
  const entries = Object.entries(visuals as Record<string, { cue?: string; alt?: string }>);
  it('her anahtar var olan bir kalıp id\'si', () => {
    expect(entries.filter(([k]) => !ids.has(k)).map(([k]) => k)).toEqual([]);
  });
  it('cue en çok 160 karakter, alt dolu', () => {
    for (const [k, v] of entries) {
      if (v.cue !== undefined) expect(v.cue.length, k).toBeLessThanOrEqual(160);
      expect(nonEmpty(v.alt), k).toBe(true);
    }
  });
});
