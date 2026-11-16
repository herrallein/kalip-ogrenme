import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecorder, mapError, pickMimeType, canRecord, type RecorderResult } from './recorder';

class FakeMR {
  static supported: string[] = [];
  static last: FakeMR | undefined;
  static isTypeSupported(m: string) { return FakeMR.supported.includes(m); }
  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public stream: unknown, public opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? '';
    FakeMR.last = this;
  }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['abc']) });
    this.onstop?.();
  }
}

function track() { return { stop: vi.fn() }; }
function stubEnv(opts: { gum?: () => Promise<unknown>; supported?: string[] } = {}) {
  const tracks = [track(), track()];
  FakeMR.supported = opts.supported ?? [];
  const gum = vi.fn(opts.gum ?? (async () => ({ getTracks: () => tracks })));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: gum } });
  vi.stubGlobal('MediaRecorder', FakeMR);
  let n = 0;
  const create = vi.fn(() => `blob:test-${++n}`);
  const revoke = vi.fn();
  vi.stubGlobal('URL', Object.assign(function () {}, { createObjectURL: create, revokeObjectURL: revoke }));
  return { tracks, gum, create, revoke };
}

beforeEach(() => { vi.useFakeTimers(); FakeMR.last = undefined; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('pickMimeType', () => {
  it('iOS: audio/mp4 öncelikli', () => {
    stubEnv({ supported: ['audio/mp4', 'audio/webm'] });
    expect(pickMimeType()).toBe('audio/mp4');
  });
  it('Chrome: webm opus', () => {
    stubEnv({ supported: ['audio/webm;codecs=opus', 'audio/webm'] });
    expect(pickMimeType()).toBe('audio/webm;codecs=opus');
  });
  it('hiçbiri yoksa undefined', () => {
    stubEnv({ supported: [] });
    expect(pickMimeType()).toBeUndefined();
  });
});

describe('mapError', () => {
  it('izin hataları denied, diğerleri error', () => {
    expect(mapError({ name: 'NotAllowedError' })).toBe('denied');
    expect(mapError({ name: 'SecurityError' })).toBe('denied');
    expect(mapError({ name: 'NotFoundError' })).toBe('error');
    expect(mapError(null)).toBe('error');
  });
});

describe('createRecorder', () => {
  it('destek yoksa unsupported, fırlatmaz', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('MediaRecorder', undefined);
    expect(canRecord()).toBe(false);
    expect(await createRecorder().start()).toBe('unsupported');
  });

  it('izin reddi denied; başka hata error', async () => {
    stubEnv({ gum: async () => { throw { name: 'NotAllowedError' }; } });
    expect(await createRecorder().start()).toBe('denied');
    stubEnv({ gum: async () => { throw new Error('x'); } });
    expect(await createRecorder().start()).toBe('error');
  });

  it('seçilen mimeType MediaRecorder a verilir', async () => {
    stubEnv({ supported: ['audio/mp4'] });
    await createRecorder().start();
    expect(FakeMR.last?.opts).toEqual({ mimeType: 'audio/mp4' });
  });

  it('elle durdurma: URL döner ve mikrofon bırakılır', async () => {
    const env = stubEnv({ supported: ['audio/mp4'] });
    const results: RecorderResult[] = [];
    const r = createRecorder({ onFinish: (x) => results.push(x) });
    expect(await r.start()).toBeNull();
    expect(r.recording).toBe(true);
    r.stop();
    expect(results).toEqual([{ ok: true, url: 'blob:test-1' }]);
    expect(r.recording).toBe(false);
    env.tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
  });

  it('10 sn sonra otomatik durur', async () => {
    const env = stubEnv();
    const results: RecorderResult[] = [];
    const r = createRecorder({ onFinish: (x) => results.push(x) });
    await r.start();
    vi.advanceTimersByTime(9_999);
    expect(results).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(true);
    env.tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
  });

  it('yeni kayıt eski URL yi iptal eder', async () => {
    const env = stubEnv();
    const r = createRecorder();
    await r.start(); r.stop();
    await r.start(); r.stop();
    expect(env.revoke).toHaveBeenCalledWith('blob:test-1');
  });

  it('dispose: kaydı durdurur, mikrofonu bırakır, onFinish çağrılmaz', async () => {
    const env = stubEnv();
    const onFinish = vi.fn();
    const r = createRecorder({ onFinish });
    await r.start();
    r.dispose();
    env.tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
    vi.advanceTimersByTime(20_000);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('dispose son URL yi iptal eder', async () => {
    const env = stubEnv();
    const r = createRecorder();
    await r.start(); r.stop();
    r.dispose();
    expect(env.revoke).toHaveBeenCalledWith('blob:test-1');
  });

  it('izin penceresi açıkken dispose: gelen akış hemen bırakılır', async () => {
    let resolve!: (s: unknown) => void;
    const tracks = [track()];
    stubEnv({ gum: () => new Promise((res) => { resolve = res; }) });
    const r = createRecorder();
    const p = r.start();
    r.dispose();
    resolve({ getTracks: () => tracks });
    expect(await p).toBe('error');
    expect(tracks[0]!.stop).toHaveBeenCalled();
    expect(FakeMR.last).toBeUndefined();
  });

  it('boş kayıt error döner', async () => {
    stubEnv();
    const results: RecorderResult[] = [];
    const r = createRecorder({ onFinish: (x) => results.push(x) });
    await r.start();
    FakeMR.last!.stop = function (this: FakeMR) { this.state = 'inactive'; this.onstop?.(); };
    r.stop();
    expect(results[0]).toEqual({ ok: false, error: 'error' });
  });

  it('MediaRecorder yapıcısı fırlatırsa error ve mikrofon bırakılır', async () => {
    const env = stubEnv();
    vi.stubGlobal('MediaRecorder', class { static isTypeSupported() { return false; } constructor() { throw new Error('boom'); } });
    expect(await createRecorder().start()).toBe('error');
    env.tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
  });
});
