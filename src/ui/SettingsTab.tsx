import { useRef, useState } from 'react';
import { DEFAULT_SETTINGS, emptyState } from '../core/scheduler';
import { exportState, importState } from '../core/storage';
import type { AppState, Settings } from '../core/types';

interface Props { state: AppState; setState: (s: AppState) => void; today: string }

export function SettingsTab({ state, setState, today }: Props) {
  const s = state.settings;
  const [draft, setDraft] = useState({
    newPerDay: String(s.newPerDay),
    learningCap: String(s.learningCap),
    easyStreakToGraduate: String(s.easyStreakToGraduate),
    reviewIntervals: s.reviewIntervals.join(', '),
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const syncDraft = (v: Settings) => setDraft({
    newPerDay: String(v.newPerDay),
    learningCap: String(v.learningCap),
    easyStreakToGraduate: String(v.easyStreakToGraduate),
    reviewIntervals: v.reviewIntervals.join(', '),
  });

  const save = () => {
    const toInt = (t: string, min: number) => {
      const n = Number(t);
      return t.trim() !== '' && Number.isInteger(n) && n >= min ? n : null;
    };
    const newPerDay = toInt(draft.newPerDay, 0);
    const learningCap = toInt(draft.learningCap, 0);
    const easy = toInt(draft.easyStreakToGraduate, 1);
    const parts = draft.reviewIntervals.split(/[,\s]+/).filter(Boolean);
    const intervals = parts.map((x) => toInt(x, 1));
    if (newPerDay === null) return setMsg({ ok: false, text: 'Günlük yeni kalıp 0 veya daha büyük bir tam sayı olmalı.' });
    if (learningCap === null) return setMsg({ ok: false, text: 'Öğrenme sınırı 0 veya daha büyük bir tam sayı olmalı.' });
    if (easy === null) return setMsg({ ok: false, text: 'Mezuniyet için "kolay" sayısı en az 1 olmalı.' });
    if (intervals.length === 0 || intervals.some((x) => x === null)) {
      return setMsg({ ok: false, text: 'Aralıklar virgülle ayrılmış pozitif tam sayılar olmalı (ör. 3, 7, 21).' });
    }
    const next: Settings = {
      newPerDay, learningCap, easyStreakToGraduate: easy, reviewIntervals: intervals as number[],
    };
    setState({ ...state, settings: next });
    setMsg({ ok: true, text: 'Kaydedildi.' });
  };

  const resetDefaults = () => {
    const d = { ...DEFAULT_SETTINGS, reviewIntervals: [...DEFAULT_SETTINGS.reviewIntervals] };
    setState({ ...state, settings: d });
    syncDraft(d);
    setMsg({ ok: true, text: 'Varsayılan ayarlar geri yüklendi.' });
  };

  const doExport = () => {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kalip-ogrenme-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupMsg({ ok: true, text: 'Yedek dosyası indirildi.' });
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = importState(await file.text());
      if (!window.confirm('Mevcut ilerlemenin üzerine yazılacak. İçe aktarılsın mı?')) {
        setBackupMsg({ ok: false, text: 'İçe aktarma iptal edildi.' });
        return;
      }
      setState(imported);
      syncDraft(imported.settings);
      setBackupMsg({ ok: true, text: 'Yedek içe aktarıldı.' });
    } catch (e) {
      setBackupMsg({ ok: false, text: e instanceof Error ? e.message : 'İçe aktarma başarısız.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doReset = () => {
    const fresh = emptyState();
    fresh.settings = state.settings;
    setState(fresh);
    setConfirmReset(false);
    setBackupMsg({ ok: true, text: 'Tüm ilerleme sıfırlandı.' });
  };

  const field = (key: keyof typeof draft, label: string, hint: string, numeric = true) => (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        inputMode={numeric ? 'numeric' : 'text'}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
      <span className="muted small">{hint}</span>
    </label>
  );

  return (
    <section>
      <h1>Ayarlar</h1>
      {field('newPerDay', 'Günlük yeni kalıp', 'Her gün en çok kaç yeni kalıp gösterilsin.')}
      {field('learningCap', 'Öğrenme sınırı', 'Aynı anda öğrenilen kalıp bu sayıya ulaşınca yeni kalıp azalır.')}
      {field('easyStreakToGraduate', 'Kalıcılık için art arda "kolay"', 'Bu kadar art arda kolay not alan kalıp kalıcılığa geçer.')}
      {field('reviewIntervals', 'Tekrar aralıkları (gün)', 'Virgülle ayır, ör. 3, 7, 21, 60, 120.', false)}
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={save}>Kaydet</button>
        <button type="button" className="btn" onClick={resetDefaults}>Varsayılana dön</button>
      </div>
      {msg && <p role="status" className={msg.ok ? 'msg ok' : 'msg err'}>{msg.text}</p>}

      <h2>Yedek</h2>
      <div className="btn-row">
        <button type="button" className="btn" onClick={doExport}>Dışa aktar</button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>İçe aktar</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden-input"
          onChange={(e) => void doImport(e.target.files?.[0])}
        />
      </div>
      {backupMsg && <p role="status" className={backupMsg.ok ? 'msg ok' : 'msg err'}>{backupMsg.text}</p>}

      <h2>Tehlikeli bölge</h2>
      {!confirmReset ? (
        <button type="button" className="btn danger" onClick={() => setConfirmReset(true)}>
          Tüm ilerlemeyi sıfırla
        </button>
      ) : (
        <div className="confirm">
          <p>Tüm ilerleme, geçmiş ve kendi cümlelerin silinecek. Bu geri alınamaz. Emin misin?</p>
          <div className="btn-row">
            <button type="button" className="btn danger" onClick={doReset}>Evet, sıfırla</button>
            <button type="button" className="btn" onClick={() => setConfirmReset(false)}>Vazgeç</button>
          </div>
        </div>
      )}
    </section>
  );
}
