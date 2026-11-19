/**
 * Rating systems.
 *
 * - Glicko (Glicko-1, Mark Glickman 1995): the system chess.com uses. Besides the rating
 *   every player has a rating deviation (RD) = uncertainty. High RD → big rating changes.
 *   Each game is applied as its own rating period. RD grows again during inactivity.
 * - Elo: the classic FIDE-style formula with a fixed K-factor.
 *
 * How "drastic" ratings move is configurable per account (RatingConfig, synced).
 */

export interface Rating {
  rating: number;
  rd: number; // only meaningful for Glicko; Elo keeps it fixed
  games: number;
}

export type RatingSystem = 'glicko' | 'elo';

export interface RatingConfig {
  system: RatingSystem;
  /** Glicko: RD of a new account. Higher = faster early movement. */
  startRd: number;
  /** Glicko: RD never drops below this. Higher = larger changes for established players. */
  minRd: number;
  /** Elo: K-factor. FIDE uses 40 (new), 20 (standard), 10 (elite). */
  k: number;
}

export const MAX_RD = 350;
/** RD growth per 30 days of inactivity (Glicko's "c"): 50 → 350 takes ~8 years. */
const C_PER_MONTH = 35;
const Q = Math.LN10 / 400;

export const RATING_PRESETS: { id: string; label: string; desc: string; config: RatingConfig }[] = [
  {
    id: 'calm',
    label: 'Calm',
    desc: 'Small changes from the very first game; good if your starting level is accurate.',
    config: { system: 'glicko', startRd: 110, minRd: 40, k: 20 },
  },
  {
    id: 'chesscom',
    label: 'Chess.com-like',
    desc: 'Glicko like chess.com: big moves at first, about ±12 after 20 games and ±8 from ~40 games.',
    config: { system: 'glicko', startRd: 185, minRd: 55, k: 20 },
  },
  {
    id: 'fast',
    label: 'Fast (new account)',
    desc: 'Maximum uncertainty (RD 350) like a brand-new online account: very large early swings.',
    config: { system: 'glicko', startRd: 350, minRd: 55, k: 20 },
  },
  {
    id: 'fide',
    label: 'Classic Elo (K=20)',
    desc: 'FIDE-style fixed K-factor: always ±10 against an equal opponent.',
    config: { system: 'elo', startRd: 185, minRd: 55, k: 20 },
  },
];

export const DEFAULT_RATING_CONFIG: RatingConfig = RATING_PRESETS[1].config;

export function presetIdFor(c: RatingConfig): string {
  const p = RATING_PRESETS.find(
    (x) => x.config.system === c.system && (c.system === 'elo' ? x.config.k === c.k : x.config.startRd === c.startRd && x.config.minRd === c.minRd),
  );
  return p?.id ?? 'custom';
}

export function newRating(rating: number, cfg: RatingConfig): Rating {
  return { rating, rd: cfg.system === 'glicko' ? clampRd(cfg.startRd, cfg) : cfg.startRd, games: 0 };
}

function clampRd(rd: number, cfg: RatingConfig) {
  return Math.min(MAX_RD, Math.max(cfg.minRd, rd));
}

const g = (rd: number) => 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));

/** Expected score of a player against an opponent (Glicko form; reduces to Elo when RDs are 0). */
export function expectedScore(r: number, opp: number, oppRd = 0): number {
  return 1 / (1 + Math.pow(10, (-g(oppRd) * (r - opp)) / 400));
}

/**
 * Glicko-1 update for one rating period containing one or more games.
 * Exposed separately so it can be tested against Glickman's worked example.
 */
export function glickoPeriod(r: number, rd: number, games: { r: number; rd: number; s: number }[]): { rating: number; rd: number } {
  let dInv = 0;
  let sum = 0;
  for (const o of games) {
    const gj = g(o.rd);
    const e = expectedScore(r, o.r, o.rd);
    dInv += Q * Q * gj * gj * e * (1 - e);
    sum += gj * (o.s - e);
  }
  const denom = 1 / (rd * rd) + dInv;
  return { rating: r + (Q / denom) * sum, rd: Math.sqrt(1 / denom) };
}

/** Update after one game. score: 1 win, 0.5 draw, 0 loss. */
export function updateRating(p: Rating, opp: { rating: number; rd: number }, score: number, cfg: RatingConfig): Rating {
  if (cfg.system === 'elo') {
    const e = expectedScore(p.rating, opp.rating);
    return { rating: p.rating + cfg.k * (score - e), rd: p.rd, games: p.games + 1 };
  }
  const res = glickoPeriod(p.rating, clampRd(p.rd, cfg), [{ r: opp.rating, rd: opp.rd, s: score }]);
  return { rating: res.rating, rd: clampRd(res.rd, cfg), games: p.games + 1 };
}

/** Glicko: RD grows while inactive (never above the account's starting RD). */
export function decayRd(p: Rating, idleMs: number, cfg: RatingConfig): Rating {
  if (cfg.system === 'elo' || idleMs <= 0) return p;
  const months = idleMs / (30 * 24 * 3600 * 1000);
  const rd = Math.sqrt(p.rd * p.rd + C_PER_MONTH * C_PER_MONTH * months);
  return { ...p, rd: Math.min(Math.max(cfg.startRd, cfg.minRd), rd) };
}

/** Rating change for a win / draw / loss against an opponent, for previews in the UI. */
export function previewChanges(p: Rating, opp: { rating: number; rd: number }, cfg: RatingConfig) {
  const d = (s: number) => updateRating(p, opp, s, cfg).rating - p.rating;
  return { win: d(1), draw: d(0.5), loss: d(0) };
}

export function isProvisional(p: Rating, cfg: RatingConfig): boolean {
  return cfg.system === 'glicko' ? p.rd > 110 : p.games < 10;
}
