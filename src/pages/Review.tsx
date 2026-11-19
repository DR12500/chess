import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { Nav } from '../App';
import { Board } from '../components/Board';
import { analysisEngine } from '../lib/engine';
import { Color, toColor, winPercent } from '../lib/chessUtil';
import { classifyMoves, accuracy, PositionEval, MoveClass } from '../lib/review';
import { computeStats } from '../lib/model';
import { currentProfile, useStore } from '../lib/store';
import { MoveList } from './Play';

const DEPTH = 12;
const cacheKey = (id: string) => `chess.review.${id}`;

export function ReviewPage({ nav, gameId }: { nav: Nav; gameId: string }) {
  const profile = useStore((s) => currentProfile(s))!;
  const game = profile.games.find((g) => g.id === gameId);
  const stats = useMemo(() => computeStats(profile), [profile]);

  const parsed = useMemo(() => {
    if (!game) return null;
    const c = new Chess();
    c.loadPgn(game.pgn);
    const hist = c.history({ verbose: true });
    const startFen = hist[0]?.before ?? c.fen();
    return { hist, startFen, fens: [startFen, ...hist.map((h) => h.after)] };
  }, [game]);

  const [evals, setEvals] = useState<PositionEval[] | null>(() => {
    try {
      const raw = localStorage.getItem(cacheKey(gameId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [progress, setProgress] = useState(0);
  const [ply, setPly] = useState(-1); // -1 = start position
  const [orientation, setOrientation] = useState<Color>(game ? toColor(game.color) : 'white');

  useEffect(() => {
    if (!parsed || evals) return;
    let cancelled = false;
    (async () => {
      const eng = analysisEngine();
      await eng.setOptions({ UCI_LimitStrength: false, 'Skill Level': 20, MultiPV: 1 });
      const out: PositionEval[] = [];
      for (let i = 0; i < parsed.fens.length; i++) {
        if (cancelled) return;
        const fen = parsed.fens[i];
        const ch = new Chess(fen);
        if (ch.isGameOver()) {
          // Terminal position: mate = lost for the side to move, otherwise draw.
          out.push({ score: ch.isCheckmate() ? -100000 : 0, best: null });
        } else {
          const r = await eng.search(fen, `depth ${DEPTH}`);
          out.push({ score: r.lines[0]?.score ?? 0, best: r.bestmove });
        }
        setProgress((i + 1) / parsed.fens.length);
      }
      if (cancelled) return;
      setEvals(out);
      try {
        localStorage.setItem(cacheKey(gameId), JSON.stringify(out));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsed, evals, gameId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!parsed) return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(-1, p - 1));
      if (e.key === 'ArrowRight') setPly((p) => Math.min(parsed.hist.length - 1, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [parsed]);

  if (!game || !parsed) {
    return (
      <div className="page narrow">
        <p>Game not found.</p>
        <button className="btn" onClick={() => nav({ name: 'profile' })}>Back</button>
      </div>
    );
  }

  const classes: MoveClass[] | null = evals
    ? classifyMoves(parsed.hist.map((h) => h.color), evals, parsed.hist.map((h) => h.from + h.to + (h.promotion ?? '')))
    : null;
  const acc = evals ? accuracy(parsed.hist.map((h) => h.color), evals) : null;
  const delta = stats.gameDelta[game.id];
  const fen = parsed.fens[ply + 1];
  const move = ply >= 0 ? parsed.hist[ply] : null;
  const prevEval = evals?.[ply + 1 - 1];
  const cls = classes && ply >= 0 ? classes[ply] : null;
  const bestPrev = ply >= 0 && evals ? evals[ply]?.best : null;

  // Eval from White's point of view for the bar.
  const curEval = evals?.[ply + 1];
  const whiteCp = curEval ? (new Chess(fen).turn() === 'w' ? curEval.score : -curEval.score) : 0;
  const whitePct = winPercent(whiteCp);

  const arrows = [];
  if (cls && cls !== 'best' && cls !== 'good' && bestPrev) arrows.push({ from: bestPrev.slice(0, 2), to: bestPrev.slice(2, 4), color: 'green' as const });

  return (
    <div className="game-layout">
      <div className="board-col">
        <div className="player-line">
          <b>{game.score === 1 ? 'Win' : game.score === 0 ? 'Loss' : 'Draw'}</b>
          <span className="muted small">
            vs Stockfish {game.botRating} · {game.termination} · {new Date(game.ts).toLocaleDateString()}
          </span>
          {delta && (
            <span className={delta.after >= delta.before ? 'pos' : 'neg'}>
              {delta.after >= delta.before ? '+' : ''}
              {Math.round(delta.after - delta.before)}
            </span>
          )}
        </div>
        <div className="board-eval">
          <div className="evalbar" title={formatEval(whiteCp)}>
            <div className="evalbar-white" style={{ height: `${orientation === 'white' ? whitePct : 100 - whitePct}%`, [orientation === 'white' ? 'bottom' : 'top']: 0 }} />
          </div>
          <Board fen={fen} orientation={orientation} movable={null} lastMove={move ? [move.from, move.to] : undefined} arrows={arrows} />
        </div>
        <div className="controls center">
          <button className="btn" onClick={() => setPly(-1)}>⏮</button>
          <button className="btn" onClick={() => setPly((p) => Math.max(-1, p - 1))}>◀</button>
          <button className="btn" onClick={() => setPly((p) => Math.min(parsed.hist.length - 1, p + 1))}>▶</button>
          <button className="btn" onClick={() => setPly(parsed.hist.length - 1)}>⏭</button>
          <button className="btn" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>⇅</button>
        </div>
      </div>
      <aside className="side-col">
        {!evals && (
          <div className="card">
            Analysing with Stockfish… {Math.round(progress * 100)}%
            <div className="progress"><div style={{ width: `${progress * 100}%` }} /></div>
          </div>
        )}
        {acc && (
          <div className="card acc">
            <div><span className="muted small">White accuracy</span><b>{acc.white.toFixed(1)}</b></div>
            <div><span className="muted small">Black accuracy</span><b>{acc.black.toFixed(1)}</b></div>
          </div>
        )}
        {classes && <Summary classes={classes} colors={parsed.hist.map((h) => h.color)} human={game.color} />}
        {move && (
          <div className="card">
            <b>{Math.ceil((ply + 1) / 2)}{move.color === 'w' ? '.' : '…'} {move.san}</b>{' '}
            {cls && <span className={`tag ${cls}`}>{cls}</span>}
            {curEval && <span className="muted small"> eval {formatEval(whiteCp)}</span>}
            {cls && cls !== 'best' && cls !== 'good' && bestPrev && prevEval && (
              <div className="small">Best was <b>{uciToSan(parsed.fens[ply], bestPrev)}</b> (green arrow).</div>
            )}
          </div>
        )}
        <MoveList history={parsed.hist.map((h) => h.san)} current={ply} onSelect={setPly} marks={classes ?? undefined} />
        <div className="controls">
          <button className="btn" onClick={() => nav({ name: 'play' })}>New game</button>
          <button className="btn" onClick={() => navigator.clipboard?.writeText(game.pgn)}>Copy PGN</button>
        </div>
      </aside>
    </div>
  );
}

function Summary({ classes, colors, human }: { classes: MoveClass[]; colors: ('w' | 'b')[]; human: 'w' | 'b' }) {
  const count = (c: MoveClass) => classes.filter((x, i) => x === c && colors[i] === human).length;
  return (
    <div className="card summary">
      <span className="tag best">★ best {count('best')}</span>
      <span className="tag inaccuracy">?! {count('inaccuracy')}</span>
      <span className="tag mistake">? {count('mistake')}</span>
      <span className="tag blunder">?? {count('blunder')}</span>
    </div>
  );
}

function formatEval(cp: number) {
  if (Math.abs(cp) > 90000) return `#${cp > 0 ? '' : '-'}${100000 - Math.abs(cp)}`;
  return (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);
}

function uciToSan(fen: string, uci: string) {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return uci;
  }
}
