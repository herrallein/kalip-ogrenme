// Öğrenciye gösterilen yalnız bir ÖNERİ: kendini nasıl değerlendireceği (kullanıcı değiştirebilir).

import type { Issue } from './languagetool'

export type SuggestedGrade = 'easy' | 'good' | 'hard'

/** Eşikler (benzerlik 0..1, diff.ts similarity). */
export const THRESHOLDS = {
  /** >= bu ve ciddi dilbilgisi sorunu yok → easy */
  easy: 0.9,
  /** >= bu → good (sorun varsa en çok good) */
  good: 0.6,
} as const

/** "Ciddi" sayılan kategoriler: bunlar easy'yi engeller. */
const SERIOUS = /^(GRAMMAR|CASING|TYPOS|CONFUSED_WORDS|SEMANTICS|AGREEMENT|COMPOUNDING|MISC)/i

export interface VerdictInput {
  /** 0..1 ya da null (hiç yazılmadı). */
  similarity: number | null
  /** LanguageTool sorunları; null/undefined = denetim yapılamadı (çevrimdışı) → yalnız benzerliğe bakılır. */
  issues?: Issue[] | null
}

/**
 * - boş/geçersiz giriş (similarity null/NaN) → null
 * - sim >= 0.9 ve ciddi sorun yok → 'easy'
 * - sim >= 0.6 → 'good'  (0.9+ olup sorun varsa da 'good')
 * - aksi → 'hard'
 * Doğru ama farklı sözcük sırası similarity'de en çok 0.85 alır → 'good'.
 */
export function suggestGrade(input: VerdictInput): SuggestedGrade | null {
  try {
    const s = input?.similarity
    if (s === null || s === undefined || typeof s !== 'number' || Number.isNaN(s)) return null
    if (s <= 0) return 'hard'
    const serious = (input.issues ?? []).some((i) => !i.category || SERIOUS.test(i.category))
    if (s >= THRESHOLDS.easy && !serious) return 'easy'
    if (s >= THRESHOLDS.good) return 'good'
    return 'hard'
  } catch {
    return null
  }
}
