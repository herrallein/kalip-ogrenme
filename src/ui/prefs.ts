// Yalnız bu cihazda tutulan tercihler. AppState'e girmez, eşitlenmez, yedeğe karışmaz.
export const PREFS_KEY = 'kalip-ogrenme:prefs';

export interface Prefs { autoSpeak: boolean }

export const DEFAULT_PREFS: Prefs = { autoSpeak: false };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const o = JSON.parse(raw) as unknown;
    const auto = typeof o === 'object' && o !== null ? (o as { autoSpeak?: unknown }).autoSpeak : undefined;
    return { autoSpeak: auto === true };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ autoSpeak: p.autoSpeak }));
  } catch {
    /* depolama kapalı/dolu: sessizce geç */
  }
}
