import { canSpeak, speak } from './speech';

// Dinle / Yavaş dinle düğmeleri. Tarayıcı sesli okumayı desteklemiyorsa hiçbir şey çizmez.
export function SpeakButtons({ text }: { text: string }) {
  if (!canSpeak()) return null;
  return (
    <span className="speak">
      <button type="button" className="icon-btn speak-btn" aria-label="Dinle" onClick={() => speak(text)}>
        <span aria-hidden="true">🔊</span>
      </button>
      <button type="button" className="icon-btn speak-btn" aria-label="Yavaş dinle" onClick={() => speak(text, { slow: true })}>
        <span aria-hidden="true">🐢</span>
      </button>
    </span>
  );
}
