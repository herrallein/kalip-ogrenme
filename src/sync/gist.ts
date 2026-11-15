import { mergeStates, sameState } from '../core/merge';
import { emptyState } from '../core/scheduler';
import { exportState, importState } from '../core/storage';
import type { AppState } from '../core/types';

export const API = 'https://api.github.com';
export const GIST_FILE = 'kalip-ogrenme.json';
export const GIST_DESC = 'Kalıp Öğrenme senkron';
export const SYNC_KEY = 'kalip-ogrenme:sync';

export type SyncErrorKind = 'auth' | 'offline' | 'other';
export class SyncError extends Error {
  kind: SyncErrorKind;
  constructor(kind: SyncErrorKind, message: string) {
    super(message);
    this.name = 'SyncError';
    this.kind = kind;
  }
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
const defaultFetch: FetchFn = (url, init) => fetch(url, init);

export interface SyncConfig { token: string; gistId: string; lastSync?: string }

// --- Yerel yapılandırma (asla hata fırlatmaz) ---
function store(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
export function loadSyncConfig(): SyncConfig | null {
  try {
    const t = store()?.getItem(SYNC_KEY);
    if (!t) return null;
    const c = JSON.parse(t) as Partial<SyncConfig> | null;
    if (!c || typeof c.token !== 'string' || !c.token || typeof c.gistId !== 'string' || !c.gistId) return null;
    return { token: c.token, gistId: c.gistId, lastSync: typeof c.lastSync === 'string' ? c.lastSync : undefined };
  } catch { return null; }
}
export function saveSyncConfig(c: SyncConfig): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(SYNC_KEY, JSON.stringify(c));
    return true;
  } catch { return false; }
}
export function clearSyncConfig(): void {
  try { store()?.removeItem(SYNC_KEY); } catch { /* yok say */ }
}

// --- HTTP ---
function headers(token: string, json = false): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function call(fetchFn: FetchFn, url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetchFn(url, { ...init, cache: 'no-store' });
  } catch (e) {
    if (e instanceof TypeError) throw new SyncError('offline', 'Çevrimdışı, sonra denenecek.');
    throw new SyncError('other', 'Eşitleme isteği başarısız oldu.');
  }
  if (res.status === 401 || res.status === 403) {
    throw new SyncError('auth', 'Anahtar geçersiz veya gist izni yok.');
  }
  if (!res.ok) throw new SyncError('other', `GitHub beklenmedik cevap verdi (${res.status}).`);
  return res;
}

async function json<T>(res: Response): Promise<T> {
  try { return (await res.json()) as T; } catch { throw new SyncError('other', 'GitHub cevabı okunamadı.'); }
}

interface GistFile { filename?: string; content?: string; truncated?: boolean; raw_url?: string }
interface GistInfo { id: string; files?: Record<string, GistFile | null> }

export async function findOrCreateGist(
  token: string, fetchFn: FetchFn = defaultFetch, initial: AppState = emptyState(),
): Promise<string> {
  for (let page = 1; page <= 10; page++) {
    const res = await call(fetchFn, `${API}/gists?per_page=100&page=${page}`, { headers: headers(token) });
    const list = await json<GistInfo[]>(res);
    if (!Array.isArray(list)) throw new SyncError('other', 'GitHub cevabı beklenen biçimde değil.');
    const hit = list.find((g) => g?.files && g.files[GIST_FILE]);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  const res = await call(fetchFn, `${API}/gists`, {
    method: 'POST',
    headers: headers(token, true),
    body: JSON.stringify({
      description: GIST_DESC,
      public: false,
      files: { [GIST_FILE]: { content: exportState(initial) } },
    }),
  });
  const created = await json<GistInfo>(res);
  if (!created?.id) throw new SyncError('other', 'Gist oluşturuldu ama kimliği okunamadı.');
  return created.id;
}

export async function readRemote(
  token: string, gistId: string, fetchFn: FetchFn = defaultFetch,
): Promise<AppState | null> {
  const res = await call(fetchFn, `${API}/gists/${encodeURIComponent(gistId)}`, { headers: headers(token) });
  const info = await json<GistInfo>(res);
  const file = info?.files?.[GIST_FILE];
  if (!file) return null;
  let text = file.content;
  if (file.truncated && file.raw_url) {
    // Ham adres başka bir sunucuda; anahtar gönderilmez.
    const raw = await call(fetchFn, file.raw_url, {});
    text = await raw.text();
  }
  if (typeof text !== 'string' || text.trim() === '') return null;
  try {
    return importState(text);
  } catch (e) {
    const why = e instanceof Error ? e.message : '';
    throw new SyncError('other', `Gist'teki veri okunamadı, üzerine yazılmadı. ${why}`.trim());
  }
}

export async function writeRemote(
  token: string, gistId: string, state: AppState, fetchFn: FetchFn = defaultFetch,
): Promise<void> {
  await call(fetchFn, `${API}/gists/${encodeURIComponent(gistId)}`, {
    method: 'PATCH',
    headers: headers(token, true),
    body: JSON.stringify({ files: { [GIST_FILE]: { content: exportState(state) } } }),
  });
}

// normalize: birleşik durumu uygulamanın oturacağı biçime getirir (ör. planDay). Böylece itilen ve
// yerelde kalan durum aynıdır; birleştirme ile planlama arasındaki ince farklar döngü yaratmaz.
export async function syncOnce(
  local: AppState, cfg: Pick<SyncConfig, 'token' | 'gistId'>, fetchFn: FetchFn = defaultFetch,
  normalize: (s: AppState) => AppState = (s) => s,
): Promise<{ merged: AppState; pushed: boolean }> {
  const remote = await readRemote(cfg.token, cfg.gistId, fetchFn);
  const merged = normalize(remote ? mergeStates(local, remote) : structuredClone(local));
  const needsPush = !remote || !sameState(merged, remote);
  if (needsPush) await writeRemote(cfg.token, cfg.gistId, merged, fetchFn);
  return { merged, pushed: needsPush };
}
