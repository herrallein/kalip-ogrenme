import { useEffect, useRef, useState } from 'react';
import { canSpeak, speak } from './speech';
import { canRecord, createRecorder, MAX_RECORD_MS, type Recorder, type RecorderError } from './recorder';

// Gölgeleme: dinle, kaydet, kendi sesini dinle, karşılaştır. Kayıt yalnız bellekte, kart değişince atılır.
// Mikrofon izni yalnız kaydet düğmesine dokununca istenir (iOS dokunuş ister).
export function Shadowing({ text }: { text: string }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<RecorderError | null>(null);
  const recRef = useRef<Recorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const compareToken = useRef(0);

  const stopPlayback = () => {
    compareToken.current += 1; // bekleyen "TTS bitince kaydı çal" işlemini geçersiz kılar
    try { audioRef.current?.pause(); } catch { /* yoksay */ }
    try { globalThis.speechSynthesis?.cancel(); } catch { /* yoksay */ }
  };

  // Cümle değişince ya da bileşen kapanınca (StrictMode çift çalıştırması dahil) her şeyi bırak ve sıfırla.
  useEffect(() => {
    const rec = createRecorder({
      onFinish: (r) => {
        setRecording(false);
        if (r.ok) { setUrl(r.url); setErr(null); } else setErr(r.error === 'denied' ? 'denied' : 'error');
      },
    });
    recRef.current = rec;
    setRecording(false);
    setUrl(null);
    setErr(null);
    return () => {
      rec.dispose();
      if (recRef.current === rec) recRef.current = null;
      stopPlayback();
      const a = audioRef.current;
      if (a) { try { a.removeAttribute('src'); a.load(); } catch { /* yoksay */ } }
    };
  }, [text]);

  // Geçen süre göstergesi.
  useEffect(() => {
    if (!recording) return;
    setSeconds(0);
    const t0 = Date.now();
    const id = setInterval(
      () => setSeconds(Math.min(Math.floor((Date.now() - t0) / 1000), MAX_RECORD_MS / 1000)),
      250,
    );
    return () => clearInterval(id);
  }, [recording]);

  if (!canRecord()) return null;

  const play = () => {
    if (!url) return;
    try {
      const a = audioRef.current ?? (audioRef.current = new Audio());
      if (a.getAttribute('src') !== url) a.src = url;
      a.currentTime = 0;
      void a.play().catch(() => setErr('error'));
    } catch {
      setErr('error');
    }
  };

  const toggleRecord = async () => {
    const rec = recRef.current;
    if (!rec) return;
    if (recording) { rec.stop(); return; }
    stopPlayback();
    setErr(null);
    const e = await rec.start();
    if (e) setErr(e); else if (recRef.current === rec) setRecording(true);
  };

  // Önce TTS, bitince kaydın (speak'in onEnd geri çağrısı; araya girilirse jeton eskir, çalmaz).
  const compare = () => {
    if (!url) return;
    stopPlayback();
    if (!canSpeak()) { play(); return; }
    const token = compareToken.current;
    speak(text, { onEnd: () => { if (compareToken.current === token) play(); } });
  };

  return (
    <div className="shadow">
      <div className="shadow-row">
        {canSpeak() && (
          <button type="button" className="shadow-btn" disabled={recording} onClick={() => { stopPlayback(); speak(text); }}>
            <span aria-hidden="true">🔊</span> Dinle
          </button>
        )}
        <button type="button" className={`shadow-btn${recording ? ' rec' : ''}`} onClick={toggleRecord}>
          <span aria-hidden="true">{recording ? '⏹' : '🎙️'}</span> {recording ? 'Durdur' : 'Kaydet'}
        </button>
        <button type="button" className="shadow-btn" disabled={!url || recording} onClick={() => { stopPlayback(); play(); }}>
          <span aria-hidden="true">▶️</span> Sesimi dinle
        </button>
        <button type="button" className="shadow-btn" disabled={!url || recording} onClick={compare}>
          <span aria-hidden="true">🔁</span> Karşılaştır
        </button>
      </div>
      {recording && (
        <div className="shadow-rec" role="status">
          <span className="shadow-dot" aria-hidden="true" /> Kayıt: {seconds} / {MAX_RECORD_MS / 1000} sn
        </div>
      )}
      {err === 'denied' && (
        <div className="shadow-hint" role="alert">Mikrofon izni kapalı: Ayarlar &gt; Safari/uygulama izinleri</div>
      )}
      {err === 'error' && <div className="shadow-hint" role="alert">Kayıt başarısız oldu, tekrar dene.</div>}
    </div>
  );
}
