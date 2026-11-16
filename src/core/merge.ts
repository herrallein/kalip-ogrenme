import { applyGrade } from './scheduler';
import type { AppState, Progress, SyncMeta } from './types';

const EMPTY_META: SyncMeta = { epoch: '', resetAt: '', settingsAt: '', orderAt: '' };
const metaOf = (s: AppState): SyncMeta => ({ ...EMPTY_META, ...s.meta });

// Sıra duyarsız derin eşitlik (JSON benzeri değerler için).
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  const oa = a as Record<string, unknown>;
  const ob = b as Record<string, unknown>;
  const ka = Object.keys(oa).filter((k) => oa[k] !== undefined);
  const kb = Object.keys(ob).filter((k) => ob[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(oa[k], ob[k]));
}

export const sameState = (a: AppState, b: AppState): boolean => deepEqual(a, b);

// Sıfırlama/içe aktarma: yeni epoch, diğer cihazlarda bu durumun kazanmasını sağlar.
export function newEpochId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function withNewEpoch(s: AppState, now: Date = new Date()): AppState {
  const m = metaOf(s);
  return { ...s, meta: { ...m, epoch: newEpochId(), resetAt: now.toISOString() } };
}

const byDateAsc = (x: { date: string }, y: { date: string }) =>
  (x.date < y.date ? -1 : x.date > y.date ? 1 : 0);
const keyOfHistory = (h: Progress['history']) => h.map((e) => `${e.date}|${e.grade}`).join(',');

function mergeProgress(a: Progress, b: Progress, settings: AppState['settings']): Progress {
  // Gün başına tek kayıt; çakışmada yerel (a) kazanır.
  const byDate = new Map<string, Progress['history'][number]>();
  for (const e of a.history) if (!byDate.has(e.date)) byDate.set(e.date, e);
  for (const e of b.history) if (!byDate.has(e.date)) byDate.set(e.date, e);
  const history = [...byDate.values()].sort(byDateAsc);

  const seen = new Set<string>();
  const sentences: Progress['sentences'] = [];
  for (const s of [...a.sentences, ...b.sentences]) {
    const k = `${s.date}\u0000${s.text}`;
    if (!seen.has(k)) { seen.add(k); sentences.push(s); }
  }
  sentences.sort(byDateAsc);

  const introduced = a.introduced <= b.introduced ? a.introduced : b.introduced;
  const hk = keyOfHistory(history);

  let base: Progress;
  if (hk === keyOfHistory(a.history)) base = structuredClone(a);
  else if (hk === keyOfHistory(b.history)) base = structuredClone(b);
  else {
    base = {
      id: a.id, phase: 'learning', introduced, easyStreak: 0, step: 0,
      due: history[0].date, seen: 0, lapses: 0, history: [], sentences: [],
    };
    for (const e of history) base = applyGrade(base, e.grade, e.date, settings);
  }
  base.sentences = sentences.map((s) => ({ ...s }));
  base.introduced = introduced;
  return base;
}

// 'Görsel anlatmıyor' işaretleri: her kalıpta en yeni işlem (işaretle / geri al) kazanır.
// Geri alma flagsCleared'a yazılır; böylece bir cihazdaki geri alma diğerindeki eski işareti siler.
function mergeFlags(a: AppState, b: AppState): { flags?: Record<string, string>; flagsCleared?: Record<string, string> } {
  const latest = (x?: Record<string, string>, y?: Record<string, string>) => {
    const o: Record<string, string> = {};
    for (const src of [x, y]) {
      for (const [id, at] of Object.entries(src ?? {})) if (!(id in o) || at > o[id]) o[id] = at;
    }
    return o;
  };
  const set = latest(a.flags, b.flags);
  const cleared = latest(a.flagsCleared, b.flagsCleared);
  const flags: Record<string, string> = {};
  const flagsCleared: Record<string, string> = {};
  for (const id of new Set([...Object.keys(set), ...Object.keys(cleared)])) {
    if (id in set && (!(id in cleared) || set[id] > cleared[id])) flags[id] = set[id];
    else flagsCleared[id] = cleared[id];
  }
  return {
    flags: Object.keys(flags).length ? flags : undefined,
    flagsCleared: Object.keys(flagsCleared).length ? flagsCleared : undefined,
  };
}

export function mergeStates(local: AppState, remote: AppState): AppState {
  const lm = metaOf(local);
  const rm = metaOf(remote);

  if (lm.epoch !== rm.epoch) {
    const remoteWins = rm.resetAt > lm.resetAt || (rm.resetAt === lm.resetAt && rm.epoch > lm.epoch);
    return structuredClone(remoteWins ? remote : local);
  }

  const settingsWin = rm.settingsAt > lm.settingsAt ? remote : local;
  const orderWin = rm.orderAt > lm.orderAt ? remote : local;
  const settings = structuredClone(settingsWin.settings);

  const progress: AppState['progress'] = {};
  for (const id of new Set([...Object.keys(local.progress), ...Object.keys(remote.progress)])) {
    const a = local.progress[id];
    const b = remote.progress[id];
    progress[id] = a && b ? mergeProgress(a, b, settings) : structuredClone((a ?? b)!);
  }

  const days: AppState['days'] = {};
  for (const d of new Set([...Object.keys(local.days), ...Object.keys(remote.days)])) {
    const a = local.days[d];
    const b = remote.days[d];
    days[d] = {
      newIds: [...new Set([...(a?.newIds ?? []), ...(b?.newIds ?? [])])],
      done: [...new Set([...(a?.done ?? []), ...(b?.done ?? [])])],
    };
  }

  const out: AppState = { version: 1, settings, progress, days, order: [...orderWin.order] };
  const fl = mergeFlags(local, remote);
  if (fl.flags) out.flags = fl.flags;
  if (fl.flagsCleared) out.flagsCleared = fl.flagsCleared;
  if (local.meta || remote.meta) {
    out.meta = {
      epoch: lm.epoch,
      resetAt: lm.resetAt > rm.resetAt ? lm.resetAt : rm.resetAt,
      settingsAt: lm.settingsAt > rm.settingsAt ? lm.settingsAt : rm.settingsAt,
      orderAt: lm.orderAt > rm.orderAt ? lm.orderAt : rm.orderAt,
    };
  }
  return out;
}

// Ayar veya sıralama değiştiyse ilgili zaman damgasını basar (setState sarmalayıcısı için).
export function stampChanges(prev: AppState, next: AppState, now: Date = new Date()): AppState {
  const settingsChanged = !deepEqual(prev.settings, next.settings);
  const orderChanged = !deepEqual(prev.order, next.order);
  if (!settingsChanged && !orderChanged) return next;
  const at = now.toISOString();
  const m = metaOf(next);
  return {
    ...next,
    meta: {
      ...m,
      settingsAt: settingsChanged ? at : m.settingsAt,
      orderAt: orderChanged ? at : m.orderAt,
    },
  };
}
