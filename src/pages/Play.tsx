import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Nav } from '../App';
import { Board } from '../components/Board';
import { Bot } from '../lib/bot';
import { BOT_MAX, BOT_MIN, BOT_RD, DIFFICULTY_PRESETS, botConfigFor, botTargetFor } from '../lib/botStrength';
import { analysisEngine } from '../lib/engine';
import { Color, gameOverReason, playUci, soundFor, toColor } from '../lib/chessUtil';
import { playSound } from '../lib/sound';
import { GameRecord, Profile, computeStats, ratingConfigOf, uid } from '../lib/model';
import { previewChanges } from '../lib/rating';
import { ColorChoice, addGame, currentProfile, getState, updateSettings, useStore } from '../lib/store';

interface ActiveGame {
  id: string;
  color: 'w' | 'b'; // human
  botRating: number;
  rated: boolean;
  startFen: string;
  moves: string[]; // UCI
  startedAt: number;
  hintsUsed: number;
}

const START_FEN = new Chess().fen();
const activeKey = (pid: string) => `chess.active.${pid}`;

function loadActive(pid: string): ActiveGame | null {
  try {
    const raw = localStorage.getItem(activeKey(pid));
    return raw ? (JSON.parse(raw) as ActiveGame) : null;
  } catch {
    return null;
  }
}
function saveActive(pid: string, g: ActiveGame | null) {
  try {
    if (g) localStorage.setItem(activeKey(pid), JSON.stringify(g));
    else localStorage.removeItem(activeKey(pid));
  } catch {
    /* ignore */
  }
}

export function PlayPage({ nav, startMoves, forcedColor }: { nav: Nav; startMoves?: string; forcedColor?: Color }) {
  const profile = useStore((s) => currentProfile(s))!;
  const [game, setGame] = useState<ActiveGame | null>(() => (startMoves ? null : loadActive(profile.id)));

  const startGame = (g: ActiveGame) => {
    saveActive(profile.id, g);
    setGame(g);
  };

  if (!game) return <Setup profile={profile} onStart={startGame} startMoves={startMoves} forcedColor={forcedColor} />;
  return (
    <GameView
      key={game.id}
      profile={profile}
      initial={game}
      nav={nav}
      onNewGame={() => {
        saveActive(profile.id, null);
        setGame(null);
      }}
    />
  );
}

// ------------------------------------------------------------------ setup

