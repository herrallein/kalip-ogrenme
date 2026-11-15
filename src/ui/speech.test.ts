import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanForSpeech, pickGermanVoice, speak, canSpeak, RATE_NORMAL, RATE_SLOW } from './speech';
import { DEFAULT_PREFS, PREFS_KEY, loadPrefs, savePrefs } from './prefs';

afterEach(() => vi.unstubAllGlobals());

const voice = (lang: string, name = lang) => ({ lang, name }) as SpeechSynthesisVoice;

function stubSpeech(voices: SpeechSynthesisVoice[]) {
  const calls: string[] = [];
  const spoken: Array<{ text: string; lang: string; rate: number; voice?: SpeechSynthesisVoice }> = [];
  class FakeUtterance {
    lang = ''; rate = 1; voice?: SpeechSynthesisVoice;
    constructor(public text: string) {}
  }
  const synth = {
    cancel: () => { calls.push('cancel'); },
    speak: (u: FakeUtterance) => { calls.push('speak'); spoken.push(u); },
    getVoices: () => voices,
    addEventListener: () => {},
  };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return { calls, spoken };
}

describe('cleanForSpeech', () => {
  it('üç nokta ve parantez içini atar', () => {
    expect(cleanForSpeech('Ich möchte … (Infinitiv) gehen')).toBe('Ich möchte gehen');
    expect(cleanForSpeech('Ich habe ... Zeit')).toBe('Ich habe Zeit');
  });
});

describe('pickGermanVoice', () => {
  it('önce tam de-DE', () => {
    const v = pickGermanVoice([voice('en-US'), voice('de-AT'), voice('de-DE')]);
    expect(v?.lang).toBe('de-DE');
  });
  it('de-DE yoksa herhangi de*', () => {
    expect(pickGermanVoice([voice('en-US'), voice('de_CH')])?.lang).toBe('de_CH');
  });
  it('Almanca yoksa undefined; den gibi önekleri saymaz', () => {
    expect(pickGermanVoice([voice('en-US'), voice('den-XX')])).toBeUndefined();
    expect(pickGermanVoice([])).toBeUndefined();
  });
});

describe('speak', () => {
  it('desteklenmiyorsa fırlatmaz ve canSpeak false', () => {
    expect(canSpeak()).toBe(false);
    expect(() => speak('Hallo')).not.toThrow();
  });
  it('konuşmadan önce iptal eder, de-DE ve normal hız ayarlar', () => {
    const { calls, spoken } = stubSpeech([voice('en-US'), voice('de-DE')]);
    speak('Guten Tag');
    expect(calls).toEqual(['cancel', 'speak']);
    expect(spoken[0]).toMatchObject({ text: 'Guten Tag', lang: 'de-DE', rate: RATE_NORMAL });
    expect(spoken[0].voice?.lang).toBe('de-DE');
  });
  it('yavaş modda düşük hız; ses listesi boşken sesi atlar', () => {
    const { spoken } = stubSpeech([]);
    speak('Guten Tag', { slow: true });
    expect(spoken[0].rate).toBe(RATE_SLOW);
    expect(spoken[0].voice).toBeUndefined();
  });
  it('temizlik sonrası boşsa konuşmaz; sentez hata verirse fırlatmaz', () => {
    const { spoken } = stubSpeech([]);
    speak('…');
    expect(spoken).toHaveLength(0);
    vi.stubGlobal('speechSynthesis', { cancel: () => { throw new Error('x'); }, getVoices: () => [] });
    expect(() => speak('Hallo')).not.toThrow();
  });
});

describe('prefs', () => {
  const fake = (init: Record<string, string> = {}) => {
    const m = new Map(Object.entries(init));
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
  };
  it('varsayılan kapalı; localStorage yokken de çalışır', () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    expect(() => savePrefs({ autoSpeak: true })).not.toThrow();
  });
  it('kaydet-oku turu; bozuk veri varsayılana döner', () => {
    vi.stubGlobal('localStorage', fake());
    savePrefs({ autoSpeak: true });
    expect(loadPrefs().autoSpeak).toBe(true);
    vi.stubGlobal('localStorage', fake({ [PREFS_KEY]: '{bozuk' }));
    expect(loadPrefs().autoSpeak).toBe(false);
    vi.stubGlobal('localStorage', fake({ [PREFS_KEY]: '{"autoSpeak":"yes"}' }));
    expect(loadPrefs().autoSpeak).toBe(false);
  });
  it('depolama hata verirse fırlatmaz', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } });
    expect(loadPrefs().autoSpeak).toBe(false);
    expect(() => savePrefs({ autoSpeak: true })).not.toThrow();
  });
});
