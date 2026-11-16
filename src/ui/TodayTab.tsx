import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { diffWords, similarity } from '../check/diff';
import { suggestGrade } from '../check/verdict';
import { pickDrill, type Drill, type PatternGroup } from '../core/drill';
import groupsData from '../data/groups.json';
import { exampleFor, gradePattern, planDay } from '../core/scheduler';
import { studyStreak } from '../core/stats';
import type { AppState, Grade, Pattern, QueueItem } from '../core/types';
import { loadPrefs } from './prefs';
import { PatternVisual } from './PatternVisual';
import { AttemptLine, ExpectedLine, FlagButton, IssueList, useLtCheck } from './SentenceCheck';
import { Shadowing } from './Shadowing';
import { SpeakButtons } from './SpeakButtons';
import { speak } from './speech';
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
    <section className="today">
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
          patterns={patterns}
          state={state}
          setState={setState}
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

type Step = 'choose' | 'intro' | 'practice' | 'answer';

const GROUPS = groupsData as PatternGroup[];

// Her adımın ana eylemi içeriğin altında, sekme çubuğunun hemen üstünde yapışık durur.
function ActionBar({ children, grades }: { children: ReactNode; grades?: boolean }) {
  return <div className={grades ? 'actionbar grades' : 'actionbar'}>{children}</div>;
}

