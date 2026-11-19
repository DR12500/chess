import { describe, expect, it } from 'vitest';
import { computeStats, mergeDocs, newProfile, SyncDoc, GameRecord } from '../src/lib/model';

const game = (id: string, ts: number, score: 1 | 0 | 0.5, botRating = 800): GameRecord =>
  ({ id, ts, color: 'w', botRating, score, rated: true, termination: 'checkmate', pgn: '' });

describe('merge + derived ratings', () => {
  it('merging games played offline on two devices gives the same rating as playing them on one', () => {
    const base = newProfile('A', 800);
    const t = base.createdAt;
    const pc = { ...base, games: [game('g1', t + 1, 1), game('g3', t + 3, 0)] };
    const ipad = { ...base, games: [game('g2', t + 2, 1)] };
    const docA: SyncDoc = { version: 1, profiles: { [base.id]: pc } };
    const docB: SyncDoc = { version: 1, profiles: { [base.id]: ipad } };
    const ab = mergeDocs(docA, docB).profiles[base.id];
    const ba = mergeDocs(docB, docA).profiles[base.id];
    expect(ab.games.map((g) => g.id)).toEqual(['g1', 'g2', 'g3']);
    const single = { ...base, games: [game('g1', t + 1, 1), game('g2', t + 2, 1), game('g3', t + 3, 0)] };
    expect(computeStats(ab, t + 10).game.rating).toBeCloseTo(computeStats(single, t + 10).game.rating, 8);
    expect(computeStats(ba, t + 10).game.rating).toBeCloseTo(computeStats(single, t + 10).game.rating, 8);
  });

  it('merge is idempotent and keeps newer name / deletion', () => {
    const p = newProfile('Old', 800);
    const renamed = { ...p, name: 'New', updatedAt: p.updatedAt + 5 };
    const a: SyncDoc = { version: 1, profiles: { [p.id]: p } };
    const b: SyncDoc = { version: 1, profiles: { [p.id]: renamed } };
    const m = mergeDocs(a, b);
    expect(m.profiles[p.id].name).toBe('New');
    expect(mergeDocs(m, m)).toEqual(m);
    const del = { ...renamed, deleted: true, updatedAt: renamed.updatedAt + 1 };
    expect(mergeDocs(m, { version: 1, profiles: { [p.id]: del } }).profiles[p.id].deleted).toBe(true);
  });

  it('unrated games count for W/D/L but not rating', () => {
    const p = newProfile('A', 1000);
    p.games = [{ ...game('x', p.createdAt + 1, 1), rated: false }];
    const s = computeStats(p, p.createdAt + 2);
    expect(s.wins).toBe(1);
    expect(Math.round(s.game.rating)).toBe(1000);
  });
});
