// LanguageTool ücretsiz API istemcisi (CORS açık). Hiçbir zaman hata fırlatmaz.

export interface Issue {
  message: string
  short?: string
  offset: number
  length: number
  replacements: string[]
  rule: string
  category: string
}

export type CheckResult =
  | { ok: true; issues: Issue[] }
  | { ok: false; reason: 'offline' | 'limit' | 'error' }

export interface CheckOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /** Test için saat. */
  now?: () => number
  language?: string
}

const ENDPOINT = 'https://api.languagetool.org/v2/check'
const DEFAULT_TIMEOUT = 6000
const MAX_PER_MINUTE = 18
const WINDOW_MS = 60_000
const CACHE_MAX = 50

/** Gürültü sayılan kategoriler (tipografi, boşluk, üslup). */
const IGNORED_CATEGORIES = new Set(['TYPOGRAPHY', 'WHITESPACE', 'STYLE', 'PUNCTUATION', 'REDUNDANCY'])
const IGNORED_RULES = /WHITESPACE/i

const cache = new Map<string, CheckResult>()
let stamps: number[] = []

/** Testler için sıfırlama. */
export function resetCheckState(): void {
  cache.clear()
  stamps = []
}

interface RawMatch {
  message?: unknown
  shortMessage?: unknown
  offset?: unknown
  length?: unknown
  replacements?: unknown
  rule?: { id?: unknown; category?: { id?: unknown } }
}

function mapMatches(json: unknown, text: string): Issue[] {
  const matches = (json as { matches?: unknown })?.matches
  if (!Array.isArray(matches)) return []
  const out: Issue[] = []
  for (const m of matches as RawMatch[]) {
    if (typeof m?.offset !== 'number' || typeof m?.length !== 'number') continue
    const category = String(m.rule?.category?.id ?? '')
    const rule = String(m.rule?.id ?? '')
    if (IGNORED_CATEGORIES.has(category.toUpperCase()) || IGNORED_RULES.test(rule)) continue
    const span = text.slice(m.offset, m.offset + m.length)
    // Yalnız boşluk/noktalama üzerindeki sorunlar atlanır.
    if (!/[\p{L}\p{N}]/u.test(span)) continue
    const reps = Array.isArray(m.replacements)
      ? (m.replacements as { value?: unknown }[])
          .map((r) => (typeof r?.value === 'string' ? r.value : ''))
          .filter((v) => v.length > 0)
          .slice(0, 3)
      : []
    const issue: Issue = {
      message: typeof m.message === 'string' ? m.message : '',
      offset: m.offset,
      length: m.length,
      replacements: reps,
      rule,
      category,
    }
    if (typeof m.shortMessage === 'string' && m.shortMessage) issue.short = m.shortMessage
    out.push(issue)
  }
  return out
}

export async function checkGerman(text: string, opts: CheckOptions = {}): Promise<CheckResult> {
  try {
    if (typeof text !== 'string' || text.trim() === '') return { ok: true, issues: [] }
    const cached = cache.get(text)
    if (cached) return cached

    const now = (opts.now ?? Date.now)()
    stamps = stamps.filter((t) => now - t < WINDOW_MS)
    if (stamps.length >= MAX_PER_MINUTE) return { ok: false, reason: 'limit' }

    const f = opts.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined)
    if (!f) return { ok: false, reason: 'offline' }
    stamps.push(now)

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT)
    let res: Response
    try {
      res = await f(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ text, language: opts.language ?? 'de-DE' }).toString(),
        signal: ctrl.signal,
      })
    } catch {
      // ağ yok, zaman aşımı veya CORS hatası
      return { ok: false, reason: 'offline' }
    } finally {
      clearTimeout(timer)
    }

    if (res.status === 429) return { ok: false, reason: 'limit' }
    if (!res.ok) return { ok: false, reason: 'error' }
    let json: unknown
    try {
      json = await res.json()
    } catch {
      return { ok: false, reason: 'error' }
    }
    const result: CheckResult = { ok: true, issues: mapMatches(json, text) }
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
    cache.set(text, result)
    return result
  } catch {
    return { ok: false, reason: 'error' }
  }
}
