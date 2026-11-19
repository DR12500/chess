/**
 * Game review: move classification and accuracy, modelled on chess.com's Game Review.
 *
 * chess.com classifies a move by how many "expected points" (0 = lost, 0.5 = equal, 1 = won)
 * it gives away compared with the engine's best move:
 *   Best = engine's top move · Excellent ≤ 0.02 · Good ≤ 0.05 · Inaccuracy ≤ 0.10 ·
 *   Mistake ≤ 0.20 · Blunder > 0.20
 * plus special labels: Book (known opening theory), Great (the only good move),
 * Brilliant (a good piece sacrifice) and Miss (failing to punish the opponent's error).
 * Expected points are approximated with Lichess's win-probability curve.
 */
import { Chess, Square } from 'chess.js';
import { winPercent } from './chessUtil';

/** Engine evaluation of a position (side to move's view) with its best two moves. */
export interface PositionEval {
  score: number; // best line, centipawns (mate ≈ ±100000)
  best: string | null; // UCI
  second?: { move: string; score: number } | null; // 2nd-best line (MultiPV 2)
}

export type MoveClass =
  | 'book'
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export const CLASS_INFO: Record<MoveClass, { label: string; glyph: string }> = {
  book: { label: 'Book', glyph: '📖' },
  brilliant: { label: 'Brilliant', glyph: '!!' },
  great: { label: 'Great', glyph: '!' },
  best: { label: 'Best', glyph: '★' },
  excellent: { label: 'Excellent', glyph: '👍' },
  good: { label: 'Good', glyph: '✓' },
  inaccuracy: { label: 'Inaccuracy', glyph: '?!' },
  mistake: { label: 'Mistake', glyph: '?' },
  miss: { label: 'Miss', glyph: '✗' },
  blunder: { label: 'Blunder', glyph: '??' },
};

/** Expected points (0..1) for the side to move. */
const ep = (cp: number) => winPercent(cp) / 100;

/** Expected points the mover gave away with ply i (0 = as good as the best move). */
export function epLoss(evals: PositionEval[], i: number): number {
  const before = ep(evals[i].score); // mover's view, assuming best play
  const after = 1 - ep(evals[i + 1].score); // after the move it's the opponent's turn
  return Math.max(0, before - after);
}

export interface PlyInfo {
  uci: string;
  color: 'w' | 'b';
  fenBefore: string;
  san: string;
}

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Did this move leave a piece (knight or bigger) en prise: capturable for less, or undefended? */
function isSacrifice(ply: PlyInfo): boolean {
  const c = new Chess(ply.fenBefore);
  const mv = c.move({ from: ply.uci.slice(0, 2), to: ply.uci.slice(2, 4), promotion: ply.uci[4] || undefined });
  const moved = VALUES[mv.promotion ?? mv.piece];
  if (moved < 3) return false;
  const gained = mv.captured ? VALUES[mv.captured] : 0;
  const to = mv.to as Square;
  const captures = c.moves({ verbose: true }).filter((m) => m.to === to && m.captured);
  if (captures.length === 0) return false;
  const cheapest = Math.min(...captures.map((m) => VALUES[m.piece]));
  const defended = c.isAttacked(to, mv.color);
  // Net material given away if the opponent takes: must be at least a minor piece's worth.
  const loss = defended ? moved - cheapest : moved;
  return loss - gained >= 2;
}

