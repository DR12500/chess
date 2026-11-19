import { useMemo } from 'react';
import type { Nav } from '../App';
import { computeStats } from '../lib/model';
import { currentProfile, useStore } from '../lib/store';
import { LESSONS } from '../content/lessons';

export function HomePage({ nav }: { nav: Nav }) {
  const profile = useStore((s) => currentProfile(s))!;
  const stats = useMemo(() => computeStats(profile), [profile]);
  const recent = [...profile.games].sort((a, b) => b.ts - a.ts).slice(0, 5);
  const nextLesson = LESSONS.find((l) => !profile.lessonsDone.includes(l.id));

  return (
    <div className="page">
      <h1>Hi, {profile.name}</h1>
      <div className="grid stats-row">
        <div className="card stat">
          <span className="muted small">Game rating</span>
          <span className="big-number">{Math.round(stats.game.rating)}{stats.provisional ? '?' : ''}</span>
          <span className="muted small">±{Math.round(stats.game.rd * 2)} (95% range)</span>
        </div>
        <div className="card stat">
          <span className="muted small">Puzzle rating</span>
          <span className="big-number">{Math.round(stats.puzzle.rating)}</span>
          <span className="muted small">{stats.puzzlesSolved}/{stats.puzzlesTried} solved</span>
        </div>
        <div className="card stat">
          <span className="muted small">Record</span>
          <span className="big-number">{stats.wins}/{stats.draws}/{stats.losses}</span>
          <span className="muted small">wins / draws / losses</span>
        </div>
      </div>

      <div className="grid">
        <button className="tile hero" onClick={() => nav({ name: 'play' })}>
          <span className="hero-icon">♟</span>
          <b>Play vs Stockfish</b>
          <span className="muted small">Bot adapted to your rating</span>
        </button>
        <button className="tile hero" onClick={() => nav({ name: 'puzzles' })}>
          <span className="hero-icon">✦</span>
          <b>Solve puzzles</b>
          <span className="muted small">Rated tactics at your level</span>
        </button>
        <button className="tile hero" onClick={() => (nextLesson ? nav({ name: 'lesson', id: nextLesson.id }) : nav({ name: 'learn' }))}>
          <span className="hero-icon">❖</span>
          <b>{nextLesson ? `Next lesson: ${nextLesson.title}` : 'Learn'}</b>
          <span className="muted small">Lessons and openings for every level</span>
        </button>
      </div>

      {recent.length > 0 && (
        <section>
          <h2>Recent games</h2>
          <GameTable games={recent} nav={nav} deltas={stats.gameDelta} />
        </section>
      )}
    </div>
  );
}

import type { GameRecord } from '../lib/model';
export function GameTable({ games, nav, deltas }: { games: GameRecord[]; nav: Nav; deltas: Record<string, { before: number; after: number }> }) {
  return (
    <div className="table">
      {games.map((g) => {
        const d = deltas[g.id];
        return (
          <button key={g.id} className="trow" onClick={() => nav({ name: 'review', gameId: g.id })}>
            <span className={`res ${g.score === 1 ? 'win' : g.score === 0 ? 'loss' : 'draw'}`}>{g.score === 1 ? 'W' : g.score === 0 ? 'L' : 'D'}</span>
            <span>{g.color === 'w' ? '♔' : '♚'} vs Stockfish {g.botRating}</span>
            <span className="muted small">{g.termination}</span>
            <span className="muted small">{new Date(g.ts).toLocaleDateString()}</span>
            <span className={d ? (d.after >= d.before ? 'pos' : 'neg') : 'muted small'}>
              {d ? `${d.after >= d.before ? '+' : ''}${Math.round(d.after - d.before)}` : g.rated ? '' : 'casual'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
