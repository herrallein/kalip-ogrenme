import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeStates, sameState } from '../core/merge';
import type { AppState } from '../core/types';
import {
  SyncError, clearSyncConfig, findOrCreateGist, loadSyncConfig, saveSyncConfig, syncOnce,
  type SyncConfig,
} from './gist';

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'ok'; at: string }
  | { kind: 'error'; message: string; errKind: 'auth' | 'offline' | 'other' };

export interface SyncApi {
  connected: boolean;
  status: SyncStatus;
  connect: (token: string) => Promise<{ ok: boolean; message?: string }>;
  syncNow: () => void;
  disconnect: () => void;
}

const DEBOUNCE_MS = 2000;

export function useSync(
  state: AppState, setState: (s: AppState) => void,
  normalize?: (s: AppState) => AppState,
): SyncApi {
  const [cfg, setCfg] = useState<SyncConfig | null>(() => loadSyncConfig());
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' });

  const cfgRef = useRef(cfg);
  const stateRef = useRef(state);
  const syncingRef = useRef(false);
  const pendingRef = useRef(false);
  const lastSyncedRef = useRef<AppState | null>(null);
  stateRef.current = state;
  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;

  const runSync = useCallback(async () => {
    const c = cfgRef.current;
    if (!c) return;
    if (syncingRef.current) { pendingRef.current = true; return; }
    syncingRef.current = true;
    setStatus({ kind: 'syncing' });
    try {
      const snapshot = stateRef.current;
      const { merged } = await syncOnce(snapshot, c, undefined, normalizeRef.current);
      if (cfgRef.current !== c) return; // bağlantı bu arada kesildi/değişti
      // Eşitleme sürerken durum değişmiş olabilir: yeni durumla tekrar birleştir.
      const current = stateRef.current;
      const changedDuring = current !== snapshot;
      const final = changedDuring ? (normalizeRef.current ?? ((x: AppState) => x))(mergeStates(current, merged)) : merged;
      if (!sameState(final, current)) {
        stateRef.current = final;
        setState(final);
      }
      lastSyncedRef.current = changedDuring ? merged : final;
      const at = new Date().toISOString();
      saveSyncConfig({ ...c, lastSync: at });
      setStatus({ kind: 'ok', at });
    } catch (e) {
      if (cfgRef.current !== c) return;
      if (e instanceof SyncError) setStatus({ kind: 'error', message: e.message, errKind: e.kind });
      else setStatus({ kind: 'error', message: 'Eşitleme başarısız oldu.', errKind: 'other' });
    } finally {
      syncingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void runSync();
      }
    }
  }, [setState]);

  // Açılışta bir kez, ayar bağlanınca da.
  useEffect(() => {
    cfgRef.current = cfg;
    lastSyncedRef.current = null;
    if (cfg) void runSync();
    else setStatus({ kind: 'idle' });
  }, [cfg, runSync]);

  // Sayfa görünür olunca.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runSync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [runSync]);

  // Yerel değişiklikten 2 sn sonra; son eşitlenen durumla aynıysa tetiklenmez (döngü yok).
  useEffect(() => {
    if (!cfg) return;
    const t = setTimeout(() => {
      const last = lastSyncedRef.current;
      if (last && sameState(stateRef.current, last)) return;
      void runSync();
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state, cfg, runSync]);

  const connect = useCallback(async (token: string) => {
    const t = token.trim();
    if (!t) return { ok: false, message: 'Önce GitHub anahtarını yapıştır.' };
    try {
      const gistId = await findOrCreateGist(t, undefined, stateRef.current);
      const next: SyncConfig = { token: t, gistId };
      if (!saveSyncConfig(next)) {
        return { ok: false, message: 'Bağlantı bu tarayıcıda saklanamadı (depolama kapalı olabilir).' };
      }
      setCfg(next);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Bağlanılamadı.' };
    }
  }, []);

  const disconnect = useCallback(() => {
    clearSyncConfig();
    cfgRef.current = null;
    lastSyncedRef.current = null;
    setCfg(null);
  }, []);

  const syncNow = useCallback(() => { void runSync(); }, [runSync]);

  return { connected: cfg !== null, status, connect, syncNow, disconnect };
}