export function classifyMoves(plies: PlyInfo[], evals: PositionEval[], bookPlies = 0): MoveClass[] {
  const out: MoveClass[] = [];
  plies.forEach((ply, i) => {
    if (i < bookPlies) {
      out.push('book');
      return;
    }
    const e = evals[i];
    const loss = epLoss(evals, i);
    const second = e.second;
    // Centipawns lost versus the engine's best line. Expected points saturate in decided
    // positions, so "Best" also requires being (almost) exactly as good in centipawns.
    const cpLoss = e.score - -evals[i + 1].score;
    const isTop =
      ply.uci === e.best ||
      // An equally good alternative (within 10 centipawns) also counts as best.
      (!!second && ply.uci === second.move && e.score - second.score <= 10) ||
      cpLoss <= 10;

    let cls: MoveClass;
    if (isTop) cls = 'best';
    else if (loss <= 0.02) cls = 'excellent';
    else if (loss <= 0.05) cls = 'good';
    else if (loss <= 0.1) cls = 'inaccuracy';
    else if (loss <= 0.2) cls = 'mistake';
    else cls = 'blunder';

    const before = ep(e.score);
    // Great: the best move when the second-best throws away a lot (an "only move"),
    // and the position isn't already completely decided.
    if (cls === 'best' && second && before - ep(second.score) >= 0.15 && before > 0.1 && before < 0.95) cls = 'great';
    // Brilliant: a (near-)best move that sacrifices a piece and keeps a good position.
    if ((cls === 'best' || cls === 'great' || cls === 'excellent') && before < 0.95 && 1 - ep(evals[i + 1].score) >= 0.5 && isSacrifice(ply)) {
      cls = 'brilliant';
    }
    // Miss: the opponent just erred and this move fails to take advantage of it.
    const prev = out[i - 1];
    if ((prev === 'mistake' || prev === 'blunder') && (cls === 'inaccuracy' || cls === 'mistake')) cls = 'miss';
    out.push(cls);
  });
  return out;
}

/** Number of opening plies that follow a known opening line from `lines` (each a SAN list). */
export function countBookPlies(sans: string[], lines: string[][]): number {
  let n = 0;
  for (const line of lines) {
    let k = 0;
    while (k < sans.length && k < line.length && sans[k] === line[k]) k++;
    n = Math.max(n, k);
  }
  return n;
}

/**
 * Game accuracy per side, as Lichess computes it (lila AccuracyPercent):
 * per-move accuracy from the drop in win%, then the average of
 *  (a) a mean weighted by how volatile the position was, and
 *  (b) the harmonic mean, which punishes a few bad moves strongly.
 * A plain average would be far too generous (most moves in any game are easy).
 */
export function accuracy(colors: ('w' | 'b')[], evals: PositionEval[]): { white: number; black: number } {
  const n = colors.length;
  if (n === 0) return { white: 100, black: 100 };
  // Win% from White's point of view for every position (start .. end).
  const whiteWin = evals.slice(0, n + 1).map((e, i) => {
    const toMove = i < n ? colors[i] : colors[n - 1] === 'w' ? 'b' : 'w';
    return winPercent(toMove === 'w' ? e.score : -e.score);
  });

  const ws = Math.min(8, Math.max(2, Math.floor(n / 10)));
  const windows: number[][] = [];
  for (let k = 0; k < Math.min(ws, whiteWin.length) - 2; k++) windows.push(whiteWin.slice(0, ws));
  for (let k = 0; k + ws <= whiteWin.length; k++) windows.push(whiteWin.slice(k, k + ws));
  const stdDev = (xs: number[]) => {
    const m = xs.reduce((s, x) => s + x, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / xs.length);
  };
  const weights = windows.map((w) => Math.min(12, Math.max(0.5, stdDev(w))));

  const per = { w: [] as { acc: number; weight: number }[], b: [] as { acc: number; weight: number }[] };
  colors.forEach((c, i) => {
    const before = c === 'w' ? whiteWin[i] : 100 - whiteWin[i];
    const after = c === 'w' ? whiteWin[i + 1] : 100 - whiteWin[i + 1];
    const acc = after >= before ? 100 : Math.min(100, Math.max(0, 103.1668 * Math.exp(-0.04354 * (before - after)) - 3.1669 + 1));
    per[c].push({ acc, weight: weights[i] ?? 1 });
  });

  const combine = (xs: { acc: number; weight: number }[]) => {
    if (xs.length === 0) return 100;
    const weighted = xs.reduce((s, x) => s + x.acc * x.weight, 0) / xs.reduce((s, x) => s + x.weight, 0);
    const harmonic = xs.length / xs.reduce((s, x) => s + 1 / Math.max(1, x.acc), 0);
    return (weighted + harmonic) / 2;
  };
  return { white: combine(per.w), black: combine(per.b) };
}
