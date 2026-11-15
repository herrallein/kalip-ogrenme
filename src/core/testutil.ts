import { emptyState } from './scheduler';
import type { AppState, Level, Pattern, Progress } from './types';

export function mkPatterns(level: Level, n: number, prefix = level.toLowerCase()): Pattern[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    level,
    priority: i + 1,
    pattern: `Kalıp ${i + 1}`,
    meaning: `Anlam ${i + 1}`,
    examples: [1, 2, 3, 4].map((k) => ({ de: `de ${i + 1}.${k}`, tr: `tr ${i + 1}.${k}` })),
  }));
}

export function mkProgress(id: string, over: Partial<Progress> = {}): Progress {
  return {
    id, phase: 'learning', introduced: '2026-01-01', easyStreak: 0, step: 0,
    due: '2099-01-01', seen: 1, lapses: 0, history: [], sentences: [], ...over,
  };
}

export function withProgress(list: Progress[], base: AppState = emptyState()): AppState {
  const s = structuredClone(base);
  for (const p of list) s.progress[p.id] = p;
  return s;
}
