import { useEffect, useMemo, useState } from 'react';
import { exampleFor, gradePattern, planDay } from '../core/scheduler';
import { studyStreak } from '../core/stats';
import type { AppState, Grade, Pattern, QueueItem } from '../core/types';
import { GRADES, gradePreview } from './util';

interface Props {
  state: AppState;
  setState: (s: AppState) => void;
  patterns: Pattern[];
  today: string;
}

export function TodayTab({ state, setState, patterns, today }: Props) {
  const [graduated, setGraduated] = useState<string[]>([]);
  const { queue } = useMemo(() => planDay(state, patterns, today), [state, patterns, today]);
  const doneToday = state.days[today]?.done.filter((id) => patterns.some((p) => p.id === id)).length ?? 0;
  const reviewCount = queue.filter((q) => q.kind !== 'new').length;
  const newCount = queue.length - reviewCount;
  const total = doneToday + queue.length;

  if (patterns.length === 0) {
    return (
      <section>
        <h1>Bugün</h1>
        <p className="empty">Henüz kalıp yok. Kalıp verisi eklenince burada günlük çalışma kartların görünecek.</p>
      </section>
    );
  }

  const current = queue[0];

  const onGrade = (item: QueueItem, grade: Grade, sentence: string) => {
    const before = state.progress[item.id];
    const after = gradePattern(state, item.id, grade, today, sentence);
    const pr = after.progress[item.id];
    if (pr && pr.phase === 'review' && (!before || before.phase === 'learning')) {
      setGraduated((g) => (g.includes(item.id) ? g : [...g, item.id]));
    }
    setState(after);
  };

  return (
    <section>
      <h1>Bugün</h1>
      <p className="lead">Bugün: {reviewCount} tekrar, {newCount} yeni</p>
      <div
        className="bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={doneToday}
        aria-label="Günlük ilerleme"
      >
        <span style={{ width: total ? `${(doneToday / total) * 100}%` : '0%' }} className="bar-fill" />
      </div>
      <p className="muted small">{doneToday} / {total} tamamlandı</p>

      {current ? (
        <Card
          key={current.id}
          item={current}
          pattern={patterns.find((p) => p.id === current.id)!}
          state={state}
          today={today}
          onGrade={onGrade}
        />
      ) : doneToday > 0 ? (
        <div className="card summary">
          <h2>Bugünlük bu kadar</h2>
          <ul className="plain">
            <li>{doneToday} kalıp çalıştın</li>
            <li>{graduated.length} kalıp kalıcılığa geçti{graduated.length ? ' (bu oturumda)' : ''}</li>
            <li>Seri: {studyStreak(state, today)} gün</li>
          </ul>
          <p className="muted">Yarın yeni kalıplar ve tekrarlar seni bekliyor.</p>
        </div>
      ) : (
        <p className="empty">Bugün için yapılacak iş yok.</p>
      )}
    </section>
  );
}

type Step = 'intro' | 'practice' | 'answer';

function Card({ item, pattern, state, today, onGrade }: {
  item: QueueItem; pattern: Pattern; state: AppState; today: string;
  onGrade: (item: QueueItem, grade: Grade, sentence: string) => void;
}) {
  const [step, setStep] = useState<Step>(item.kind === 'new' ? 'intro' : 'practice');
  const [attempt, setAttempt] = useState('');
  const [own, setOwn] = useState('');
  useEffect(() => { window.scrollTo({ top: 0 }); }, [item.id, step]);
  const example = exampleFor(pattern, state.progress[item.id]);
  const kindLabel = item.kind === 'new' ? 'Yeni' : item.kind === 'learning' ? 'Öğreniliyor' : 'Kalıcı tekrar';

  if (step === 'intro') {
    return (
      <div className="card">
        <span className="badge new">{kindLabel} · {pattern.level}</span>
        <h2 lang="de" className="pattern">{pattern.pattern}</h2>
        <p className="meaning">{pattern.meaning}</p>
        {pattern.note && <p className="note">{pattern.note}</p>}
        <ul className="examples">
          {pattern.examples.map((e, i) => (
            <li key={i}>
              <span lang="de" className="de">{e.de}</span>
              <span className="tr">{e.tr}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="btn primary block" onClick={() => setStep('practice')}>Anladım</button>
      </div>
    );
  }

  if (step === 'practice') {
    return (
      <div className="card">
        <span className={`badge ${item.kind}`}>{kindLabel} · {pattern.level}</span>
        <p className="prompt-label">Bunu Almanca söyle:</p>
        <p className="prompt">{example.tr}</p>
        <label className="field">
          <span>Almancasını kur (isteğe bağlı)</span>
          <textarea
            lang="de"
            rows={2}
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <button type="button" className="btn primary block" onClick={() => setStep('answer')}>Cevabı göster</button>
      </div>
    );
  }

  return (
    <div className="card">
      <span className={`badge ${item.kind}`}>{kindLabel} · {pattern.level}</span>
      <p className="prompt small-prompt">{example.tr}</p>
      {attempt.trim() && <p className="attempt"><span className="muted small">Senin cevabın: </span><span lang="de">{attempt}</span></p>}
      <p lang="de" className="answer">{example.de}</p>
      <p className="muted small">Kalıp</p>
      <p lang="de" className="pattern small-pattern">{pattern.pattern}</p>
      <p className="meaning">{pattern.meaning}</p>
      <label className="field">
        <span>Kendi cümleni kur (isteğe bağlı, kaydedilir)</span>
        <textarea
          lang="de"
          rows={2}
          value={own}
          onChange={(e) => setOwn(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <p className="prompt-label">Nasıl geçti?</p>
      <div className="grades">
        {GRADES.map((g) => (
          <div key={g.grade} className="grade-wrap">
            <button type="button" className={`btn grade ${g.grade}`} onClick={() => onGrade(item, g.grade, own)}>
              {g.label}
            </button>
            <span className="muted small">{gradePreview(state, item.id, g.grade, today)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
