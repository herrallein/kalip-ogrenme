import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyState, gradePattern, planDay } from '../core/scheduler';
import { mkPatterns } from '../core/testutil';
import type { AppState } from '../core/types';
import { exportState } from '../core/storage';
import {
  GIST_FILE, SYNC_KEY, SyncError, clearSyncConfig, findOrCreateGist, loadSyncConfig,
  saveSyncConfig, syncOnce, type FetchFn,
} from './gist';

afterEach(() => vi.unstubAllGlobals());

interface Call { url: string; method: string; body?: string; headers: Record<string, string> }

function fake(routes: (c: Call) => { status?: number; body?: unknown } | Error) {
  const calls: Call[] = [];
  const fn: FetchFn = async (url, init) => {
    const c: Call = {
      url, method: init?.method ?? 'GET', body: init?.body as string | undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    };
    calls.push(c);
    const r = routes(c);
    if (r instanceof Error) throw r;
    const status = r.status ?? 200;
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {}), { status });
  };
  return { fn, calls };
}

const gistWith = (content: string) => ({ id: 'g1', files: { [GIST_FILE]: { content } } });
const cfg = { token: 't', gistId: 'g1' };

describe('findOrCreateGist', () => {
  it('var olan gist bulunur, oluşturulmaz', async () => {
    const { fn, calls } = fake((c) =>
      c.method === 'GET'
        ? { body: [{ id: 'x', files: { 'a.txt': {} } }, { id: 'hedef', files: { [GIST_FILE]: {} } }] }
        : { status: 500 });
    expect(await findOrCreateGist('tok', fn)).toBe('hedef');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.github.com/gists?per_page=100&page=1');
    expect(calls[0].headers.Authorization).toBe('Bearer tok');
    expect(calls[0].headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });
  it('yoksa gizli gist oluşturur', async () => {
    const { fn, calls } = fake((c) => (c.method === 'GET' ? { body: [] } : { status: 201, body: { id: 'yeni' } }));
    expect(await findOrCreateGist('tok', fn)).toBe('yeni');
    const post = calls.find((c) => c.method === 'POST')!;
    const sent = JSON.parse(post.body!);
    expect(sent.public).toBe(false);
    expect(sent.description).toBe('Kalıp Öğrenme senkron');
    expect(Object.keys(sent.files)).toEqual([GIST_FILE]);
  });
  it('sayfalama: ilk sayfa doluysa sonrakine bakar', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ id: `n${i}`, files: { 'b.txt': {} } }));
    const { fn, calls } = fake((c) =>
      c.url.endsWith('&page=1')
        ? { body: full }
        : { body: [{ id: 'bulundu', files: { [GIST_FILE]: {} } }] });
    expect(await findOrCreateGist('tok', fn)).toBe('bulundu');
    expect(calls).toHaveLength(2);
  });
});

describe('syncOnce', () => {
  it('birleşik uzaktakinden farklıysa PATCH eder ve birleştirir', async () => {
    const remote = gradePattern(emptyState(), 'p1', 'good', '2026-11-01');
    const local = gradePattern(emptyState(), 'p2', 'good', '2026-11-01');
    const { fn, calls } = fake((c) => (c.method === 'GET' ? { body: gistWith(exportState(remote)) } : { body: {} }));
    const r = await syncOnce(local, cfg, fn);
    expect(r.pushed).toBe(true);
    expect(Object.keys(r.merged.progress).sort()).toEqual(['p1', 'p2']);
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.url).toBe('https://api.github.com/gists/g1');
    const content = JSON.parse(JSON.parse(patch.body!).files[GIST_FILE].content);
    expect(Object.keys(content.progress).sort()).toEqual(['p1', 'p2']);
  });
  it('birleşik uzaktakiyle aynıysa PATCH etmez', async () => {
    const remote = gradePattern(emptyState(), 'p1', 'good', '2026-11-01');
    const { fn, calls } = fake(() => ({ body: gistWith(exportState(remote)) }));
    const r = await syncOnce(structuredClone(remote), cfg, fn);
    expect(r.pushed).toBe(false);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });
  it('dosya yoksa yerel durumu yazar', async () => {
    const local = gradePattern(emptyState(), 'p1', 'good', '2026-11-01');
    const { fn, calls } = fake((c) => (c.method === 'GET' ? { body: { id: 'g1', files: {} } } : { body: {} }));
    const r = await syncOnce(local, cfg, fn);
    expect(r.pushed).toBe(true);
    expect(calls.some((c) => c.method === 'PATCH')).toBe(true);
  });
  it('truncated ise raw_url okunur (anahtarsız)', async () => {
    const remote = gradePattern(emptyState(), 'p1', 'good', '2026-11-01');
    const { fn, calls } = fake((c) =>
      c.url.startsWith('https://raw.example/')
        ? { body: exportState(remote) }
        : { body: { id: 'g1', files: { [GIST_FILE]: { truncated: true, raw_url: 'https://raw.example/x', content: '{' } } } });
    const r = await syncOnce(structuredClone(remote), cfg, fn);
    expect(r.pushed).toBe(false);
    expect(calls[1].headers.Authorization).toBeUndefined();
  });
  it('401: auth hatası', async () => {
    const { fn } = fake(() => ({ status: 401, body: { message: 'Bad credentials' } }));
    const err = await syncOnce(emptyState(), cfg, fn).catch((e) => e);
    expect(err).toBeInstanceOf(SyncError);
    expect(err.kind).toBe('auth');
  });
  it('ağ yok: offline hatası', async () => {
    const { fn } = fake(() => new TypeError('Failed to fetch'));
    const err = await syncOnce(emptyState(), cfg, fn).catch((e) => e);
    expect(err.kind).toBe('offline');
  });
  it('uzaktaki JSON bozuksa PATCH yok, other hatası', async () => {
    const { fn, calls } = fake(() => ({ body: gistWith('{bozuk') }));
    const err = await syncOnce(emptyState(), cfg, fn).catch((e) => e);
    expect(err).toBeInstanceOf(SyncError);
    expect(err.kind).toBe('other');
    expect(calls.some((c) => c.method !== 'GET')).toBe(false);
  });
});

