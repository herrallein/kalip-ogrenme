import { beforeEach, describe, expect, it } from 'vitest'
import { checkGerman, resetCheckState } from './languagetool'
import { diffWords, similarity, wordDiff } from './diff'
import { suggestGrade } from './verdict'

function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; body: string }[] = []
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body) })
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return { f, calls }
}

const ltBody = {
  matches: [
    {
      message: 'Möglicher Grammatikfehler',
      shortMessage: 'Grammatik',
      offset: 4,
      length: 4,
      replacements: [{ value: 'bin' }, { value: 'war' }, { value: 'wurde' }, { value: 'sei' }],
      rule: { id: 'DE_AGREEMENT', category: { id: 'GRAMMAR' } },
    },
    { message: 'Leerzeichen', offset: 0, length: 1, replacements: [], rule: { id: 'WHITESPACE_RULE', category: { id: 'TYPOGRAPHY' } } },
    { message: 'Komma', offset: 36, length: 1, replacements: [], rule: { id: 'X', category: { id: 'GRAMMAR' } } },
  ],
}

describe('checkGerman', () => {
  beforeEach(() => resetCheckState())

  it('eşler, gürültüyü atar, en çok 3 öneri tutar', async () => {
    const { f, calls } = fakeFetch(ltBody)
    const r = await checkGerman('Ich habe gestern nach Hause gegangen.', { fetchImpl: f })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].replacements).toEqual(['bin', 'war', 'wurde'])
    expect(r.issues[0].category).toBe('GRAMMAR')
    expect(r.issues[0].short).toBe('Grammatik')
    expect(calls[0].body).toContain('language=de-DE')
    expect(calls[0].url).toBe('https://api.languagetool.org/v2/check')
  })

  it('önbellek aynı metni tekrar sormaz', async () => {
    const { f, calls } = fakeFetch(ltBody)
    await checkGerman('Hallo Welt', { fetchImpl: f })
    await checkGerman('Hallo Welt', { fetchImpl: f })
    expect(calls).toHaveLength(1)
  })

  it('429 → limit, 500 → error, ağ hatası → offline', async () => {
    expect(await checkGerman('a1', { fetchImpl: fakeFetch({}, 429).f })).toEqual({ ok: false, reason: 'limit' })
    expect(await checkGerman('a2', { fetchImpl: fakeFetch({}, 500).f })).toEqual({ ok: false, reason: 'error' })
    const boom = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    expect(await checkGerman('a3', { fetchImpl: boom })).toEqual({ ok: false, reason: 'offline' })
  })

  it('zaman aşımı → offline', async () => {
    const hang = ((_u: string, init?: RequestInit) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError')))
      })) as unknown as typeof fetch
    expect(await checkGerman('slow', { fetchImpl: hang, timeoutMs: 20 })).toEqual({ ok: false, reason: 'offline' })
  })

  it('dakikada 18 istekten sonra limit döner (istek atmadan)', async () => {
    const { f, calls } = fakeFetch({ matches: [] })
    let t = 1000
    for (let i = 0; i < 18; i++) await checkGerman('satz ' + i, { fetchImpl: f, now: () => t })
    const r = await checkGerman('satz 99', { fetchImpl: f, now: () => t })
    expect(r).toEqual({ ok: false, reason: 'limit' })
    expect(calls).toHaveLength(18)
    t += 61_000
    expect((await checkGerman('satz 100', { fetchImpl: f, now: () => t })).ok).toBe(true)
  })

  it('bozuk JSON ve boş metin hata fırlatmaz', async () => {
    const bad = (async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch
    expect(await checkGerman('x', { fetchImpl: bad })).toEqual({ ok: false, reason: 'error' })
    expect(await checkGerman('   ')).toEqual({ ok: true, issues: [] })
    expect(await checkGerman(undefined as unknown as string)).toEqual({ ok: true, issues: [] })
  })
})

