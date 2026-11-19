import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { LESSONS } from '../src/content/lessons';
import { OPENINGS } from '../src/content/openings';
import puzzles from '../public/puzzles.json';

function play(chess: Chess, uci: string) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

describe('lessons', () => {
  for (const lesson of LESSONS) {
    lesson.steps.forEach((step, i) => {
      if (!step.fen) return;
      it(`${lesson.id} step ${i + 1} is legal`, () => {
        const chess = new Chess(step.fen!); // throws on invalid FEN
        for (const mv of step.line ?? step.demo ?? []) {
          expect(() => play(chess, mv), `${lesson.id}#${i + 1} move ${mv}`).not.toThrow();
        }
        // Tasks whose text says "mate" must end in checkmate.
        if (step.line && /Task:.*\bmate\b/i.test(step.text) && !/stop the mate|stalemate/i.test(step.text)) {
          expect(chess.isCheckmate(), `${lesson.id}#${i + 1} should end in mate`).toBe(true);
        }
      });
    });
  }
  it('lesson ids are unique', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });
});

describe('openings', () => {
  for (const o of OPENINGS) {
    it(`${o.name} main line is legal`, () => {
      const chess = new Chess();
      for (const san of o.moves.split(' ')) expect(() => chess.move(san), `${o.id}: ${san}`).not.toThrow();
    });
  }
});

describe('puzzles.json', () => {
  it('first 300 puzzles replay legally', () => {
    for (const [id, fen, moves] of (puzzles as { puzzles: [string, string, string][] }).puzzles.slice(0, 300)) {
      const chess = new Chess(fen);
      for (const m of moves.split(' ')) expect(() => play(chess, m), id).not.toThrow();
    }
  });
});
