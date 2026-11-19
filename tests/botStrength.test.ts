import { describe, expect, it } from 'vitest';
import { botConfigFor, pickWeakMove, SF_MIN_ELO } from '../src/lib/botStrength';

describe('botConfigFor', () => {
  it('uses Stockfish UCI_Elo from 1320 up, clamped to 3190', () => {
    expect(botConfigFor(1500)).toEqual({ kind: 'limit', rating: 1500, uciElo: 1500 });
    expect(botConfigFor(SF_MIN_ELO).kind).toBe('limit');
    expect(botConfigFor(5000)).toMatchObject({ uciElo: 3190 });
  });

  it('weak bot gets monotonically stronger as rating rises', () => {
    let prev = botConfigFor(100);
    for (let r = 150; r < SF_MIN_ELO; r += 50) {
      const c = botConfigFor(r);
      if (c.kind !== 'weak' || prev.kind !== 'weak') throw new Error('expected weak');
      expect(c.depth).toBeGreaterThanOrEqual(prev.depth);
      expect(c.randomChance).toBeLessThanOrEqual(prev.randomChance);
      expect(c.temperature).toBeLessThanOrEqual(prev.temperature);
      prev = c;
    }
  });

  it('never goes below 100', () => {
    expect(botConfigFor(-50).rating).toBe(100);
  });
});

describe('pickWeakMove', () => {
  const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };
  const cfg = { kind: 'weak' as const, rating: 800, depth: 3, multipv: 5, randomChance: 0.1, temperature: 100 };
  const cands = [{ move: 'e2e4', score: 50 }, { move: 'a2a3', score: -300 }];

  it('plays a random legal move when the dice say so', () => {
    expect(pickWeakMove(cands, ['h2h3', 'g2g4'], cfg, seq(0.05, 0.6))).toBe('g2g4');
  });

  it('strongly prefers the best candidate', () => {
    let best = 0;
    let r = 1;
    const rng = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    for (let i = 0; i < 2000; i++) if (pickWeakMove(cands, ['e2e4', 'a2a3'], cfg, rng) === 'e2e4') best++;
    expect(best / 2000).toBeGreaterThan(0.85);
  });
});
