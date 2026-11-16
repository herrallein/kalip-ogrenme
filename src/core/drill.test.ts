import { describe, expect, it } from 'vitest';
import { DRILL_PROBABILITY, hashStr, pickDrill, type PatternGroup } from './drill';
import { mkPatterns, mkProgress } from './testutil';

const patterns = mkPatterns('A1', 8);
const groups: PatternGroup[] = [
  { id: 'g1', ids: ['a1-1', 'a1-2', 'a1-3'], hint: 'ipucu 1' },
  { id: 'g2', ids: ['a1-1', 'a1-2', 'a1-3', 'a1-4', 'a1-5', 'a1-6'], hint: 'ipucu 2' },
  { id: 'g3', ids: ['a1-7', 'a1-8'], hint: 'ipucu 3' },
];
const prog = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, mkProgress(id)]));

// 40% eşiğini geçen bir gün bul (belirleyici).
function dayWith(id: string, wantDrill: boolean): string {
  for (let d = 1; d <= 90; d++) {
    const day = `2026-12-${String(d).padStart(2, '0')}`;
    if ((hashStr(`${id}|${day}`) % 100 < DRILL_PROBABILITY * 100) === wantDrill) return day;
  }
  throw new Error('gün bulunamadı');
}

describe('pickDrill', () => {
  it('belirleyici: aynı girdi aynı sonuç', () => {
    const day = dayWith('a1-1', true);
    const p = prog('a1-1', 'a1-2', 'a1-3');
    expect(pickDrill('a1-1', day, p, groups, patterns)).toEqual(pickDrill('a1-1', day, p, groups, patterns));
  });
  it('olasılık ~%40 civarında', () => {
    const p = prog('a1-1', 'a1-2');
    let n = 0;
    for (let d = 0; d < 400; d++) if (pickDrill('a1-1', `2027-01-${d}`, p, groups, patterns)) n++;
    expect(n / 400).toBeGreaterThan(0.3);
    expect(n / 400).toBeLessThan(0.5);
  });
  it('seçilmeyen günde null', () => {
    expect(pickDrill('a1-1', dayWith('a1-1', false), prog('a1-1', 'a1-2'), groups, patterns)).toBeNull();
  });
  it('uygunluk: ilerlemesi yoksa, grupta kendisi dışında kayıtlı üye yoksa, grupsuzsa null', () => {
    const day = dayWith('a1-1', true);
    expect(pickDrill('a1-1', day, prog('a1-2', 'a1-3'), groups, patterns)).toBeNull();
    expect(pickDrill('a1-1', day, prog('a1-1'), groups, patterns)).toBeNull();
    expect(pickDrill('a1-1', day, prog('a1-1', 'a1-7'), groups, patterns)).toBeNull();
    expect(pickDrill('a1-4', dayWith('a1-4', true), prog('a1-4'), [], patterns)).toBeNull();
  });
  it('seçenekler: yalnız kayıtlı üyeler, doğru cevap dahil, en çok 4, çoklu grupta kayıtlı üyesi çok olan', () => {
    const day = dayWith('a1-1', true);
    const d = pickDrill('a1-1', day, prog('a1-1', 'a1-2', 'a1-3', 'a1-4', 'a1-5', 'a1-6'), groups, patterns)!;
    expect(d.groupId).toBe('g2');
    expect(d.hint).toBe('ipucu 2');
    expect(d.options).toHaveLength(4);
    expect(d.options.map((o) => o.id)).toContain('a1-1');
    expect(new Set(d.options.map((o) => o.id)).size).toBe(4);
    const d2 = pickDrill('a1-1', day, prog('a1-1', 'a1-3'), groups, patterns)!;
    expect(d2.options.map((o) => o.id).sort()).toEqual(['a1-1', 'a1-3']);
    expect(d2.options.find((o) => o.id === 'a1-3')!.pattern).toBe('Kalıp 3');
  });
  it('karıştırma günden güne değişebilir ama aynı gün sabit', () => {
    const p = prog('a1-1', 'a1-2', 'a1-3');
    const orders = new Set<string>();
    for (let d = 1; d <= 60; d++) {
      const day = `2026-12-${String(d).padStart(2, '0')}`;
      const r = pickDrill('a1-1', day, p, groups, patterns);
      if (r) orders.add(r.options.map((o) => o.id).join());
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});
