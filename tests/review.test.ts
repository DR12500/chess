import { describe, expect, it } from 'vitest';
import { CLASS_INFO, PositionEval, PlyInfo, accuracy, classifyMoves, countBookPlies, epLoss } from '../src/lib/review';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const ply = (uci: string, color: 'w' | 'b' = 'w', fenBefore = START): PlyInfo => ({ uci, color, fenBefore, san: uci });
/** Evals for one white move: position before (white to move) and after (black to move). */
const pair = (before: number, afterFromBlack: number, best = 'e2e4', second?: { move: string; score: number }): PositionEval[] => [
  { score: before, best, second: second ?? null },
  { score: afterFromBlack, best: null },
];

describe('move classification (chess.com expected-points bands)', () => {
  it("the engine's move is Best", () => {
    expect(classifyMoves([ply('e2e4')], pair(30, -30))).toEqual(['best']);
  });

  it('a different move that loses nothing is not automatically Best when it is worse', () => {
    // loses ~1.4% expected points → Excellent, not Best
    expect(classifyMoves([ply('a2a3')], pair(15, 0))).toEqual(['excellent']);
  });

  it('maps losses to Good / Inaccuracy / Mistake / Blunder', () => {
    const cls = (afterFromBlack: number) => classifyMoves([ply('a2a3')], pair(0, afterFromBlack))[0];
    expect(cls(25)).toBe('good'); // ~2.3%
    expect(cls(60)).toBe('inaccuracy'); // ~5.5%
    expect(cls(150)).toBe('mistake'); // ~13.6%
    expect(cls(400)).toBe('blunder'); // ~31%
  });

  it('an equally good second engine move counts as Best', () => {
    expect(classifyMoves([ply('d2d4')], pair(30, -28, 'e2e4', { move: 'd2d4', score: 28 }))).toEqual(['best']);
  });

  it('Great: the only move that keeps the balance', () => {
    expect(classifyMoves([ply('e2e4')], pair(0, 0, 'e2e4', { move: 'd2d4', score: -300 }))).toEqual(['great']);
  });

  it('Brilliant: a sound piece sacrifice', () => {
    const fen = '4k3/8/3p4/8/2N5/8/8/4K3 w - - 0 1'; // Ne5 puts the knight en prise to the d6 pawn
    expect(classifyMoves([ply('c4e5', 'w', fen)], pair(0, 0, 'c4e5'))).toEqual(['brilliant']);
  });

  it("Miss: not punishing the opponent's blunder", () => {
    const evals: PositionEval[] = [
      { score: 0, best: 'e2e4' }, // white to move, equal
      { score: 400, best: 'e7e5' }, // after white's blunder: black to move, +4
      { score: -200, best: 'x' }, // after black's reply: white to move, black only +2 now
    ];
    expect(classifyMoves([ply('a2a3'), ply('a7a6', 'b')], evals)).toEqual(['blunder', 'miss']);
  });

  it('every class has a visible glyph', () => {
    for (const info of Object.values(CLASS_INFO)) expect(info.glyph.length).toBeGreaterThan(0);
  });

  it('book plies follow a known opening line', () => {
    expect(countBookPlies(['e4', 'e5', 'Nf3', 'Nc6', 'h4'], [['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], ['d4']])).toBe(4);
    expect(classifyMoves([ply('e2e4')], pair(30, 500), 1)).toEqual(['book']);
  });

  it('epLoss is never negative', () => {
    expect(epLoss(pair(0, -200), 0)).toBe(0);
  });
});

describe('accuracy (Lichess method)', () => {
  /** Alternating game where each side's moves keep the eval, except listed blunders. */
  function game(n: number, blunders: number[]) {
    const colors: ('w' | 'b')[] = [];
    const evals: PositionEval[] = [{ score: 0, best: null }];
    let white = 0; // eval from white's view
    for (let i = 0; i < n; i++) {
      const c = i % 2 === 0 ? 'w' : 'b';
      colors.push(c);
      if (blunders.includes(i)) white += c === 'w' ? -500 : 500;
      const toMove = c === 'w' ? 'b' : 'w';
      evals.push({ score: toMove === 'w' ? white : -white, best: null });
    }
    return { colors, evals };
  }

  it('perfect play is 100%', () => {
    const g = game(40, []);
    expect(accuracy(g.colors, g.evals).white).toBeCloseTo(100, 0);
  });

  it('two blunders pull accuracy far below a simple average', () => {
    const g = game(40, [10, 30]); // two white blunders among 20 white moves
    const a = accuracy(g.colors, g.evals).white;
    expect(a).toBeLessThan(80); // a plain mean would give ~90%
    expect(a).toBeGreaterThan(20);
  });
});
