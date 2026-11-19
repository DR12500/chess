/**
 * Thin promise-based wrapper around the Stockfish WASM web worker (UCI protocol).
 * Commands are serialised: one search at a time per Engine instance.
 */

export interface PvInfo {
  multipv: number;
  depth: number;
  /** Centipawns from the side to move. Mate scores are converted to ±(100000 - plies). */
  score: number;
  mate?: number;
  pv: string[];
}

export interface SearchResult {
  bestmove: string;
  lines: PvInfo[]; // sorted by multipv (1 = best)
}

const MATE = 100000;

export function parseInfo(line: string): PvInfo | null {
  if (!line.startsWith('info ') || !line.includes(' pv ') || !line.includes(' score ')) return null;
  const t = line.split(' ');
  const at = (k: string) => t.indexOf(k);
  const depth = Number(t[at('depth') + 1]);
  const mpIdx = at('multipv');
  const multipv = mpIdx >= 0 ? Number(t[mpIdx + 1]) : 1;
  const sIdx = at('score');
  const kind = t[sIdx + 1];
  const val = Number(t[sIdx + 2]);
  if (t[sIdx + 3] === 'lowerbound' || t[sIdx + 3] === 'upperbound') return null;
  const pv = t.slice(at('pv') + 1);
  if (kind === 'mate') {
    return { multipv, depth, mate: val, score: val > 0 ? MATE - val : -MATE - val, pv };
  }
  return { multipv, depth, score: val, pv };
}

export class Engine {
  private worker: Worker;
  private listeners = new Set<(line: string) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;

  constructor(url = `${import.meta.env.BASE_URL}engine/stockfish.js`) {
    this.worker = new Worker(url);
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      for (const l of this.listeners) l(line);
    };
    this.ready = this.waitFor('uci', (l) => l === 'uciok').then(() => this.isReady());
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private waitFor(cmd: string | null, done: (line: string) => boolean, onLine?: (l: string) => void): Promise<string> {
    return new Promise((resolve) => {
      const fn = (line: string) => {
        onLine?.(line);
        if (done(line)) {
          this.listeners.delete(fn);
          resolve(line);
        }
      };
      this.listeners.add(fn);
      if (cmd) this.send(cmd);
    });
  }

  private async isReady() {
    await this.waitFor('isready', (l) => l === 'readyok');
  }

  /** Run `fn` after all previously queued work has finished. */
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(() => this.ready).then(fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  setOptions(opts: Record<string, string | number | boolean>): Promise<void> {
    return this.run(async () => {
      for (const [k, v] of Object.entries(opts)) this.send(`setoption name ${k} value ${v}`);
      await this.isReady();
    });
  }

  newGame(): Promise<void> {
    return this.run(async () => {
      this.send('ucinewgame');
      await this.isReady();
    });
  }

  /**
   * Search a position.
   * @param fen position
   * @param go  arguments after "go", e.g. "depth 12" or "movetime 500"
   */
  search(fen: string, go: string, onInfo?: (info: PvInfo) => void): Promise<SearchResult> {
    return this.run(async () => {
      const lines = new Map<number, PvInfo>();
      this.send(`position fen ${fen}`);
      const last = await this.waitFor(
        `go ${go}`,
        (l) => l.startsWith('bestmove'),
        (l) => {
          const info = parseInfo(l);
          if (info) {
            lines.set(info.multipv, info);
            onInfo?.(info);
          }
        },
      );
      const bestmove = last.split(' ')[1];
      return { bestmove, lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv) };
    });
  }

  stop() {
    this.send('stop');
  }

  terminate() {
    this.worker.terminate();
  }
}

let shared: Engine | null = null;
/** A shared full-strength engine for hints and analysis (separate from the opponent). */
export function analysisEngine(): Engine {
  if (!shared) shared = new Engine();
  return shared;
}