// "Hangi kalıp?" ayırt etme alıştırması; notu ve zamanlamayı etkilemez.
function ChooseStep({ drill, prompt, kindLabel, onDone }: {
  drill: Drill; prompt: string; kindLabel: string; onDone: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <>
      <div className="card">
        <span className="badge learning">{kindLabel} · Hangi kalıp?</span>
        <p className="prompt-label">Bu cümle hangi kalıpla kurulur?</p>
        <p className="prompt">{prompt}</p>
        <div className="choices" role="group" aria-label="Kalıp seçenekleri">
          {drill.options.map((o) => {
            const cls = picked === null ? '' : o.id === drill.correctId ? ' right' : o.id === picked ? ' wrong' : '';
            return (
              <button
                key={o.id}
                type="button"
                lang="de"
                className={`choice${cls}`}
                disabled={picked !== null}
                onClick={() => setPicked(o.id)}
              >
                {o.pattern}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <>
            <p role="status" className={picked === drill.correctId ? 'msg ok' : 'msg err'}>
              {picked === drill.correctId ? 'Doğru ✓' : 'Yanlış: doğrusu yeşil olan.'}
            </p>
            <p className="note small">{drill.hint}</p>
          </>
        )}
      </div>
      <ActionBar>
        <button type="button" className="btn primary block" onClick={onDone}>
          {picked === null ? 'Atla' : 'Devam'}
        </button>
      </ActionBar>
    </>
  );
}

function Card({ item, pattern, patterns, state, setState, today, onGrade }: {
  item: QueueItem; pattern: Pattern; patterns: Pattern[]; state: AppState;
  setState: (s: AppState) => void; today: string;
  onGrade: (item: QueueItem, grade: Grade, sentence: string) => void;
}) {
  // Yeni kart değilse bazı günlerde önce ayırt etme sorusu (kalıp + gün için belirleyici).
  const drill = useMemo(
    () => (item.kind === 'new' ? null : pickDrill(item.id, today, state.progress, GROUPS, patterns)),
    // Kart açıkken ilerleme değişse de soru sabit kalsın.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.id, item.kind, today],
  );
  const [step, setStep] = useState<Step>(item.kind === 'new' ? 'intro' : drill ? 'choose' : 'practice');
  const [attempt, setAttempt] = useState('');
  const [own, setOwn] = useState('');
  const [ownOpen, setOwnOpen] = useState(false);
  const lt = useLtCheck();
  const ownLt = useLtCheck();
  const [checkOn, setCheckOn] = useState(() => loadPrefs().checkSentences);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [item.id, step]);
  const example = exampleFor(pattern, state.progress[item.id]);
  const kindLabel = item.kind === 'new' ? 'Yeni' : item.kind === 'learning' ? 'Öğreniliyor' : 'Kalıcı tekrar';

  const typed = attempt.trim();
  const answering = step === 'answer' && typed !== '';
  const diff = useMemo(() => (answering ? diffWords(example.de, typed) : null), [answering, typed, example.de]);
  const sim = useMemo(() => (answering ? similarity(example.de, typed) : null), [answering, typed, example.de]);
  const exact = diff !== null && diff.segments.every((s) => s.type === 'same');

  // iOS yalnız kullanıcı dokunuşu içinde ses çalmaya izin verir: otomatik okuma tıklama işleyicisinde.
  const showAnswer = () => {
    const prefs = loadPrefs();
    if (prefs.autoSpeak) speak(example.de);
    setCheckOn(prefs.checkSentences);
    // Birebir doğruysa sunucuya göndermeye gerek yok (limit ve gizlilik).
    const same = typed !== '' && diffWords(example.de, typed).segments.every((s) => s.type === 'same');
    if (prefs.checkSentences && typed && !same) lt.run(typed);
    setStep('answer');
  };

  // Öneri: denetim sürerken bekler (titreme olmasın); kapalı/başarısızsa yalnız benzerlik.
  const suggested = lt.state.status === 'loading' ? null : suggestGrade({
    similarity: sim,
    issues: lt.state.status === 'done' ? lt.state.issues : null,
  });

  if (step === 'choose' && drill) {
    return <ChooseStep drill={drill} prompt={example.tr} kindLabel={kindLabel} onDone={() => setStep('practice')} />;
  }

  if (step === 'intro') {
    return (
      <>
        <div className="card">
          <PatternVisual id={pattern.id} size="full" showCue eager />
          <FlagButton id={pattern.id} state={state} setState={setState} />
          <span className="badge new">{kindLabel} · {pattern.level}</span>
          <h2 lang="de" className="pattern">{pattern.pattern}</h2>
          <p className="meaning">{pattern.meaning}</p>
          {pattern.note && <p className="note">{pattern.note}</p>}
          <ul className="examples">
            {pattern.examples.map((e, i) => (
              <li key={i}>
                <div className="line">
                  <span lang="de" className="de">{e.de}</span>
                  <SpeakButtons text={e.de} />
                </div>
                <span className="tr">{e.tr}</span>
              </li>
            ))}
          </ul>
        </div>
        <ActionBar>
          <button type="button" className="btn primary block" onClick={() => setStep('practice')}>Anladım</button>
        </ActionBar>
      </>
    );
  }

  if (step === 'practice') {
    return (
      <>
        <div className="card">
          <PatternVisual id={pattern.id} size="small" eager />
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
        </div>
        <ActionBar>
          <button type="button" className="btn primary block" onClick={() => showAnswer()}>Cevabı göster</button>
        </ActionBar>
      </>
    );
  }

  return (
    <>
      <div className="card">
        <span className={`badge ${item.kind}`}>{kindLabel} · {pattern.level}</span>
        <p className="prompt small-prompt">{example.tr}</p>
        {diff && (
          <div className="attempt">
            <span className="muted small">Senin cevabın: </span>
            {exact ? (
              <span lang="de">{typed} <b className="lt-fix">✓ doğru</b></span>
            ) : (
              <AttemptLine segments={diff.segments} />
            )}
            {diff.nearlyEqual && <span className="dw-near small"> · küçük yazım farkı</span>}
            {checkOn && !exact && <IssueList text={typed} state={lt.state} />}
          </div>
        )}
        <div className="line">
          <p lang="de" className="answer">
            {diff && !exact ? <ExpectedLine segments={diff.segments} /> : example.de}
          </p>
          <SpeakButtons text={example.de} />
        </div>
        <Shadowing text={example.de} />
        <p className="pattern-line">
          <b lang="de">{pattern.pattern}</b>
          <span className="muted"> — {pattern.meaning}</span>
        </p>
        <PatternVisual id={pattern.id} size="tiny" showCue eager />
        <FlagButton id={pattern.id} state={state} setState={setState} />
        {ownOpen ? (
          <>
            <label className="field">
              <span>Kendi cümleni kur (isteğe bağlı, kaydedilir)</span>
              <textarea
                lang="de"
                rows={2}
                value={own}
                onChange={(e) => { setOwn(e.target.value); ownLt.reset(); }}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </label>
            {checkOn && own.trim() && (
              <button
                type="button"
                className="link-btn"
                disabled={ownLt.state.status === 'loading'}
                onClick={() => ownLt.run(own.trim())}
              >
                Denetle
              </button>
            )}
            {checkOn && <IssueList text={own.trim()} state={ownLt.state} />}
          </>
        ) : (
          <button type="button" className="link-btn" onClick={() => setOwnOpen(true)}>+ Kendi cümleni yaz</button>
        )}
      </div>
      <ActionBar grades>
        {GRADES.map((g) => {
          const preview = gradePreview(state, item.id, g.grade, today);
          const isSuggested = suggested === g.grade;
          return (
            <button
              key={g.grade}
              type="button"
              className={`btn grade ${g.grade}${isSuggested ? ' suggested' : ''}`}
              aria-label={`${g.label}: ${preview}${isSuggested ? ' (önerilen)' : ''}`}
              onClick={() => onGrade(item, g.grade, own)}
            >
              {isSuggested && <span className="grade-tag" aria-hidden="true">önerilen</span>}
              <span className="grade-label">{g.short}</span>
              <span className="grade-hint">{preview}</span>
            </button>
          );
        })}
      </ActionBar>
    </>
  );
}
