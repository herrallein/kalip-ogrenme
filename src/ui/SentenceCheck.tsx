import { useEffect, useRef, useState } from 'react';
import { checkGerman, type CheckResult, type Issue } from '../check/languagetool';
import type { Segment } from '../check/diff';
import { toggleFlag, isFlagged } from '../core/flags';
import type { AppState } from '../core/types';

export type LtState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; issues: Issue[] }
  | { status: 'failed'; reason: 'offline' | 'limit' | 'error' };

// Yazılan cümleyi LanguageTool ile denetler; bileşen kapanınca ya da yeniden başlatılınca eski sonuç atılır.
export function useLtCheck(): { state: LtState; run: (text: string) => void; reset: () => void } {
  const [state, setState] = useState<LtState>({ status: 'idle' });
  const token = useRef(0);
  useEffect(() => () => { token.current += 1; }, []);
  const run = (text: string) => {
    const my = ++token.current;
    setState({ status: 'loading' });
    checkGerman(text).then((r: CheckResult) => {
      if (token.current !== my) return;
      setState(r.ok ? { status: 'done', issues: r.issues } : { status: 'failed', reason: r.reason });
    }, () => {
      if (token.current === my) setState({ status: 'failed', reason: 'error' });
    });
  };
  const reset = () => { token.current += 1; setState({ status: 'idle' }); };
  return { state, run, reset };
}

export function IssueList({ text, state }: { text: string; state: LtState }) {
  if (state.status === 'idle') return null;
  if (state.status === 'loading') return <p className="lt-note" role="status">Denetleniyor…</p>;
  if (state.status === 'failed') {
    return (
      <p className="lt-note">
        Denetlenemedi ({state.reason === 'limit' ? 'limit' : state.reason === 'offline' ? 'çevrimdışı' : 'sunucu'})
      </p>
    );
  }
  if (state.issues.length === 0) return <p className="lt-note lt-ok">Denetimde sorun bulunmadı ✓</p>;
  const shown = state.issues.slice(0, 3);
  return (
    <ul className="plain lt-list" aria-label="Dilbilgisi denetimi">
      {shown.map((it, i) => {
        const bad = text.slice(it.offset, it.offset + it.length);
        return (
          <li key={i}>
            {it.replacements[0] !== undefined ? (
              <span lang="de">
                {bad && <span className="lt-bad">{bad}</span>}{bad && ' → '}
                <b className="lt-fix">{it.replacements[0]}</b>
              </span>
            ) : (
              bad && <span lang="de" className="lt-bad">{bad}</span>
            )}
            <span lang="de" className="lt-msg">{it.message}</span>
          </li>
        );
      })}
      {state.issues.length > shown.length && (
        <li className="lt-note">+{state.issues.length - shown.length} sorun daha</li>
      )}
    </ul>
  );
}

// Segmentlerden kendi cümlen (kırmızı: yanlış/fazla, amber: küçük yazım farkı).
export function AttemptLine({ segments }: { segments: Segment[] }) {
  return (
    <span lang="de">
      {segments.map((s, i) => {
        if (s.type === 'missing') return null;
        const cls = s.type === 'same' ? '' : s.nearlyEqual ? 'dw-near' : 'dw-bad';
        return <span key={i} className={cls || undefined}>{s.actual}{' '}</span>;
      })}
    </span>
  );
}

// Doğru cümle; eksik/değişen sözcükler yeşil altı çizili.
export function ExpectedLine({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.type === 'extra') return null;
        const cls = s.type === 'same' ? '' : s.nearlyEqual ? 'dw-near' : 'dw-miss';
        return <span key={i} className={cls || undefined}>{s.expected}{' '}</span>;
      })}
    </>
  );
}

export function FlagButton({ id, state, setState }: { id: string; state: AppState; setState: (s: AppState) => void }) {
  const on = isFlagged(state, id);
  return (
    <button
      type="button"
      className={on ? 'link-btn flag on' : 'link-btn flag'}
      aria-pressed={on}
      onClick={() => setState(toggleFlag(state, id))}
    >
      {on ? '🚩 İşaretlendi (geri al)' : '🚩 Görsel anlatmıyor'}
    </button>
  );
}
