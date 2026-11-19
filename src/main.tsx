import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './styles.css';
import { App } from './App';
import { initPwa } from './lib/pwa';
import { preloadSounds } from './lib/sound';

initPwa();
preloadSounds();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
