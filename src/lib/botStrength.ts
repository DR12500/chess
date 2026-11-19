/**
 * Maps a target rating to Stockfish settings.
 *
 * - 1320 and above: Stockfish's own UCI_LimitStrength + UCI_Elo. Its Elo scale is
 *   calibrated by the Stockfish team (anchored to CCRL 40/4, calibrated at 60s+0.6s;
 *   minimum 1320, maximum 3190). To stay close to that calibration we give the engine a
 *   virtual 60s+0.6s clock, regardless of how long the human thinks.
 * - Below 1320 Stockfish has no Elo setting, so we weaken it ourselves: Skill Level 0,
 *   shallow search, MultiPV candidates picked with a "softmax" (worse moves get picked
 *   more often at lower ratings), plus an occasional random move. These anchor values are
 *   our own estimates (in the spirit of chess.com's low bots and Lichess's AI levels),
 *   not a measured calibration.
 */

export const SF_MIN_ELO = 1320;
export const SF_MAX_ELO = 3190;
export const BOT_MIN = 100;
export const BOT_MAX = SF_MAX_ELO;
/** Assumed rating deviation of the bot in Glicko updates (it's a known, fixed strength). */
export const BOT_RD = 60;

export type BotConfig =
  | { kind: 'limit'; rating: number; uciElo: number }
  | {
      kind: 'weak';
      rating: number;
      depth: number;
      multipv: number;
      /** Chance per move to play a random legal move instead. */
      randomChance: number;
      /** Softmax temperature in centipawns: higher = more likely to pick worse candidates. */
      temperature: number;
    };

/** [rating, depth, randomChance, temperature] */
const WEAK_ANCHORS: [number, number, number, number][] = [
  [100, 1, 0.55, 400],
  [400, 2, 0.3, 250],
  [700, 3, 0.18, 160],
  [1000, 4, 0.09, 100],
  [1319, 6, 0.03, 50],
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function clampBotRating(r: number): number {
  return Math.round(Math.min(BOT_MAX, Math.max(BOT_MIN, r)));
}

export function botConfigFor(target: number): BotConfig {
  const rating = clampBotRating(target);
  if (rating >= SF_MIN_ELO) return { kind: 'limit', rating, uciElo: rating };
  let i = 0;
  while (i < WEAK_ANCHORS.length - 2 && rating > WEAK_ANCHORS[i + 1][0]) i++;
  const [r0, d0, p0, t0] = WEAK_ANCHORS[i];
  const [r1, d1, p1, t1] = WEAK_ANCHORS[i + 1];
  const t = Math.min(1, Math.max(0, (rating - r0) / (r1 - r0)));
  return {
    kind: 'weak',
    rating,
    depth: Math.round(lerp(d0, d1, t)),
    multipv: 5,
    randomChance: lerp(p0, p1, t),
    temperature: lerp(t0, t1, t),
  };
}

export interface Candidate {
  move: string; // UCI
  /** Score from the side to move, in centipawns (mate converted to ±(100000 - plies)). */
  score: number;
}

/**
 * Choose a move for the "weak" bot. Pure function so it can be tested with a seeded rng.
 */
export function pickWeakMove(
  candidates: Candidate[],
  legalMoves: string[],
  cfg: Extract<BotConfig, { kind: 'weak' }>,
  rng: () => number = Math.random,
): string {
  if (legalMoves.length === 0) throw new Error('no legal moves');
  if (candidates.length === 0 || rng() < cfg.randomChance) {
    return legalMoves[Math.floor(rng() * legalMoves.length)];
  }
  const best = Math.max(...candidates.map((c) => c.score));
  const weights = candidates.map((c) => Math.exp((Math.max(c.score - best, -3000)) / cfg.temperature));
  const total = weights.reduce((s, w) => s + w, 0);
  let x = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    x -= weights[i];
    if (x <= 0) return candidates[i].move;
  }
  return candidates[0].move;
}

/** Bot target rating for a player, given the chosen difficulty offset. */
export function botTargetFor(playerRating: number, offset: number): number {
  return clampBotRating(playerRating + offset);
}

export const DIFFICULTY_PRESETS = [
  { id: 'easier', label: 'Easier', offset: -200 },
  { id: 'match', label: 'Match my rating', offset: 0 },
  { id: 'harder', label: 'Harder', offset: 200 },
] as const;
