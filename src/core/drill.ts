// "Hangi kalıp?" ayırt etme alıştırması: karıştırılan kalıp gruplarından çoktan seçmeli soru.
// Saf ve belirleyici (aynı kalıp + gün → aynı sonuç), render/StrictMode'da kararlı.
import type { Pattern, Progress } from './types';

export interface PatternGroup { id: string; ids: string[]; hint: string }
export interface DrillOption { id: string; pattern: string }
export interface Drill {
  groupId: string;
  hint: string;
  correctId: string;
  options: DrillOption[];
}

export const DRILL_PROBABILITY = 0.4;
export const MAX_OPTIONS = 4;

// FNV-1a 32 bit.
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Yeni kart değilse (ilerleme kaydı var) ve grubunda kayıtlı en az 2 üye (kendisi dahil) varsa
// ~%40 olasılıkla soru döner; yoksa null.
export function pickDrill(
  patternId: string,
  today: string,
  progress: Record<string, Progress>,
  groups: readonly PatternGroup[],
  patterns: readonly Pattern[],
): Drill | null {
  if (!progress[patternId]) return null;
  if (hashStr(`${patternId}|${today}`) % 100 >= DRILL_PROBABILITY * 100) return null;
  const byId = new Map(patterns.map((p) => [p.id, p]));
  let best: { g: PatternGroup; seen: string[] } | null = null;
  for (const g of groups) {
    if (!g.ids.includes(patternId)) continue;
    const seen = g.ids.filter((id) => progress[id] && byId.has(id));
    if (seen.length < 2 || !seen.includes(patternId)) continue;
    if (!best || seen.length > best.seen.length) best = { g, seen };
  }
  if (!best) return null;
  const salt = `${patternId}|${today}`;
  const order = (a: string[]) => [...a].sort((x, y) => hashStr(`${salt}|${x}`) - hashStr(`${salt}|${y}`) || (x < y ? -1 : 1));
  // 4'ten fazla üye varsa doğru cevap kalır, diğerleri belirleyici biçimde seçilir.
  const others = order(best.seen.filter((id) => id !== patternId)).slice(0, MAX_OPTIONS - 1);
  const ids = order([patternId, ...others]);
  return {
    groupId: best.g.id,
    hint: best.g.hint,
    correctId: patternId,
    options: ids.map((id) => ({ id, pattern: byId.get(id)!.pattern })),
  };
}
