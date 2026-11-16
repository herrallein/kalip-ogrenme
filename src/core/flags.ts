// "Görsel anlatmıyor" işareti. Eşitleme: merge.ts mergeFlags (flags + flagsCleared).
import type { AppState } from './types';

export const isFlagged = (s: AppState, id: string): boolean => !!s.flags?.[id];

// İşaretle ya da geri al; geri alma flagsCleared'a yazılır ki diğer cihazdaki eski işareti de silsin.
export function toggleFlag(s: AppState, id: string, now: Date = new Date()): AppState {
  const at = now.toISOString();
  const flags = { ...s.flags };
  const cleared = { ...s.flagsCleared };
  if (flags[id]) {
    delete flags[id];
    cleared[id] = at;
  } else {
    flags[id] = at;
    delete cleared[id];
  }
  const next: AppState = { ...s };
  if (Object.keys(flags).length) next.flags = flags; else delete next.flags;
  if (Object.keys(cleared).length) next.flagsCleared = cleared; else delete next.flagsCleared;
  return next;
}

// Yalnız şu an var olan kalıpların işaretleri, kimlik sırasıyla.
export function flaggedIds(s: AppState, knownIds?: readonly string[]): string[] {
  const known = knownIds ? new Set(knownIds) : null;
  return Object.keys(s.flags ?? {}).filter((id) => !known || known.has(id)).sort();
}
