import meta from './visuals.json';

export interface Visual { src: string; cue?: string; alt: string }

const table = meta as Record<string, { cue?: string; alt?: string }>;

// Kalıba ait hafıza görseli. Dosya yoksa arayüz onError ile gizler.
export function visualFor(id: string): Visual | undefined {
  const m = table[id];
  if (!m) return undefined;
  return { src: `${import.meta.env.BASE_URL}visuals/${id}.svg`, cue: m.cue, alt: m.alt ?? '' };
}
