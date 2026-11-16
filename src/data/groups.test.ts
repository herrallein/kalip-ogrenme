import { describe, expect, it } from 'vitest';
import { patterns } from './index';
import groups from './groups.json';

interface Group {
  id: string;
  ids: string[];
  hint: string;
}

const list = groups as Group[];
const known = new Set(patterns.map((p) => p.id));

describe('Karıştırılan kalıp grupları', () => {
  it('25-45 grup vardır', () => {
    expect(list.length).toBeGreaterThanOrEqual(25);
    expect(list.length).toBeLessThanOrEqual(45);
  });

  it('grup id değerleri tekildir ve boş değildir', () => {
    const ids = list.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.trim().length).toBeGreaterThan(0);
  });

  it('her grupta 2-4 kalıp vardır, kopya yoktur', () => {
    for (const g of list) {
      expect(g.ids.length, g.id).toBeGreaterThanOrEqual(2);
      expect(g.ids.length, g.id).toBeLessThanOrEqual(4);
      expect(new Set(g.ids).size, g.id).toBe(g.ids.length);
    }
  });

  it('tüm kalıp id değerleri mevcuttur', () => {
    for (const g of list) for (const id of g.ids) expect(known.has(id), `${g.id}: ${id}`).toBe(true);
  });

  it('bir kalıp en çok 2 grupta yer alır', () => {
    const count = new Map<string, number>();
    for (const g of list) for (const id of g.ids) count.set(id, (count.get(id) ?? 0) + 1);
    for (const [id, n] of count) expect(n, id).toBeLessThanOrEqual(2);
  });

  it('ipucu dolu ve en çok 200 karakterdir', () => {
    for (const g of list) {
      expect(g.hint.trim().length, g.id).toBeGreaterThan(0);
      expect(g.hint.length, g.id).toBeLessThanOrEqual(200);
    }
  });
});
