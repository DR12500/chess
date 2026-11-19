import { describe, expect, it } from 'vitest';
import {
  RATING_PRESETS,
  RatingConfig,
  decayRd,
  expectedScore,
  glickoPeriod,
  newRating,
  previewChanges,
  updateRating,
} from '../src/lib/rating';

const preset = (id: string): RatingConfig => RATING_PRESETS.find((p) => p.id === id)!.config;
const equalBot = { rating: 1200, rd: 60 };

describe('Glicko-1', () => {
  it("matches Glickman's worked example (1500/200 vs 1400/30 W, 1550/100 L, 1700/300 L)", () => {
    const r = glickoPeriod(1500, 200, [
      { r: 1400, rd: 30, s: 1 },
      { r: 1550, rd: 100, s: 0 },
      { r: 1700, rd: 300, s: 0 },
    ]);
    expect(r.rating).toBeCloseTo(1464, 0);
    expect(r.rd).toBeCloseTo(151.4, 0);
  });

  it('win and loss against an equal opponent are symmetric; draw changes nothing', () => {
    const cfg = preset('chesscom');
    const p = newRating(1200, cfg);
    const c = previewChanges(p, equalBot, cfg);
    expect(c.win).toBeCloseTo(-c.loss, 6);
    expect(c.draw).toBeCloseTo(0, 6);
  });

  it('chess.com-like preset: ~±75 on the first game, ~±8 after 40 games', () => {
    const cfg = preset('chesscom');
    let p = newRating(1200, cfg);
    expect(previewChanges(p, equalBot, cfg).win).toBeGreaterThan(65);
    expect(previewChanges(p, equalBot, cfg).win).toBeLessThan(85);
    for (let i = 0; i < 40; i++) p = updateRating(p, equalBot, i % 2, cfg);
    const w = previewChanges(p, equalBot, cfg).win;
    expect(w).toBeGreaterThan(6.5);
    expect(w).toBeLessThan(10);
  });

  it('presets are ordered from calm to fast on the first game', () => {
    const first = (id: string) => previewChanges(newRating(1200, preset(id)), equalBot, preset(id)).win;
    expect(first('calm')).toBeLessThan(first('chesscom'));
    expect(first('chesscom')).toBeLessThan(first('fast'));
    expect(first('fast')).toBeGreaterThan(150);
  });

  it('beating a much weaker bot gains little, losing to it costs a lot', () => {
    const cfg = preset('chesscom');
    const p = { rating: 1500, rd: 60, games: 50 };
    const c = previewChanges(p, { rating: 1100, rd: 60 }, cfg);
    expect(c.win).toBeLessThan(2);
    expect(-c.loss).toBeGreaterThan(10);
  });

  it('RD grows with inactivity but never above the starting RD', () => {
    const cfg = preset('chesscom');
    const r = { rating: 1500, rd: 55, games: 50 };
    expect(decayRd(r, 365 * 24 * 3600 * 1000, cfg).rd).toBeGreaterThan(100);
    expect(decayRd(r, 50 * 365 * 24 * 3600 * 1000, cfg).rd).toBe(cfg.startRd);
  });
});

describe('Elo', () => {
  it('K=20: ±10 against an equal opponent, always', () => {
    const cfg = preset('fide');
    let p = newRating(1200, cfg);
    for (let i = 0; i < 20; i++) p = updateRating(p, { rating: p.rating, rd: 60 }, 1, cfg);
    expect(previewChanges(p, { rating: p.rating, rd: 60 }, cfg).win).toBeCloseTo(10, 6);
  });

  it('expected score follows the 400-point logistic curve', () => {
    expect(expectedScore(1600, 1200)).toBeCloseTo(1 / (1 + Math.pow(10, -1)), 6);
  });
});
