import { winPercent } from './chessUtil';

/** Engine evaluation of a position, from the side to move, plus its best move. */
export interface PositionEval {
  score: number;
  best: string | null;
}

export type MoveClass = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/**
 * Win-percentage lost by the mover on each ply (Lichess-style thresholds:
 * ≥10% inaccuracy, ≥20% mistake, ≥30% blunder).
 * evals[i] is the position before ply i; evals[i+1] after it.
 */
export function winLoss(evals: PositionEval[], i: number): number {
  const before = winPercent(evals[i].score); // mover's perspective
  const after = 100 - winPercent(evals[i + 1].score); // opponent to move after the ply
  return Math.max(0, before - after);
}

export function classifyMoves(colors: ('w' | 'b')[], evals: PositionEval[], playedUci?: string[]): MoveClass[] {
  return colors.map((_, i) => {
    const loss = winLoss(evals, i);
    if (playedUci && playedUci[i] === evals[i].best) return 'best';
    if (loss >= 30) return 'blunder';
    if (loss >= 20) return 'mistake';
    if (loss >= 10) return 'inaccuracy';
    if (loss < 2) return 'best';
    return 'good';
  });
}

/** Lichess-style accuracy per side (mean of per-move accuracies). */
export function accuracy(colors: ('w' | 'b')[], evals: PositionEval[]): { white: number; black: number } {
  const acc = { w: [] as number[], b: [] as number[] };
  colors.forEach((c, i) => {
    const loss = winLoss(evals, i);
    acc[c].push(Math.min(100, Math.max(0, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669)));
  });
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 100);
  return { white: mean(acc.w), black: mean(acc.b) };
}
