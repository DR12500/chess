import { Chess, Move, Square } from 'chess.js';

export type Color = 'white' | 'black';

/** Legal destinations in chessground's format. */
export function dests(chess: Chess): Map<Square, Square[]> {
  const m = new Map<Square, Square[]>();
  for (const mv of chess.moves({ verbose: true })) {
    const list = m.get(mv.from) ?? [];
    list.push(mv.to);
    m.set(mv.from, list);
  }
  return m;
}

export const toColor = (c: 'w' | 'b'): Color => (c === 'w' ? 'white' : 'black');

export function uciOf(m: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return m.from + m.to + (m.promotion ?? '');
}

export function playUci(chess: Chess, uci: string): Move | null {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
  } catch {
    return null;
  }
}

export function isPromotion(chess: Chess, from: string, to: string): boolean {
  const p = chess.get(from as Square);
  return !!p && p.type === 'p' && (to[1] === '8' || to[1] === '1');
}

/** Square of the side-to-move's king if in check (for chessground's `check` highlight). */
export function checkColor(chess: Chess): Color | false {
  return chess.inCheck() ? toColor(chess.turn()) : false;
}

export function gameOverReason(chess: Chess): string | null {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isInsufficientMaterial()) return 'insufficient material';
  if (chess.isThreefoldRepetition()) return 'threefold repetition';
  if (chess.isDrawByFiftyMoves()) return '50-move rule';
  return null;
}

/** Win probability (0–100) for the side the score is from, Lichess formula. */
export function winPercent(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

// ---------- sounds (generated, no audio files) ----------
let ctx: AudioContext | null = null;
export function playSound(kind: 'move' | 'capture' | 'check' | 'end' | 'good' | 'bad', enabled = true) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = { move: 520, capture: 380, check: 760, end: 300, good: 880, bad: 200 }[kind];
    o.frequency.value = f;
    o.type = kind === 'capture' ? 'triangle' : 'sine';
    const t = ctx.currentTime;
    const dur = kind === 'end' || kind === 'good' || kind === 'bad' ? 0.35 : 0.08;
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch {
    /* audio not available */
  }
}

export function soundFor(m: Move, chess: Chess): 'move' | 'capture' | 'check' {
  if (chess.inCheck()) return 'check';
  return m.captured ? 'capture' : 'move';
}
