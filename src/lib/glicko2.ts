/**
 * Glicko-2 rating system (Mark Glickman, http://www.glicko.net/glicko/glicko2.pdf).
 *
 * Chess.com and Lichess both use Glicko-family ratings. Compared with plain Elo,
 * every player also has a rating deviation (RD): how sure we are of the rating.
 * New players have a high RD, so their rating moves fast; it settles as games are played.
 *
 * Like Lichess, each game is treated as its own rating period.
 */

export interface Rating {
  rating: number; // Glicko scale, e.g. 1500
  rd: number; // rating deviation
  vol: number; // volatility
}

const SCALE = 173.7178;
const TAU = 0.5; // constrains volatility change (Glickman suggests 0.3–1.2)
export const DEFAULT_RD = 350;
export const DEFAULT_VOL = 0.06;
export const MIN_RD = 45; // floor so ratings never freeze completely
export const MAX_RD = 350;

export function newRating(rating: number): Rating {
  return { rating, rd: DEFAULT_RD, vol: DEFAULT_VOL };
}

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** Expected score (0..1) of `a` against `b`. */
export function expectedScore(a: Rating, b: Rating): number {
  const phiCombined = Math.sqrt(a.rd * a.rd + b.rd * b.rd) / SCALE;
  return 1 / (1 + Math.exp(-g(phiCombined) * ((a.rating - b.rating) / SCALE)));
}

/**
 * Update `player` after one game against `opponent`.
 * @param score 1 = win, 0.5 = draw, 0 = loss (from the player's point of view)
 */
export function updateRating(player: Rating, opponent: Rating, score: number): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const muJ = (opponent.rating - 1500) / SCALE;
  const phiJ = opponent.rd / SCALE;

  const gJ = g(phiJ);
  const e = E(mu, muJ, phiJ);
  const v = 1 / (gJ * gJ * e * (1 - e));
  const delta = v * gJ * (score - e);

  // Step 5: new volatility via the Illinois algorithm.
  const a = Math.log(player.vol * player.vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const newVol = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + newVol * newVol);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * gJ * (score - e);

  return {
    rating: newMu * SCALE + 1500,
    rd: Math.min(MAX_RD, Math.max(MIN_RD, newPhi * SCALE)),
    vol: newVol,
  };
}

/**
 * RD grows while a player is inactive (Glicko step 6 applied per idle period).
 * We use one period per 30 days, so after a long break the rating adapts faster again.
 */
export function decayRd(r: Rating, idleMs: number): Rating {
  const periods = idleMs / (30 * 24 * 3600 * 1000);
  if (periods <= 0) return r;
  const phi = r.rd / SCALE;
  const phiNew = Math.sqrt(phi * phi + periods * r.vol * r.vol);
  return { ...r, rd: Math.min(MAX_RD, phiNew * SCALE) };
}
