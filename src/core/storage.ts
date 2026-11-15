import { DEFAULT_SETTINGS, emptyState } from './scheduler';
import type { AppState, Settings } from './types';

export const STORAGE_KEY = 'kalip-ogrenme:v1';

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Ham veriyi doğrular; bozuksa Türkçe Error fırlatır. Eksik ayarlar varsayılanla tamamlanır.
function parseState(raw: unknown): AppState {
  if (!isObj(raw)) throw new Error('Dosya geçerli bir yedek değil: beklenen yapı bir nesne olmalı.');
  if (raw.version !== 1) throw new Error('Desteklenmeyen yedek sürümü (version 1 olmalı).');
  if (!isObj(raw.progress)) throw new Error('Yedekte "progress" alanı eksik veya bozuk.');
  if (!isObj(raw.days)) throw new Error('Yedekte "days" alanı eksik veya bozuk.');
  if (!Array.isArray(raw.order) || !raw.order.every((x) => typeof x === 'string')) {
    throw new Error('Yedekte "order" alanı eksik veya bozuk.');
  }

  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    reviewIntervals: [...DEFAULT_SETTINGS.reviewIntervals],
  };
  if (raw.settings !== undefined) {
    if (!isObj(raw.settings)) throw new Error('Yedekte "settings" alanı bozuk.');
    for (const k of ['newPerDay', 'learningCap', 'easyStreakToGraduate'] as const) {
      const v = raw.settings[k];
      if (v === undefined) continue;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        throw new Error(`Ayar "${k}" geçerli bir sayı değil.`);
      }
      settings[k] = v;
    }
    const iv = raw.settings.reviewIntervals;
    if (iv !== undefined) {
      if (!Array.isArray(iv) || iv.length === 0 ||
          !iv.every((x) => typeof x === 'number' && Number.isFinite(x) && x >= 1)) {
        throw new Error('Ayar "reviewIntervals" en az bir pozitif sayı içeren liste olmalı.');
      }
      settings.reviewIntervals = [...(iv as number[])];
    }
  }

  for (const [id, pr] of Object.entries(raw.progress)) {
    if (!isObj(pr) || pr.id !== id ||
        (pr.phase !== 'learning' && pr.phase !== 'review') ||
        typeof pr.due !== 'string' || typeof pr.introduced !== 'string' ||
        typeof pr.easyStreak !== 'number' || typeof pr.step !== 'number' ||
        typeof pr.seen !== 'number' || typeof pr.lapses !== 'number' ||
        !Array.isArray(pr.history) || !Array.isArray(pr.sentences)) {
      throw new Error(`"${id}" kalıbının ilerleme kaydı bozuk.`);
    }
  }
  for (const [d, rec] of Object.entries(raw.days)) {
    if (!isObj(rec) || !Array.isArray(rec.newIds) || !Array.isArray(rec.done)) {
      throw new Error(`${d} günü kaydı bozuk.`);
    }
  }

  return {
    version: 1,
    settings,
    progress: raw.progress as unknown as AppState['progress'],
    days: raw.days as unknown as AppState['days'],
    order: raw.order as string[],
  };
}

function getStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadState(): AppState {
  try {
    const text = getStore()?.getItem(STORAGE_KEY);
    if (!text) return emptyState();
    return parseState(JSON.parse(text));
  } catch {
    return emptyState();
  }
}

export function saveState(s: AppState): boolean {
  try {
    const store = getStore();
    if (!store) return false;
    store.setItem(STORAGE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function exportState(s: AppState): string {
  return JSON.stringify(s, null, 2);
}

export function importState(text: string): AppState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Dosya okunamadı: geçerli bir JSON değil.');
  }
  return parseState(raw);
}
