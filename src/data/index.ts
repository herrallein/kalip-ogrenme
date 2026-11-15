import type { Pattern } from '../core/types';
import A1 from './patterns/A1.json';
import A2 from './patterns/A2.json';
import B1 from './patterns/B1.json';
import B2 from './patterns/B2.json';
import C1 from './patterns/C1.json';

const all = [A1, A2, B1, B2, C1] as unknown as Pattern[][];

function build(): Pattern[] {
  const seen = new Set<string>();
  const out: Pattern[] = [];
  for (const p of all.flat()) {
    if (seen.has(p.id)) {
      console.warn(`Kalıp verisi: tekrar eden id yok sayıldı: ${p.id}`);
      continue;
    }
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

export const patterns: Pattern[] = build();
