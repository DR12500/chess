/**
 * Synced data model.
 *
 * Ratings are never stored directly: they are recomputed by replaying every rated game /
 * puzzle attempt in time order. That makes merging data from several devices trivial and
 * conflict-free: union the records by id, then replay.
 */
import { BOT_RD } from './botStrength';
import { DEFAULT_RATING_CONFIG, Rating, RatingConfig, decayRd, isProvisional, newRating, updateRating } from './rating';

export const MAX_PROFILES = 3;

export interface GameRecord {
  id: string;
  ts: number; // end time
  color: 'w' | 'b'; // the human's colour
  botRating: number;
  score: 1 | 0.5 | 0; // human's score
  rated: boolean;
  termination: string; // e.g. "checkmate", "resignation", "stalemate"
  pgn: string;
  /** Player's rating before / after, filled in when replayed (not synced). */
}

/** Compact puzzle attempt: [puzzleId, ts, puzzleRating, solved(1/0)] */
export type PuzzleAttempt = [string, number, number, 0 | 1];

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number; // for last-writer-wins of name / startRating / deleted
  startRating: number;
  deleted?: boolean;
  games: GameRecord[];
  puzzles: PuzzleAttempt[];
  lessonsDone: string[];
  /** How ratings are calculated for this account (synced; changing it recalculates history). */
  ratingConfig?: RatingConfig;
}

export const ratingConfigOf = (p: Profile): RatingConfig => ({ ...DEFAULT_RATING_CONFIG, ...p.ratingConfig });

export interface SyncDoc {
  version: 1;
  profiles: Record<string, Profile>;
}

export const emptyDoc = (): SyncDoc => ({ version: 1, profiles: {} });

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function newProfile(name: string, startRating: number): Profile {
  const now = Date.now();
  return { id: uid(), name, createdAt: now, updatedAt: now, startRating, games: [], puzzles: [], lessonsDone: [] };
}

export function activeProfiles(doc: SyncDoc): Profile[] {
  return Object.values(doc.profiles)
    .filter((p) => !p.deleted)
    .sort((a, b) => a.createdAt - b.createdAt);
}

// ---------- merge ----------

function unionBy<T>(a: T[], b: T[], key: (x: T) => string): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(key(x), x);
  for (const x of b) if (!m.has(key(x))) m.set(key(x), x);
  return [...m.values()];
}

export function mergeProfile(a: Profile, b: Profile): Profile {
  const newer = b.updatedAt > a.updatedAt ? b : a;
  return {
    ...newer,
    games: unionBy(a.games, b.games, (g) => g.id).sort((x, y) => x.ts - y.ts),
    puzzles: unionBy(a.puzzles, b.puzzles, (p) => p[0] + '@' + p[1]).sort((x, y) => x[1] - y[1]),
    lessonsDone: [...new Set([...a.lessonsDone, ...b.lessonsDone])],
  };
}

export function mergeDocs(a: SyncDoc, b: SyncDoc): SyncDoc {
  const profiles: Record<string, Profile> = { ...a.profiles };
  for (const [id, p] of Object.entries(b.profiles)) {
    profiles[id] = profiles[id] ? mergeProfile(profiles[id], p) : p;
  }
  return { version: 1, profiles };
}

// ---------- derived ratings ----------

export interface RatingPoint {
  ts: number;
  rating: number;
}

export interface Stats {
  game: Rating;
  puzzle: Rating;
  gameHistory: RatingPoint[];
  puzzleHistory: RatingPoint[];
  /** Rating change caused by each game id. */
  gameDelta: Record<string, { before: number; after: number }>;
  wins: number;
  draws: number;
  losses: number;
  puzzlesSolved: number;
  puzzlesTried: number;
  /** Rated games still counted as "provisional" (high RD), like chess.com's "?" */
  provisional: boolean;
}

const PUZZLE_RD = 75;

export function computeStats(p: Profile, now = Date.now()): Stats {
  const cfg = ratingConfigOf(p);
  let game = newRating(p.startRating, cfg);
  let lastGameTs = p.createdAt;
  const gameHistory: RatingPoint[] = [{ ts: p.createdAt, rating: game.rating }];
  const gameDelta: Stats['gameDelta'] = {};
  let wins = 0, draws = 0, losses = 0;
  for (const g of [...p.games].sort((x, y) => x.ts - y.ts)) {
    if (g.score === 1) wins++;
    else if (g.score === 0) losses++;
    else draws++;
    if (!g.rated) continue;
    game = decayRd(game, g.ts - lastGameTs, cfg);
    lastGameTs = g.ts;
    const before = game.rating;
    game = updateRating(game, { rating: g.botRating, rd: BOT_RD }, g.score, cfg);
    gameDelta[g.id] = { before, after: game.rating };
    gameHistory.push({ ts: g.ts, rating: game.rating });
  }
  game = decayRd(game, now - lastGameTs, cfg);

  let puzzle = newRating(p.startRating, cfg);
  const puzzleHistory: RatingPoint[] = [{ ts: p.createdAt, rating: puzzle.rating }];
  let solved = 0;
  for (const [, ts, pr, ok] of p.puzzles) {
    puzzle = updateRating(puzzle, { rating: pr, rd: PUZZLE_RD }, ok, cfg);
    if (ok) solved++;
    puzzleHistory.push({ ts, rating: puzzle.rating });
  }

  return {
    game,
    puzzle,
    gameHistory,
    puzzleHistory,
    gameDelta,
    wins,
    draws,
    losses,
    puzzlesSolved: solved,
    puzzlesTried: p.puzzles.length,
    provisional: isProvisional(game, cfg),
  };
}