function Setup({ profile, onStart, startMoves, forcedColor }: { profile: Profile; onStart: (g: ActiveGame) => void; startMoves?: string; forcedColor?: Color }) {
  const settings = useStore((s) => s.settings);
  const stats = useMemo(() => computeStats(profile), [profile]);
  const rating = Math.round(stats.game.rating);
  const [custom, setCustom] = useState<number | null>(null);
  const fromOpening = !!startMoves;
  const [rated, setRated] = useState(!fromOpening);
  const botRating = custom ?? botTargetFor(rating, settings.difficultyOffset);
  const cfg = botConfigFor(botRating);

  const colorChoice: ColorChoice = forcedColor ?? settings.colorChoice;

  const start = () => {
    const color = colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice === 'white' ? 'w' : 'b';
    const startFen = startMoves ? fenAfter(startMoves) : START_FEN;
    onStart({ id: uid(), color, botRating, rated: rated && !fromOpening, startFen, moves: [], startedAt: Date.now(), hintsUsed: 0 });
  };

  return (
    <div className="page narrow">
      <h1>{fromOpening ? 'Practice opening vs Stockfish' : 'Play vs Stockfish'}</h1>
      {fromOpening && <p className="muted">Starting after: {startMoves}</p>}

      <section className="card">
        <h3>Your colour</h3>
        <div className="seg">
          {(['white', 'random', 'black'] as const).map((c) => (
            <button key={c} className={colorChoice === c ? 'on' : ''} onClick={() => updateSettings({ colorChoice: c })} disabled={!!forcedColor && c !== forcedColor}>
              {c === 'white' ? '♔ White' : c === 'black' ? '♚ Black' : '⚄ Random'}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Difficulty</h3>
        <p className="muted">Your rating: <b>{rating}{stats.provisional ? '?' : ''}</b>. The bot adapts to it: as your rating goes up, so does the bot.</p>
        <div className="seg">
          {DIFFICULTY_PRESETS.map((d) => (
            <button
              key={d.id}
              className={custom === null && settings.difficultyOffset === d.offset ? 'on' : ''}
              onClick={() => {
                setCustom(null);
                updateSettings({ difficultyOffset: d.offset });
              }}
            >
              {d.label}
              <small>{d.offset === 0 ? '±0' : d.offset > 0 ? `+${d.offset}` : d.offset}</small>
            </button>
          ))}
          <button className={custom !== null ? 'on' : ''} onClick={() => setCustom(botRating)}>
            Custom
          </button>
        </div>
        {custom !== null && (
          <input type="range" min={BOT_MIN} max={BOT_MAX} step={25} value={custom} onChange={(e) => setCustom(Number(e.target.value))} />
        )}
        {rated && !fromOpening && (() => {
          const c = previewChanges(stats.game, { rating: botRating, rd: BOT_RD }, ratingConfigOf(profile));
          const f = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x)}`;
          return (
            <p className="muted small">
              Rating change: win <span className="pos">{f(c.win)}</span> · draw {f(c.draw)} · loss <span className="neg">{f(c.loss)}</span>
            </p>
          );
        })()}
        <div className="bot-line">
          <span className="bot-avatar">🐟</span>
          <div>
            <b>Stockfish {botRating}</b>
            <div className="muted small">
              {cfg.kind === 'limit'
                ? 'Stockfish strength limit (UCI_Elo)'
                : `Weakened engine: depth ${cfg.depth}, ${Math.round(cfg.randomChance * 100)}% random moves (estimated rating)`}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <label className="check">
          <input type="checkbox" checked={rated && !fromOpening} disabled={fromOpening} onChange={(e) => setRated(e.target.checked)} />
          Rated game <span className="muted small">(casual games allow hints and takebacks)</span>
        </label>
      </section>

      <button className="btn primary big" onClick={start}>
        Start game
      </button>
    </div>
  );
}

function fenAfter(sanMoves: string): string {
  const c = new Chess();
  for (const m of sanMoves.split(' ')) c.move(m);
  return c.fen();
}

// ------------------------------------------------------------------ game

interface Result {
  score: 1 | 0.5 | 0;
  termination: string;
  before: number;
  after: number;
  gameId: string;
  rated: boolean;
}

function GameView({ profile, initial, nav, onNewGame }: { profile: Profile; initial: ActiveGame; nav: Nav; onNewGame: () => void }) {
  const [moves, setMoves] = useState<string[]>(initial.moves);
  const [hintsUsed, setHintsUsed] = useState(initial.hintsUsed);
  const [thinking, setThinking] = useState(false);
  const [orientation, setOrientation] = useState<Color>(toColor(initial.color));
  const [hint, setHint] = useState<{ from: string; to: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const botRef = useRef<Bot | null>(null);
  const readyRef = useRef<Promise<void>>(Promise.resolve());
  const tokenRef = useRef(0);
  const finishedRef = useRef(false);

  const humanColor = toColor(initial.color);
  const botColor: Color = humanColor === 'white' ? 'black' : 'white';

  const chess = useMemo(() => {
    const c = new Chess(initial.startFen);
    for (const m of moves) playUci(c, m);
    return c;
  }, [moves, initial.startFen]);
  const history = useMemo(() => chess.history({ verbose: true }), [chess]);
  const last = history[history.length - 1];
  const turn = toColor(chess.turn());

  // Persist progress so a reload resumes the game.
  useEffect(() => {
    if (!finishedRef.current) saveActive(profile.id, { ...initial, moves, hintsUsed });
  }, [moves, hintsUsed, profile.id, initial]);

  // Create the bot once per game.
  useEffect(() => {
    const bot = new Bot();
    botRef.current = bot;
    readyRef.current = bot.start(botConfigFor(initial.botRating));
    return () => {
      tokenRef.current++;
      bot.dispose();
      botRef.current = null;
    };
  }, [initial.botRating]);

  const finish = (score: 1 | 0.5 | 0, termination: string) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    tokenRef.current++;
    const before = computeStats(profile).game.rating;
    const record: GameRecord = {
      id: initial.id,
      ts: Date.now(),
      color: initial.color,
      botRating: initial.botRating,
      score,
      rated: initial.rated && hintsUsed === 0,
      termination,
      pgn: buildPgn(initial, moves, profile.name, score),
    };
    addGame(profile.id, record);
    saveActive(profile.id, null);
    const updated = getState().doc.profiles[profile.id];
    const after = computeStats(updated).game.rating;
    playSound(score === 1 ? 'win' : score === 0 ? 'loss' : 'draw');
    setResult({ score, termination, before, after, gameId: initial.id, rated: record.rated });
  };

  // Game over detection + bot move.
  useEffect(() => {
    if (finishedRef.current) return;
    const reason = gameOverReason(chess);
    if (reason) {
      const score = reason === 'checkmate' ? (turn === humanColor ? 0 : 1) : 0.5;
      finish(score, reason);
      return;
    }
    if (turn !== botColor) return;
    const token = ++tokenRef.current;
    const fen = chess.fen();
    setThinking(true);
    (async () => {
      const t0 = performance.now();
      await readyRef.current;
      const uci = await botRef.current?.move(fen);
      const speed = getState().settings.botSpeed;
      const base = speed === 'instant' ? 0 : speed === 'slow' ? 1000 + Math.random() * 1500 : 350 + Math.random() * 400;
      const wait = base - (performance.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (token !== tokenRef.current || !uci) return;
      setThinking(false);
      setMoves((ms) => [...ms, uci]);
    })().catch(() => setThinking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess]);

  // Sounds for every new move.
  const prevLen = useRef(moves.length);
  useEffect(() => {
    if (moves.length > prevLen.current && last) playSound(soundFor(last, chess));
    prevLen.current = moves.length;
  }, [moves.length, last, chess]);

  const onUserMove = (uci: string) => {
    if (turn !== humanColor || finishedRef.current) return;
    const test = new Chess(chess.fen());
    if (!playUci(test, uci)) return;
    setHint(null);
    setMoves((ms) => [...ms, uci]);
  };

  const humanFirst = new Chess(initial.startFen).turn() === initial.color;
  const humanMovesMade = humanFirst ? Math.ceil(moves.length / 2) : Math.floor(moves.length / 2);
  const canAbort = humanMovesMade < 1;
  const casual = !initial.rated;

  const resign = () => {
    if (canAbort) {
      tokenRef.current++;
      finishedRef.current = true;
      onNewGame();
      return;
    }
    if (!getState().settings.confirmResign || confirm('Resign this game?')) finish(0, 'resignation');
  };

  const offerDraw = async () => {
    setToast('Stockfish is considering your offer…');
    const res = await analysisEngine().search(chess.fen(), 'depth 10');
    const best = res.lines[0]?.score ?? 0;
    const botEval = turn === botColor ? best : -best;
    if (botEval < -50 || (Math.abs(botEval) <= 30 && chess.moveNumber() >= 25)) {
      setToast(null);
      finish(0.5, 'agreement');
    } else {
      setToast('Stockfish declines the draw.');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const showHint = async () => {
    setHintsUsed((h) => h + 1);
    setToast('Thinking…');
    const res = await analysisEngine().search(chess.fen(), 'depth 14');
    setToast(null);
    if (res.bestmove && res.bestmove !== '(none)') setHint({ from: res.bestmove.slice(0, 2), to: res.bestmove.slice(2, 4) });
  };

  const takeback = () => {
    tokenRef.current++;
    setThinking(false);
    setHint(null);
    // Remove the human's last move and everything after it.
    const humanFirst = new Chess(initial.startFen).turn() === initial.color;
    const isHumanPly = (i: number) => (i % 2 === 0) === humanFirst;
    setMoves((ms) => {
      let i = ms.length - 1;
      while (i >= 0 && !isHumanPly(i)) i--;
      return i < 0 ? ms : ms.slice(0, i);
    });
  };

  const material = materialDiff(chess);
  const myDiff = humanColor === 'white' ? material : -material;
  const stats = computeStats(profile);

  const top = orientation === humanColor ? 'bot' : 'me';
  const botLine = (
    <PlayerLine name={`Stockfish ${initial.botRating}`} sub={thinking ? 'thinking…' : ''} diff={-myDiff} avatar="🐟" />
  );
  const meLine = (
    <PlayerLine name={profile.name} sub={`${Math.round(stats.game.rating)}${stats.provisional ? '?' : ''}${casual ? ' · casual' : ''}`} diff={myDiff} avatar="🙂" />
  );

  return (
    <div className="game-layout">
      <div className="board-col">
        {top === 'bot' ? botLine : meLine}
        <Board
          fen={chess.fen()}
          orientation={orientation}
          movable={result ? null : humanColor}
          lastMove={last ? [last.from, last.to] : undefined}
          arrows={hint ? [{ ...hint, color: 'blue' }] : undefined}
          onMove={onUserMove}
        />
        {top === 'bot' ? meLine : botLine}
      </div>
      <aside className="side-col">
        <MoveList history={history.map((h) => h.san)} startsWithBlack={new Chess(initial.startFen).turn() === 'b'} />
        {toast && <div className="toast">{toast}</div>}
        <div className="controls">
          <button className="btn" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} title="Flip board">
            ⇅ Flip
          </button>
          {casual && (
            <>
              <button className="btn" onClick={showHint} disabled={turn !== humanColor || !!result}>💡 Hint</button>
              <button className="btn" onClick={takeback} disabled={moves.length === 0 || !!result}>↶ Takeback</button>
            </>
          )}
          <button className="btn" onClick={offerDraw} disabled={!!result || canAbort}>½ Draw</button>
          <button className="btn danger" onClick={resign} disabled={!!result}>
            {canAbort ? '✕ Abort' : '⚑ Resign'}
          </button>
        </div>
        {!initial.rated && initial.moves.length === 0 && moves.length === 0 && <p className="muted small">Casual game: not rated.</p>}
        {initial.rated && hintsUsed > 0 && <p className="muted small">A hint was used, so this game won't be rated.</p>}
      </aside>

      {result && (
        <div className="modal-bg">
          <div className="modal">
            <h2>{result.score === 1 ? 'You won! 🎉' : result.score === 0 ? 'You lost' : 'Draw'}</h2>
            <p className="muted">by {result.termination}</p>
            {result.rated ? (
              <p className="rating-change">
                {Math.round(result.before)} → <b>{Math.round(result.after)}</b>{' '}
                <span className={result.after >= result.before ? 'pos' : 'neg'}>
                  ({result.after >= result.before ? '+' : ''}
                  {Math.round(result.after - result.before)})
                </span>
              </p>
            ) : (
              <p className="muted">Unrated game</p>
            )}
            <div className="row">
              <button className="btn" onClick={() => nav({ name: 'review', gameId: result.gameId })}>Review game</button>
              <button className="btn primary" onClick={onNewGame}>New game</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerLine({ name, sub, diff, avatar }: { name: string; sub: string; diff: number; avatar: string }) {
  return (
    <div className="player-line">
      <span className="avatar">{avatar}</span>
      <b>{name}</b>
      <span className="muted small">{sub}</span>
      {diff > 0 && <span className="material">+{diff}</span>}
    </div>
  );
}

export function MoveList({ history, startsWithBlack = false, current, onSelect, marks }: {
  history: string[];
  startsWithBlack?: boolean;
  current?: number;
  onSelect?: (ply: number) => void;
  marks?: (string | undefined)[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (current === undefined) ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [history.length, current]);
  const plies = startsWithBlack ? [null, ...history] : history;
  const rows: { n: number; w: number | null; b: number | null }[] = [];
  for (let i = 0; i < plies.length; i += 2) {
    const wi = plies[i] === null ? null : startsWithBlack ? i - 1 : i;
    const bi = i + 1 < plies.length ? (startsWithBlack ? i : i + 1) : null;
    rows.push({ n: i / 2 + 1, w: wi, b: bi });
  }
  const cell = (ply: number | null) =>
    ply === null ? (
      <span className="mv" />
    ) : (
      <span className={`mv ${current === ply ? 'cur' : ''} ${onSelect ? 'click' : ''}`} onClick={() => onSelect?.(ply)}>
        {history[ply]}
        {marks?.[ply] && <span className={`mark ${marks[ply]}`}>{markGlyph(marks[ply]!)}</span>}
      </span>
    );
  return (
    <div className="movelist" ref={ref}>
      {rows.length === 0 && <span className="muted small">No moves yet.</span>}
      {rows.map((r) => (
        <div key={r.n} className="mvrow">
          <span className="mvn">{r.n}.</span>
          {cell(r.w)}
          {cell(r.b)}
        </div>
      ))}
    </div>
  );
}

function markGlyph(m: string) {
  return { blunder: '??', mistake: '?', inaccuracy: '?!', best: '★' }[m] ?? '';
}

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function materialDiff(chess: Chess): number {
  let d = 0;
  for (const row of chess.board()) for (const sq of row) if (sq) d += (sq.color === 'w' ? 1 : -1) * VALUES[sq.type];
  return d;
}

function buildPgn(g: ActiveGame, moves: string[], name: string, score: number): string {
  const c = new Chess(g.startFen);
  for (const m of moves) playUci(c, m);
  const human = name;
  const bot = `Stockfish ${g.botRating}`;
  const res = score === 0.5 ? '1/2-1/2' : (score === 1) === (g.color === 'w') ? '1-0' : '0-1';
  c.setHeader('Event', g.rated ? 'Rated game' : 'Casual game');
  c.setHeader('Date', new Date(g.startedAt).toISOString().slice(0, 10).replace(/-/g, '.'));
  c.setHeader('White', g.color === 'w' ? human : bot);
  c.setHeader('Black', g.color === 'b' ? human : bot);
  c.setHeader('Result', res);
  return c.pgn();
}
