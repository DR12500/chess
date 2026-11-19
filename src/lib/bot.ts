import { Chess } from 'chess.js';
import { Engine } from './engine';
import { BotConfig, pickWeakMove } from './botStrength';

/** Virtual clock that matches Stockfish's UCI_Elo calibration (60s + 0.6s increment). */
const CAL_BASE_MS = 60_000;
const CAL_INC_MS = 600;

/** The Stockfish opponent. Owns its own engine worker so hints/analysis don't disturb it. */
export class Bot {
  private engine = new Engine();
  private cfg: BotConfig | null = null;
  private clock = CAL_BASE_MS;

  async start(cfg: BotConfig) {
    this.cfg = cfg;
    this.clock = CAL_BASE_MS;
    if (cfg.kind === 'limit') {
      await this.engine.setOptions({ MultiPV: 1, 'Skill Level': 20, UCI_LimitStrength: true, UCI_Elo: cfg.uciElo });
    } else {
      await this.engine.setOptions({ UCI_LimitStrength: false, 'Skill Level': 0, MultiPV: cfg.multipv });
    }
    await this.engine.newGame();
  }

  /** Returns the bot's move in UCI notation, e.g. "e2e4" or "e7e8q". */
  async move(fen: string): Promise<string> {
    const cfg = this.cfg;
    if (!cfg) throw new Error('bot not started');
    if (cfg.kind === 'limit') {
      const t0 = performance.now();
      const c = Math.max(1000, Math.round(this.clock));
      const res = await this.engine.search(fen, `wtime ${c} btime ${c} winc ${CAL_INC_MS} binc ${CAL_INC_MS}`);
      this.clock = Math.max(1000, this.clock - (performance.now() - t0)) + CAL_INC_MS;
      return res.bestmove;
    }
    const res = await this.engine.search(fen, `depth ${cfg.depth}`);
    const legal = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
    const candidates = res.lines.filter((l) => l.pv.length > 0).map((l) => ({ move: l.pv[0], score: l.score }));
    if (candidates.length === 0 && res.bestmove && res.bestmove !== '(none)') {
      candidates.push({ move: res.bestmove, score: 0 });
    }
    return pickWeakMove(candidates, legal, cfg);
  }

  dispose() {
    this.engine.terminate();
  }
}
