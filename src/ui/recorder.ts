// Mikrofon kaydı: getUserMedia + MediaRecorder üzerinde ince sarmalayıcı. Hiçbir şey fırlatmaz.
// Kayıt yalnız bellekte (object URL) tutulur; ne saklanır ne de yüklenir.

export type RecorderError = 'unsupported' | 'denied' | 'error';
export type RecorderResult = { ok: true; url: string } | { ok: false; error: RecorderError };

export const MAX_RECORD_MS = 10_000;

// iOS Safari: audio/mp4; Chrome/Brave/Firefox: webm/opus. Hiçbiri yoksa undefined (tarayıcı varsayılanı).
const MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

export function pickMimeType(): string | undefined {
  try {
    const MR = (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
    if (!MR || typeof MR.isTypeSupported !== 'function') return undefined;
    return MIME_CANDIDATES.find((m) => MR.isTypeSupported(m));
  } catch {
    return undefined;
  }
}

export function canRecord(): boolean {
  try {
    const g = globalThis as { MediaRecorder?: unknown; navigator?: Navigator };
    return typeof g.MediaRecorder === 'function'
      && typeof g.navigator?.mediaDevices?.getUserMedia === 'function';
  } catch {
    return false;
  }
}

export function mapError(e: unknown): RecorderError {
  const name = (e as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError'
    ? 'denied'
    : 'error';
}

export interface Recorder {
  /** Kayda başlar (yalnız kullanıcı dokunuşundan çağır). Hata türünü döner, başarıda null. */
  start(): Promise<RecorderError | null>;
  /** Kaydı bitirir; sonuç onFinish ile gelir. */
  stop(): void;
  /** Her şeyi bırakır: kaydı durdurur, mikrofonu serbest bırakır, URL'yi iptal eder. */
  dispose(): void;
  readonly recording: boolean;
}

interface Options {
  maxMs?: number;
  /** Kayıt bittiğinde (elle, otomatik ya da hatayla) bir kez çağrılır. dispose sonrası çağrılmaz. */
  onFinish?: (r: RecorderResult) => void;
}

export function createRecorder(opts: Options = {}): Recorder {
  const maxMs = opts.maxMs ?? MAX_RECORD_MS;
  let stream: MediaStream | undefined;
  let mr: MediaRecorder | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let url: string | undefined;
  let chunks: Blob[] = [];
  let disposed = false;
  let starting = false;
  let recording = false;

  const release = () => {
    if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
    try { stream?.getTracks().forEach((t) => { try { t.stop(); } catch { /* yoksay */ } }); } catch { /* yoksay */ }
    stream = undefined;
  };
  const revoke = () => {
    if (url) { try { URL.revokeObjectURL(url); } catch { /* yoksay */ } url = undefined; }
  };
  const finish = (r: RecorderResult) => {
    recording = false;
    release();
    mr = undefined;
    if (!disposed) { try { opts.onFinish?.(r); } catch { /* yoksay */ } }
  };

  const stop = () => {
    try {
      if (mr && mr.state !== 'inactive') mr.stop(); // onstop -> finish
      else if (recording) finish({ ok: false, error: 'error' });
    } catch {
      finish({ ok: false, error: 'error' });
    }
  };

  return {
    get recording() { return recording; },
    stop,
    dispose() {
      disposed = true;
      const rec = mr;
      if (rec) { rec.ondataavailable = null; rec.onstop = null; rec.onerror = null; }
      try { if (rec && rec.state !== 'inactive') rec.stop(); } catch { /* yoksay */ }
      mr = undefined;
      recording = false;
      release();
      revoke();
    },
    async start() {
      if (disposed || recording || starting) return 'error';
      if (!canRecord()) return 'unsupported';
      starting = true;
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        starting = false;
        return mapError(e);
      }
      starting = false;
      // İzin penceresi açıkken bileşen kapanmış olabilir: mikrofonu hemen bırak.
      if (disposed) {
        try { s.getTracks().forEach((t) => t.stop()); } catch { /* yoksay */ }
        return 'error';
      }
      try {
        stream = s;
        chunks = [];
        const mimeType = pickMimeType();
        const rec = mimeType ? new MediaRecorder(s, { mimeType }) : new MediaRecorder(s);
        mr = rec;
        rec.ondataavailable = (ev: BlobEvent) => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
        rec.onerror = () => finish({ ok: false, error: 'error' });
        rec.onstop = () => {
          const type = rec.mimeType || mimeType || 'audio/mp4';
          const blob = new Blob(chunks, { type });
          chunks = [];
          if (blob.size === 0) { finish({ ok: false, error: 'error' }); return; }
          revoke(); // eski kaydın URL'sini bırak
          try {
            url = URL.createObjectURL(blob);
          } catch {
            finish({ ok: false, error: 'error' });
            return;
          }
          finish({ ok: true, url });
        };
        rec.start();
        recording = true;
        timer = setTimeout(stop, maxMs);
        return null;
      } catch {
        release();
        mr = undefined;
        recording = false;
        return 'error';
      }
    },
  };
}
