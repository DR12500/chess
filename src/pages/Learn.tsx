import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { Nav } from '../App';
import { Board } from '../components/Board';
import { LESSONS, LEVELS, Level, Step } from '../content/lessons';
import { OPENINGS } from '../content/openings';
import { playSound, playUci, toColor } from '../lib/chessUtil';
import { computeStats } from '../lib/model';
import { currentProfile, markLessonDone, useStore } from '../lib/store';

function levelFor(rating: number): Level {
  return rating < 1000 ? 'beginner' : rating < 1600 ? 'intermediate' : 'advanced';
}

export function LearnPage({ nav, tab: initialTab }: { nav: Nav; tab?: 'lessons' | 'openings' }) {
  const profile = useStore((s) => currentProfile(s))!;
  const rating = useMemo(() => computeStats(profile).game.rating, [profile]);
  const [tab, setTab] = useState(initialTab ?? 'lessons');
  const [level, setLevel] = useState<Level | 'all'>('all');
  const recommended = levelFor(rating);

  return (
    <div className="page">
      <h1>Learn</h1>
      <div className="seg">
        <button className={tab === 'lessons' ? 'on' : ''} onClick={() => setTab('lessons')}>Lessons</button>
        <button className={tab === 'openings' ? 'on' : ''} onClick={() => setTab('openings')}>Openings</button>
      </div>
      <div className="seg small-seg">
        <button className={level === 'all' ? 'on' : ''} onClick={() => setLevel('all')}>All levels</button>
        {LEVELS.map((l) => (
          <button key={l.id} className={level === l.id ? 'on' : ''} onClick={() => setLevel(l.id)}>
            {l.label}{l.id === recommended ? ' ★' : ''}
          </button>
        ))}
      </div>
      <p className="muted small">★ = recommended for your rating ({Math.round(rating)}).</p>

      {tab === 'lessons' &&
        LEVELS.filter((l) => level === 'all' || l.id === level).map((l) => (
          <section key={l.id}>
            <h2>{l.label} <span className="muted small">{l.blurb}</span></h2>
            <div className="grid">
              {LESSONS.filter((x) => x.level === l.id).map((x) => (
                <button key={x.id} className="tile" onClick={() => nav({ name: 'lesson', id: x.id })}>
                  <span className={`topic ${x.topic}`}>{x.topic}</span>
                  <b>{x.title} {profile.lessonsDone.includes(x.id) && '✅'}</b>
                  <span className="muted small">{x.summary}</span>
                </button>
              ))}
            </div>
          </section>
        ))}

      {tab === 'openings' && (
        <div className="grid">
          {OPENINGS.filter((o) => level === 'all' || o.level === level).map((o) => (
            <button key={o.id} className="tile" onClick={() => nav({ name: 'opening', id: o.id })}>
              <span className={`topic ${o.level}`}>{o.level} · for {o.side}</span>
              <b>{o.name}</b>
              <span className="muted small">{o.eco} · {o.moves.split(' ').slice(0, 6).join(' ')}…</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ lesson

export function LessonPage({ nav, id }: { nav: Nav; id: string }) {
  const profile = useStore((s) => currentProfile(s))!;
  const lesson = LESSONS.find((l) => l.id === id);
  const [stepIdx, setStepIdx] = useState(0);
  if (!lesson) return <div className="page">Lesson not found.</div>;
  const step = lesson.steps[stepIdx];
  const lastStep = stepIdx === lesson.steps.length - 1;

  return (
    <div className="game-layout">
      <div className="board-col">
        {step.fen ? <StepBoard key={`${id}-${stepIdx}`} step={step} onSolved={() => undefined} /> : <div className="board-placeholder text">{lesson.title}</div>}
      </div>
      <aside className="side-col">
        <div className="card">
          <div className="muted small">{lesson.level} · {lesson.topic} · step {stepIdx + 1}/{lesson.steps.length}</div>
          <h2>{lesson.title}</h2>
          <p className="lesson-text">{step.text}</p>
        </div>
        <div className="controls">
          <button className="btn" onClick={() => (stepIdx === 0 ? nav({ name: 'learn' }) : setStepIdx(stepIdx - 1))}>← {stepIdx === 0 ? 'Lessons' : 'Back'}</button>
          {!lastStep && <button className="btn primary" onClick={() => setStepIdx(stepIdx + 1)}>Next →</button>}
          {lastStep && (
            <button className="btn primary" onClick={() => { markLessonDone(profile.id, lesson.id); nav({ name: 'learn' }); }}>
              Finish ✓
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

/** Board for a lesson step: static diagram, interactive task (`line`) or demo (`demo`). */
function StepBoard({ step, onSolved }: { step: Step; onSolved: () => void }) {
  const sound = useStore((s) => s.settings.sound);
  const seq = step.line ?? step.demo ?? [];
  const [ply, setPly] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const userColor = toColor(new Chess(step.fen).turn());
  const orientation = step.orientation ?? userColor;

  const chess = useMemo(() => {
    const c = new Chess(step.fen);
    for (const m of seq.slice(0, ply)) playUci(c, m);
    return c;
  }, [step.fen, seq, ply]);
  const last = ply > 0 ? seq[ply - 1] : null;
  const done = !!step.line && ply >= seq.length;

  // Auto-play the opponent's reply in a task.
  useEffect(() => {
    if (!step.line || ply >= seq.length || ply % 2 === 0) return;
    const t = setTimeout(() => setPly((p) => p + 1), 500);
    return () => clearTimeout(t);
  }, [step.line, ply, seq.length]);

  const onMove = (uci: string) => {
    if (!step.line || done || ply % 2 === 1) return;
    const test = new Chess(chess.fen());
    if (!playUci(test, uci)) return;
    const expected = seq[ply];
    if (uci === expected || (step.anyMate && test.isCheckmate())) {
      playSound(test.inCheck() ? 'check' : 'move', sound);
      if (ply + 1 >= seq.length) {
        setMsg('Correct! ✅');
        playSound('good', sound);
        onSolved();
        if (uci !== expected) {
          // Accepted alternative mate: show the position the user actually reached.
          setAltFen(test.fen());
        }
      } else setMsg('Good, keep going…');
      setPly(ply + 1);
    } else {
      playSound('bad', sound);
      setMsg('Not this one. Try again.');
      setTick((t) => t + 1);
    }
  };
  const [altFen, setAltFen] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // forces the board to reset after a wrong move

  return (
    <>
      <div className="player-line">
        <b>{step.line ? (done ? msg : msg ?? `Your move (${userColor})`) : step.demo ? `Move ${ply}/${seq.length}` : ''}</b>
      </div>
      <Board
        key={tick}
        fen={altFen ?? chess.fen()}
        orientation={orientation}
        movable={step.line && !done ? userColor : null}
        lastMove={last ? [last.slice(0, 2), last.slice(2, 4)] : undefined}
        arrows={ply === 0 ? step.arrows?.map(([from, to]) => ({ from, to })) : undefined}
        highlight={ply === 0 ? step.highlight : undefined}
        onMove={onMove}
      />
      {step.demo && (
        <div className="controls center">
          <button className="btn" onClick={() => setPly(0)}>⏮</button>
          <button className="btn" onClick={() => setPly((p) => Math.max(0, p - 1))}>◀</button>
          <button className="btn primary" onClick={() => setPly((p) => Math.min(seq.length, p + 1))}>▶</button>
        </div>
      )}
      {step.line && (
        <div className="controls center">
          <button className="btn" onClick={() => { setPly(0); setMsg(null); setAltFen(null); setTick((t) => t + 1); }}>↺ Reset</button>
          {!done && <button className="btn" onClick={() => setMsg(`Hint: ${seq[ply].slice(0, 2)} → ${seq[ply].slice(2, 4)}`)}>💡 Hint</button>}
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ opening

export function OpeningPage({ nav, id }: { nav: Nav; id: string }) {
  const o = OPENINGS.find((x) => x.id === id);
  const [ply, setPly] = useState(0);
  const sans = o ? o.moves.split(' ') : [];
  const chess = useMemo(() => {
    const c = new Chess();
    for (const m of sans.slice(0, ply)) c.move(m);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ply]);
  if (!o) return <div className="page">Opening not found.</div>;
  const hist = chess.history({ verbose: true });
  const last = hist[hist.length - 1];
  const note = ply > 0 ? o.notes?.[ply - 1] : undefined;

  return (
    <div className="game-layout">
      <div className="board-col">
        <div className="player-line"><b>{o.name}</b><span className="muted small">{o.eco}</span></div>
        <Board fen={chess.fen()} orientation={o.side} movable={null} lastMove={last ? [last.from, last.to] : undefined} />
        <div className="controls center">
          <button className="btn" onClick={() => setPly(0)}>⏮</button>
          <button className="btn" onClick={() => setPly((p) => Math.max(0, p - 1))}>◀</button>
          <button className="btn primary" onClick={() => setPly((p) => Math.min(sans.length, p + 1))}>▶</button>
          <button className="btn" onClick={() => setPly(sans.length)}>⏭</button>
        </div>
      </div>
      <aside className="side-col">
        <div className="card">
          <div className="muted small">{o.level} · usually played by {o.side}</div>
          <p className="opening-moves">
            {sans.map((m, i) => (
              <span key={i} className={`mv click ${i === ply - 1 ? 'cur' : ''}`} onClick={() => setPly(i + 1)}>
                {i % 2 === 0 ? `${i / 2 + 1}.` : ''}{m}{' '}
              </span>
            ))}
          </p>
          {note && <p className="note">💬 {note}</p>}
        </div>
        <div className="card">
          <h3>Key ideas</h3>
          <ul>{o.ideas.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
        <div className="controls">
          <button className="btn" onClick={() => nav({ name: 'learn', tab: 'openings' })}>← Openings</button>
          <button className="btn primary" onClick={() => nav({ name: 'play', startMoves: o.moves, color: o.side })}>
            Practice vs Stockfish ♟
          </button>
        </div>
      </aside>
    </div>
  );
}
