import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '../components/Board';
import { Color, playUci, toColor } from '../lib/chessUtil';
import { playSound } from '../lib/sound';
import { computeStats } from '../lib/model';
import { addPuzzleAttempt, currentProfile, useStore } from '../lib/store';

type PuzzleRow = [id: string, fen: string, moves: string, rating: number, themes: string, openings: string];

let puzzleCache: Promise<PuzzleRow[]> | null = null;
function loadPuzzles(): Promise<PuzzleRow[]> {
  puzzleCache ??= fetch(`${import.meta.env.BASE_URL}puzzles.json`)
    .then((r) => r.json())
    .then((d: { puzzles: PuzzleRow[] }) => d.puzzles);
  return puzzleCache;
}

const THEMES: { id: string; label: string }[] = [
  { id: '', label: 'Mixed' },
  { id: 'mate', label: 'Checkmate' },
  { id: 'fork', label: 'Fork' },
  { id: 'pin', label: 'Pin' },
  { id: 'skewer', label: 'Skewer' },
  { id: 'hangingPiece', label: 'Hanging piece' },
  { id: 'discoveredAttack', label: 'Discovered attack' },
  { id: 'sacrifice', label: 'Sacrifice' },
  { id: 'opening', label: 'Opening' },
  { id: 'middlegame', label: 'Middlegame' },
  { id: 'endgame', label: 'Endgame' },
];

type Status = 'loading' | 'opponent' | 'yours' | 'solved' | 'failed';

export function PuzzlesPage() {
  const profile = useStore((s) => currentProfile(s))!;
  const stats = useMemo(() => computeStats(profile), [profile]);
  const rating = Math.round(stats.puzzle.rating);
  const [all, setAll] = useState<PuzzleRow[] | null>(null);
  const [theme, setTheme] = useState('');
  const [puzzle, setPuzzle] = useState<PuzzleRow | null>(null);
  const [ply, setPly] = useState(0); // number of solution moves already on the board
  const [status, setStatus] = useState<Status>('loading');
  const [hint, setHint] = useState<string | null>(null);
  const recorded = useRef(false);
  const ratingAtStart = useRef(rating);

  useEffect(() => {
    void loadPuzzles().then(setAll);
  }, []);

  const pickNext = () => {
    if (!all) return;
    const seen = new Set(profile.puzzles.map((p) => p[0]));
    const pool = all.filter((p) => !seen.has(p[0]) && (!theme || p[4].split(' ').includes(theme)));
    let window = 100;
    let cands: PuzzleRow[] = [];
    while (cands.length < 5 && window < 3000) {
      cands = pool.filter((p) => Math.abs(p[3] - rating) <= window);
      window += 100;
    }
    if (cands.length === 0) cands = pool.length ? pool : all;
    const next = cands[Math.floor(Math.random() * cands.length)];
    recorded.current = false;
    ratingAtStart.current = rating;
    setHint(null);
    setPuzzle(next);
    setPly(0);
    setStatus('opponent');
  };

  useEffect(() => {
    if (all) pickNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, theme]);

  const solution = puzzle ? puzzle[2].split(' ') : [];
  const chess = useMemo(() => {
    if (!puzzle) return new Chess();
    const c = new Chess(puzzle[1]);
    for (const m of solution.slice(0, ply)) playUci(c, m);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, ply]);
  const playerColor: Color = puzzle ? (toColor(new Chess(puzzle[1]).turn()) === 'white' ? 'black' : 'white') : 'white';
  const lastMoveUci = ply > 0 ? solution[ply - 1] : null;

  // Opponent (setup / reply) moves are played automatically after a short pause.
  useEffect(() => {
    if (!puzzle || status !== 'opponent') return;
    const t = setTimeout(() => {
      setPly((p) => p + 1);
      playSound('move');
      setStatus('yours');
    }, ply === 0 ? 700 : 450);
    return () => clearTimeout(t);
  }, [puzzle, status, ply]);

  const record = (solved: boolean) => {
    if (recorded.current || !puzzle) return;
    recorded.current = true;
    addPuzzleAttempt(profile.id, [puzzle[0], Date.now(), puzzle[3], solved ? 1 : 0]);
  };

  const onMove = (uci: string) => {
    if (!puzzle || status !== 'yours') return;
    const expected = solution[ply];
    const test = new Chess(chess.fen());
    const mv = playUci(test, uci);
    if (!mv) return;
    const isLast = ply + 1 >= solution.length;
    // Lichess rule: any mating move is accepted.
    if (uci === expected || (test.isCheckmate())) {
      playSound(test.inCheck() ? 'check' : mv.captured ? 'capture' : 'move');
      setHint(null);
      if (isLast) {
        setPly(ply + 1);
        setStatus('solved');
        playSound('good');
        record(true);
      } else {
        setPly(ply + 1);
        setStatus('opponent');
      }
    } else {
      playSound('bad');
      record(false);
      setStatus('failed');
    }
  };

  const showSolution = () => {
    record(false);
    setStatus('failed');
    setPly(solution.length);
  };

  const after = Math.round(computeStats(profile).puzzle.rating);
  const change = after - Math.round(ratingAtStart.current);

  return (
    <div className="game-layout">
      <div className="board-col">
        <div className="player-line">
          <b>{status === 'yours' ? `${playerColor === 'white' ? 'White' : 'Black'} to move: find the best move!` : status === 'solved' ? 'Solved! ✅' : status === 'failed' ? 'Not quite ❌' : '…'}</b>
        </div>
        {puzzle ? (
          <Board
            fen={chess.fen()}
            orientation={playerColor}
            movable={status === 'yours' ? playerColor : null}
            lastMove={lastMoveUci ? [lastMoveUci.slice(0, 2), lastMoveUci.slice(2, 4)] : undefined}
            highlight={hint ? [hint] : undefined}
            onMove={onMove}
          />
        ) : (
          <div className="board-placeholder">Loading puzzles…</div>
        )}
      </div>
      <aside className="side-col">
        <div className="card">
          <div className="big-number">{status === 'solved' || status === 'failed' ? after : rating}</div>
          <div className="muted small">your puzzle rating{(status === 'solved' || status === 'failed') && recorded.current && (
            <span className={change >= 0 ? 'pos' : 'neg'}> ({change >= 0 ? '+' : ''}{change})</span>
          )}</div>
          {puzzle && (status === 'solved' || status === 'failed') && <div className="small">Puzzle rating: {puzzle[3]} · themes: {puzzle[4]}</div>}
        </div>
        <div className="card">
          <h3>Theme</h3>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div className="controls">
          {status === 'yours' && (
            <>
              <button className="btn" onClick={() => { record(false); setHint(solution[ply].slice(0, 2)); }}>💡 Hint</button>
              <button className="btn" onClick={showSolution}>Show solution</button>
            </>
          )}
          {status === 'failed' && ply < solution.length && <button className="btn" onClick={showSolution}>Show solution</button>}
          {status === 'failed' && ply < solution.length && <button className="btn" onClick={() => setStatus('yours')}>Retry (unrated)</button>}
          <button className="btn primary" onClick={pickNext} disabled={!all}>Next puzzle →</button>
        </div>
        <p className="muted small">
          {stats.puzzlesSolved}/{stats.puzzlesTried} solved. Puzzles from the Lichess open database (CC0).
        </p>
      </aside>
    </div>
  );
}
