import { useEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import { Color, checkColor, dests, isPromotion, toColor } from '../lib/chessUtil';
import { useStore } from '../lib/store';

export interface BoardProps {
  fen: string;
  orientation: Color;
  /** Which side the user may move; null = no moves allowed. */
  movable: Color | 'both' | null;
  lastMove?: [string, string];
  arrows?: { from: string; to: string; color?: 'green' | 'red' | 'blue' | 'yellow' }[];
  highlight?: string[];
  /** Called with a UCI move (promotion piece included) after the user moves. */
  onMove?: (uci: string) => void;
}

const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' } as const;

/** A static piece image using the board's piece set (chessground CSS). */
export function PieceIcon({ piece, color, size = 44 }: { piece: keyof typeof PIECE_NAMES; color: Color; size?: number }) {
  return (
    <span
      className="cg-wrap piece-icon"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: `<piece class="${PIECE_NAMES[piece]} ${color}"></piece>` }}
    />
  );
}

/** Interactive chessboard (chessground) with legal-move hints and a promotion picker. */
export function Board({ fen, orientation, movable, lastMove, arrows, highlight, onMove }: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const [promo, setPromo] = useState<{ from: string; to: string; color: Color } | null>(null);
  const prefs = useStore((s) => s.settings);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const config = (): Config => {
    const chess = new Chess(fen);
    const turn = toColor(chess.turn());
    const canMove = movable === 'both' || movable === turn;
    const shapes: DrawShape[] = (arrows ?? []).map((a) => ({ orig: a.from as Key, dest: a.to as Key, brush: a.color ?? 'green' }));
    for (const sq of highlight ?? []) shapes.push({ orig: sq as Key, brush: 'yellow' });
    return {
      fen,
      orientation,
      turnColor: turn,
      check: checkColor(chess),
      lastMove: lastMove as Key[] | undefined,
      movable: {
        free: false,
        color: canMove ? turn : undefined,
        dests: canMove ? (dests(chess) as Map<Key, Key[]>) : new Map(),
        showDests: prefs.showDests,
        events: {
          after: (from, to) => {
            if (isPromotion(new Chess(fen), from, to)) {
              if (prefsRef.current.autoQueen) onMoveRef.current?.(from + to + 'q');
              else setPromo({ from, to, color: turn });
            }
            else onMoveRef.current?.(from + to);
          },
        },
      },
      drawable: { enabled: true, autoShapes: shapes },
      premovable: { enabled: false },
      highlight: { lastMove: true, check: true },
      animation: { enabled: prefs.animationMs > 0, duration: prefs.animationMs },
    };
  };

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, { ...config(), coordinates: prefs.coordinates });
    return () => api.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.coordinates]);

  useEffect(() => {
    api.current?.set(config());
    setPromo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, orientation, movable, lastMove?.[0], lastMove?.[1], JSON.stringify(arrows), JSON.stringify(highlight), prefs.showDests, prefs.animationMs]);

  const pick = (piece: 'q' | 'r' | 'b' | 'n') => {
    if (!promo) return;
    const { from, to } = promo;
    setPromo(null);
    onMoveRef.current?.(from + to + piece);
  };

  return (
    <div className="board-wrap">
      <div ref={el} className="board" />
      {promo && (
        <div className="promo" onClick={() => { setPromo(null); api.current?.set(config()); }}>
          <div className="promo-box" onClick={(e) => e.stopPropagation()}>
            {(['q', 'r', 'b', 'n'] as const).map((p) => (
              <button key={p} className="promo-piece" onClick={() => pick(p)} aria-label={PIECE_NAMES[p]}>
                <PieceIcon piece={p} color={promo.color} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