describe('wordDiff', () => {
  it('aynı cümle, noktalama ve boşluk yok sayılır', () => {
    const s = wordDiff('Ich habe Hunger.', '  Ich   habe Hunger ')
    expect(s.every((x) => x.type === 'same')).toBe(true)
    expect(similarity('Ich habe Hunger.', 'ich habe  Hunger')).toBe(1)
  })

  it('eksik sözcük', () => {
    const s = wordDiff('Ich bin gestern nach Hause gegangen', 'Ich bin nach Hause gegangen')
    expect(s.filter((x) => x.type === 'missing')).toEqual([{ type: 'missing', expected: 'gestern' }])
    expect(similarity('Ich bin gestern nach Hause gegangen', 'Ich bin nach Hause gegangen')).toBeGreaterThan(0.85)
  })

  it('fazla sözcük ve değişen sözcük', () => {
    const s = wordDiff('Ich bin müde', 'Ich habe sehr müde')
    expect(s.map((x) => x.type)).toEqual(['same', 'changed', 'extra', 'same'])
  })

  it('ß/ss ve umlaut FARKLI sayılır ama nearlyEqual işaretlenir', () => {
    const r = diffWords('Ich muss früh gehen', 'Ich muss frueh gehen')
    expect(r.segments.some((x) => x.type === 'changed' && x.nearlyEqual)).toBe(true)
    expect(r.nearlyEqual).toBe(true)
    expect(diffWords('Das Fußball', 'Das Fussball').nearlyEqual).toBe(true)
    expect(similarity('Das Fußball', 'Das Fussball')).toBeLessThan(1)
  })

  it('büyük/küçük harf yalnız cümle başında yok sayılır', () => {
    expect(diffWords('Ich sehe den Hund', 'ich sehe den Hund').segments.every((x) => x.type === 'same')).toBe(true)
    const r = diffWords('Ich sehe den Hund', 'Ich sehe den hund')
    expect(r.segments[3]).toMatchObject({ type: 'changed', nearlyEqual: true })
    expect(r.nearlyEqual).toBe(true)
  })

  it('farklı ama doğru sözcük sırası makul puan alır (0.6–0.9)', () => {
    const s = similarity('Ich habe gestern Fußball gespielt', 'Gestern habe ich Fußball gespielt')
    expect(s).toBeGreaterThanOrEqual(0.6)
    expect(s).toBeLessThan(0.9)
    expect(suggestGrade({ similarity: s, issues: [] })).toBe('good')
  })

  it('tamamen farklı cümle düşük puan', () => {
    expect(similarity('Ich habe Hunger', 'Das Wetter ist schön')).toBeLessThan(0.3)
  })

  it('boş girdi ve garip girdi hata fırlatmaz', () => {
    expect(similarity('', '')).toBe(0)
    expect(similarity('Hallo', '')).toBe(0)
    expect(wordDiff('', 'Hallo')).toEqual([{ type: 'extra', actual: 'Hallo' }])
    expect(() => wordDiff(undefined as unknown as string, null as unknown as string)).not.toThrow()
    expect(similarity(undefined as unknown as string, 'x')).toBe(0)
  })
})

describe('suggestGrade', () => {
  const grammar = { message: 'm', offset: 0, length: 1, replacements: [], rule: 'R', category: 'GRAMMAR' }
  it('eşikler', () => {
    expect(suggestGrade({ similarity: 0.95, issues: [] })).toBe('easy')
    expect(suggestGrade({ similarity: 0.9, issues: [] })).toBe('easy')
    expect(suggestGrade({ similarity: 0.95, issues: [grammar] })).toBe('good')
    expect(suggestGrade({ similarity: 0.95, issues: null })).toBe('easy')
    expect(suggestGrade({ similarity: 0.6 })).toBe('good')
    expect(suggestGrade({ similarity: 0.59 })).toBe('hard')
  })
  it('boş girdi null; asla fırlatmaz', () => {
    expect(suggestGrade({ similarity: null })).toBeNull()
    expect(suggestGrade({ similarity: NaN })).toBeNull()
    expect(() => suggestGrade(undefined as never)).not.toThrow()
    expect(suggestGrade(undefined as never)).toBeNull()
  })
})
