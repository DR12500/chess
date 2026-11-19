// Copies the single-threaded "lite" Stockfish WASM build into public/engine/.
// It needs no cross-origin isolation, so it works on GitHub Pages and iPad Safari.
import { copyFileSync, mkdirSync } from 'node:fs';
const src = 'node_modules/stockfish/bin/';
const dst = 'public/engine/';
mkdirSync(dst, { recursive: true });
copyFileSync(src + 'stockfish-19-lite-single.js', dst + 'stockfish.js');
copyFileSync(src + 'stockfish-19-lite-single.wasm', dst + 'stockfish.wasm');
console.log('Stockfish engine copied to', dst);
