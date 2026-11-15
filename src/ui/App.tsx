import { useCallback, useEffect, useState } from 'react';
import { sameState, stampChanges } from '../core/merge';
import { useSync } from '../sync/useSync';
import { todayStr } from '../core/date';
import { planDay } from '../core/scheduler';
import { loadState, saveState } from '../core/storage';
import type { AppState } from '../core/types';
import { patterns } from '../data';
import { TodayTab } from './TodayTab';
import { PatternsTab } from './PatternsTab';
import { ProgressTab } from './ProgressTab';
import { SettingsTab } from './SettingsTab';

type Tab = 'today' | 'patterns' | 'progress' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Bugün' },
  { id: 'patterns', label: 'Kalıplar' },
  { id: 'progress', label: 'İlerleme' },
  { id: 'settings', label: 'Ayarlar' },
];

export function App() {
  const [today, setToday] = useState(() => todayStr());
  const [state, setRawState] = useState<AppState>(() => planDay(loadState(), patterns, todayStr()).state);
  // Kullanıcı değişiklikleri: ayar/sıralama değiştiyse eşitleme zaman damgasını bas.
  const setState = useCallback((next: AppState) => {
    setRawState((prev) => stampChanges(prev, next));
  }, []);
  // Eşitlemeden gelen birleşik durum damgalanmadan uygulanır (damgalar zaten birleştirildi).
  const normalize = useCallback(
    (s: AppState) => planDay(s, patterns, todayStr()).state, []);
  const sync = useSync(state, setRawState, normalize);
  const [tab, setTab] = useState<Tab>('today');

  // Gün kaydı yoksa (gün değişti, içe aktarma, sıfırlama) planla.
  // Eşitleme sonrası mevcut gün kaydı da düzeltilebilir; yalnız sonuç farklıysa uygula (döngü yok).
  useEffect(() => {
    const planned = planDay(state, patterns, today).state;
    if (!sameState(planned, state)) setState(planned);
  }, [state, today]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [tab]);

  useEffect(() => { saveState(state); }, [state]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setToday(todayStr());
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return (
    <div className="app">
      <main className="main">
        {tab === 'today' && <TodayTab state={state} setState={setState} patterns={patterns} today={today} />}
        {tab === 'patterns' && <PatternsTab state={state} setState={setState} patterns={patterns} today={today} />}
        {tab === 'progress' && <ProgressTab state={state} patterns={patterns} today={today} />}
        {tab === 'settings' && <SettingsTab state={state} setState={setState} today={today} sync={sync} />}
      </main>
      <nav className="tabbar" aria-label="Ana gezinme">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tab active' : 'tab'}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
