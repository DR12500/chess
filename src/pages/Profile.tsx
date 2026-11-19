import { useMemo, useState } from 'react';
import type { Nav } from '../App';
import { RatingPoint, computeStats } from '../lib/model';
import { currentProfile, useStore } from '../lib/store';
import { GameTable } from './Home';

export function ProfilePage({ nav }: { nav: Nav }) {
  const profile = useStore((s) => currentProfile(s))!;
  const stats = useMemo(() => computeStats(profile), [profile]);
  const [which, setWhich] = useState<'game' | 'puzzle'>('game');
  const games = [...profile.games].sort((a, b) => b.ts - a.ts);

  return (
    <div className="page">
      <h1>{profile.name}: stats</h1>
      <div className="seg">
        <button className={which === 'game' ? 'on' : ''} onClick={() => setWhich('game')}>Game rating {Math.round(stats.game.rating)}</button>
        <button className={which === 'puzzle' ? 'on' : ''} onClick={() => setWhich('puzzle')}>Puzzle rating {Math.round(stats.puzzle.rating)}</button>
      </div>
      <div className="card">
        <RatingChart points={which === 'game' ? stats.gameHistory : stats.puzzleHistory} />
      </div>
      <div className="card small">
        <p>
          <b>How your rating works.</b> Ratings use <b>Glicko-2</b>, the system family chess.com and Lichess use. Besides the rating,
          you have a <i>rating deviation</i> (RD: currently ±{Math.round(stats.game.rd)}). With few games the RD is high and your rating
          moves quickly (shown with a "?"); it settles as you play, and grows again after long breaks.
        </p>
        <p>
          Each win/loss is scored against the bot's rating. Expected score = 1 / (1 + 10^((bot − you)/400)): beating a stronger bot gains
          more than beating a weaker one. Rated games pick a bot near your rating, so you should win about half of them.
        </p>
      </div>
      <h2>Games ({games.length})</h2>
      {games.length === 0 ? <p className="muted">No games yet.</p> : <GameTable games={games} nav={nav} deltas={stats.gameDelta} />}
    </div>
  );
}

function RatingChart({ points }: { points: RatingPoint[] }) {
  if (points.length < 2) return <p className="muted">Play some games to see your rating chart.</p>;
  const W = 600;
  const H = 180;
  const ys = points.map((p) => p.rating);
  const min = Math.floor((Math.min(...ys) - 20) / 50) * 50;
  const max = Math.ceil((Math.max(...ys) + 20) / 50) * 50;
  const x = (i: number) => (i / (points.length - 1)) * (W - 40) + 36;
  const y = (r: number) => H - 20 - ((r - min) / (max - min)) * (H - 30);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(' ');
  const ticks = [min, Math.round((min + max) / 2), max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Rating history">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={36} x2={W - 4} y1={y(t)} y2={y(t)} className="grid-line" />
          <text x={0} y={y(t) + 4} className="axis">{t}</text>
        </g>
      ))}
      <path d={path} className="line" />
      <circle cx={x(points.length - 1)} cy={y(ys[ys.length - 1])} r={4} className="dot" />
    </svg>
  );
}
