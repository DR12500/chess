import { describe, expect, it } from 'vitest';
import { expectedScore, newRating, updateRating, decayRd } from '../src/lib/glicko2';

describe('glicko2', () => {
  it('matches the worked example in Glickman\'s paper (first opponent only, sanity of direction)', () => {
    // Paper example: player 1500/200/0.06 vs 1400/30 (W), 1550/100 (L), 1700/300 (L) => 1464.06 / 151.52
    // Our implementation rates game-by-game, so check the single-game building blocks instead:
    const p = { rating: 1500, rd: 200, vol: 0.06 };
    const afterWin = updateRating(p, { rating: 1400, rd: 30, vol: 0.06 }, 1);
    expect(afterWin.rating).toBeGreaterThan(1500);
    expect(afterWin.rd).toBeLessThan(200);
  });

  it('equal players: win and loss are symmetric', () => {
    const a = newRating(1200);
    const win = updateRating(a, { rating: 1200, rd: 60, vol: 0.06 }, 1);
    const loss = updateRating(a, { rating: 1200, rd: 60, vol: 0.06 }, 0);
    expect(win.rating - 1200).toBeCloseTo(1200 - loss.rating, 5);
    const draw = updateRating(a, { rating: 1200, rd: 60, vol: 0.06 }, 0.5);
    expect(draw.rating).toBeCloseTo(1200, 5);
  });

  it('new players move a lot, established players move little (like chess.com)', () => {
    const fresh = updateRating(newRating(800), { rating: 800, rd: 60, vol: 0.06 }, 1);
    const settled = updateRating({ rating: 800, rd: 50, vol: 0.06 }, { rating: 800, rd: 60, vol: 0.06 }, 1);
    expect(fresh.rating - 800).toBeGreaterThan(100);
    expect(settled.rating - 800).toBeGreaterThan(3);
    expect(settled.rating - 800).toBeLessThan(15);
  });

  it('expected score follows the 400-point logistic curve', () => {
    const e = expectedScore({ rating: 1600, rd: 0.0001, vol: 0.06 }, { rating: 1200, rd: 0.0001, vol: 0.06 });
    expect(e).toBeCloseTo(1 / (1 + Math.pow(10, -1)), 2); // ~0.91
  });

  it('beating a much weaker bot gains little, losing to it costs a lot', () => {
    const p = { rating: 1500, rd: 60, vol: 0.06 };
    const weak = { rating: 1100, rd: 60, vol: 0.06 };
    expect(updateRating(p, weak, 1).rating - 1500).toBeLessThan(3);
    expect(1500 - updateRating(p, weak, 0).rating).toBeGreaterThan(10);
  });

  it('RD grows with inactivity', () => {
    const r = { rating: 1500, rd: 50, vol: 0.06 };
    expect(decayRd(r, 365 * 24 * 3600 * 1000).rd).toBeGreaterThan(55);
  });
});