describe('eşitleme ayarı', () => {
  it('kaydet / oku / sil; localStorage yokken hata yok', () => {
    expect(loadSyncConfig()).toBeNull();
    expect(saveSyncConfig({ token: 't', gistId: 'g' })).toBe(false);
    expect(() => clearSyncConfig()).not.toThrow();
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => { m.set(k, v); },
      removeItem: (k: string) => { m.delete(k); },
    });
    expect(saveSyncConfig({ token: 't', gistId: 'g', lastSync: 'z' })).toBe(true);
    expect(loadSyncConfig()).toEqual({ token: 't', gistId: 'g', lastSync: 'z' });
    m.set(SYNC_KEY, '{bozuk');
    expect(loadSyncConfig()).toBeNull();
    clearSyncConfig();
    expect(m.has(SYNC_KEY)).toBe(false);
  });
});

describe('yakınsama: iki cihaz', () => {
  it('B planlar, birleşir, tekrar planlar; ek PATCH yok; iki cihaz aynı ilerlemede', async () => {
    const T = '2026-11-15';
    const Y = '2026-11-14';
    const pats = mkPatterns('A1', 20);
    const norm = (s: AppState) => planDay(s, pats, T).state;
    let content = '';
    let patches = 0;
    const gist: FetchFn = async (_url, init) => {
      if (init?.method === 'PATCH') {
        patches++;
        content = JSON.parse(init.body as string).files[GIST_FILE].content;
        return new Response('{}');
      }
      return new Response(JSON.stringify(content ? gistWith(content) : { id: 'g1', files: {} }));
    };

    let a = emptyState();
    for (const id of ['a1-1', 'a1-2', 'a1-3']) a = gradePattern(a, id, 'good', Y);
    let b = norm(emptyState());
    expect(b.days[T].newIds).toEqual(['a1-1', 'a1-2', 'a1-3']);

    // A önce itti (bugün için kaydı yok: uygulama henüz bugünü planlamamış)
    a = (await syncOnce(a, cfg, gist)).merged;
    expect(a.days[T]).toBeUndefined();
    // B: eşitle, planla, tekrar eşitle
    const r1 = await syncOnce(b, cfg, gist, norm);
    b = norm(r1.merged);
    expect(b.days[T].newIds).toEqual(['a1-4', 'a1-5', 'a1-6']);
    const before = patches;
    const r2 = await syncOnce(b, cfg, gist, norm);
    expect(r2.pushed).toBe(false);
    expect(patches).toBe(before);
    b = norm(r2.merged);

    // A: eşitle, planla, tekrar eşitle
    a = norm((await syncOnce(a, cfg, gist, norm)).merged);
    const r3 = await syncOnce(a, cfg, gist, norm);
    expect(r3.pushed).toBe(false);
    expect(a.progress).toEqual(b.progress);
    expect(a.days[T].newIds).toEqual(['a1-4', 'a1-5', 'a1-6']);
  });
});
