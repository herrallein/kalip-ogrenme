// Almanca sesli okuma: window.speechSynthesis üzerinde ince bir sarmalayıcı. Hiçbir şey fırlatmaz.

interface SpeakOptions {
  slow?: boolean;
  // Okuma bitince (ya da hata/kesilme/güvenlik zaman aşımıyla) en çok bir kez çağrılır.
  onEnd?: () => void;
}

export const RATE_NORMAL = 0.95;
export const RATE_SLOW = 0.6;
export const SAFETY_BASE_MS = 3000;
export const SAFETY_PER_CHAR_MS = 250;

// Okunurken kötü duyulan kısımları atar: "…", "..." ve parantez içi ipuçları.
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/…|\.{3}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Almanca ses seç: önce tam de-DE, sonra herhangi bir de*; yoksa undefined (tarayıcı lang'a göre seçer).
export function pickGermanVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  return voices.find((v) => norm(v) === 'de-de')
    ?? voices.find((v) => norm(v) === 'de' || norm(v).startsWith('de-'));
}

function synth(): SpeechSynthesis | undefined {
  try {
    const s = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    const U = (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
    return s && typeof U === 'function' ? s : undefined;
  } catch {
    return undefined;
  }
}

export function canSpeak(): boolean {
  return synth() !== undefined;
}

let listening = false;
// Sesler çoğu tarayıcıda geç yüklenir; yüklenince listeyi tazelemek için dinle (bir kez).
function watchVoices(s: SpeechSynthesis) {
  if (listening) return;
  listening = true;
  try { s.addEventListener?.('voiceschanged', () => { try { s.getVoices(); } catch { /* yoksay */ } }); } catch { /* yoksay */ }
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  try {
    const s = synth();
    if (!s) return;
    const clean = cleanForSpeech(text);
    if (!clean) return;
    watchVoices(s);
    s.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'de-DE';
    u.rate = opts.slow ? RATE_SLOW : RATE_NORMAL;
    const voice = pickGermanVoice(s.getVoices());
    if (voice) u.voice = voice;
    if (opts.onEnd) {
      const cb = opts.onEnd;
      let fired = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (fired) return;
        fired = true;
        if (timer !== undefined) clearTimeout(timer);
        try { cb(); } catch { /* geri çağrı hatası sesi bozmasın */ }
      };
      u.onend = finish;
      u.onerror = finish;
      // Bazı tarayıcılar onend'i hiç yollamaz: süreye göre güvenlik zaman aşımı.
      timer = setTimeout(finish, SAFETY_BASE_MS + clean.length * SAFETY_PER_CHAR_MS);
    }
    s.speak(u);
  } catch {
    /* ses hiçbir zaman uygulamayı bozmamalı */
    try { opts.onEnd?.(); } catch { /* yoksay */ }
  }
}
