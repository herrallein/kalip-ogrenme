// Yalnız bu cihazda tutulan tercihler. AppState'e girmez, eşitlenmez, yedeğe karışmaz.
export const PREFS_KEY = 'kalip-ogrenme:prefs';

export interface Prefs { autoSpeak: boolean; checkSentences: boolean }

export const DEFAULT_PREFS: Prefs = { autoSpeak: false, checkSentences: true };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const o = JSON.parse(raw) as unknown;
    const r = typeof o === 'object' && o !== null ? (o as { autoSpeak?: unknown; checkSentences?: unknown }) : {};
    return {
      autoSpeak: r.autoSpeak === true,
      checkSentences: typeof r.checkSentences === 'boolean' ? r.checkSentences : DEFAULT_PREFS.checkSentences,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

// Verilen alanları mevcut tercihlerle birleştirip kaydeder.
export function savePrefs(p: Partial<Prefs>): void {
  try {
    const next = { ...loadPrefs(), ...p };
    localStorage.setItem(PREFS_KEY, JSON.stringify({ autoSpeak: next.autoSpeak, checkSentences: next.checkSentences }));
  } catch {
    /* depolama kapalı/dolu: sessizce geç */
  }
}
