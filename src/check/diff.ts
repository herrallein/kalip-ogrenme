// Kelime düzeyinde karşılaştırma: beklenen cümle ile öğrencinin yazdığı cümle.
// Saf fonksiyonlar, hiçbir zaman hata fırlatmaz.

export type SegmentType = 'same' | 'missing' | 'extra' | 'changed'

export interface Segment {
  type: SegmentType
  /** Beklenen cümledeki sözcük (same/missing/changed). */
  expected?: string
  /** Yazılan cümledeki sözcük (same/extra/changed). */
  actual?: string
  /** Yalnız 'changed': fark sadece büyük/küçük harf ya da ä↔ae, ö↔oe, ü↔ue, ß↔ss yazımıdır. */
  nearlyEqual?: boolean
}

/** Bir sözcüğün başındaki/sonundaki noktalama temizlenir (iç kısım korunur: z.B., Uhr-Zeit). */
const EDGE_PUNCT = /^[\s.,;:!?"'„“”‚‘’«»()[\]{}…–—-]+|[\s.,;:!?"'„“”‚‘’«»()[\]{}…–—-]+$/g

export function tokenize(text: string): string[] {
  if (typeof text !== 'string') return []
  return text
    .normalize('NFC')
    .split(/\s+/)
    .map((t) => t.replace(EDGE_PUNCT, ''))
    .filter((t) => t.length > 0)
}

/** Büyük/küçük harf ve umlaut-çevriyazı farklarını yok sayan anahtar. */
export function foldKey(token: string): string {
  return token
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

/** Karşılaştırma anahtarları: yalnız cümle başı küçük harfe çevrilir, yazım (ß/ss, ä/ae) korunur. */
function exactKeys(tokens: string[]): string[] {
  return tokens.map((t, i) => (i === 0 ? t.toLowerCase() : t))
}

const NEARLY_CREDIT = 0.8

export interface DiffResult {
  segments: Segment[]
  /** Bütün farklar yalnız büyük/küçük harf veya umlaut çevriyazısıysa true (en az bir fark varsa). */
  nearlyEqual: boolean
  /** Birebir eşleşen sözcük sayısı (LCS). */
  matched: number
}

function lcsTable(a: string[], b: string[]): number[][] {
  const t: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])
    }
  }
  return t
}

export function diffWords(expected: string, actual: string): DiffResult {
  const et = tokenize(expected)
  const at = tokenize(actual)
  const ek = exactKeys(et)
  const ak = exactKeys(at)
  const t = lcsTable(ek, ak)

  const segments: Segment[] = []
  let i = 0
  let j = 0
  let matched = 0
  let gapE: string[] = []
  let gapA: string[] = []

  // İki eşleşme arasındaki boşluk: sırayla eşleştirilir (changed), artan missing/extra olur.
  const flush = () => {
    const n = Math.max(gapE.length, gapA.length)
    for (let k = 0; k < n; k++) {
      const e = gapE[k]
      const a = gapA[k]
      if (e !== undefined && a !== undefined) {
        segments.push({ type: 'changed', expected: e, actual: a, nearlyEqual: foldKey(e) === foldKey(a) })
      } else if (e !== undefined) {
        segments.push({ type: 'missing', expected: e })
      } else if (a !== undefined) {
        segments.push({ type: 'extra', actual: a })
      }
    }
    gapE = []
    gapA = []
  }

  while (i < et.length || j < at.length) {
    if (i < et.length && j < at.length && ek[i] === ak[j]) {
      flush()
      segments.push({ type: 'same', expected: et[i], actual: at[j] })
      matched++
      i++
      j++
    } else if (j >= at.length || (i < et.length && t[i + 1][j] >= t[i][j + 1])) {
      gapE.push(et[i])
      i++
    } else {
      gapA.push(at[j])
      j++
    }
  }
  flush()

  const diffs = segments.filter((s) => s.type !== 'same')
  const nearlyEqual = diffs.length > 0 && diffs.every((s) => s.type === 'changed' && s.nearlyEqual === true)
  return { segments, nearlyEqual, matched }
}

/** Yalnız segment listesi (kısa yol). */
export function wordDiff(expected: string, actual: string): Segment[] {
  return diffWords(expected, actual).segments
}

/**
 * Benzerlik 0..1.
 *  - sıra puanı: 2*LCS / (n+m); "nearly" değişen sözcükler %80 sayılır.
 *  - sözcük torbası puanı: sıradan bağımsız ortak sözcük oranı (Dice).
 *  Sonuç = max(sıra, 0.85 * torba). Böylece doğru ama farklı sözcük sırası
 *  ("Gestern habe ich …" / "Ich habe gestern …") en fazla 0.85 alır:
 *  "good" aralığında kalır, "easy" olmaz (kalıbı birebir yazmadı).
 */
export function similarity(expected: string, actual: string): number {
  const et = tokenize(expected)
  const at = tokenize(actual)
  if (et.length === 0 || at.length === 0) return 0
  const { segments, matched } = diffWords(expected, actual)
  const nearly = segments.filter((s) => s.type === 'changed' && s.nearlyEqual).length
  const order = (2 * (matched + NEARLY_CREDIT * nearly)) / (et.length + at.length)

  const bag = new Map<string, number>()
  for (const t of et) bag.set(foldKey(t), (bag.get(foldKey(t)) ?? 0) + 1)
  let common = 0
  for (const t of at) {
    const k = foldKey(t)
    const c = bag.get(k) ?? 0
    if (c > 0) {
      common++
      bag.set(k, c - 1)
    }
  }
  const bagScore = (2 * common) / (et.length + at.length)
  return Math.min(1, Math.max(0, Math.max(order, 0.85 * bagScore)))
}
