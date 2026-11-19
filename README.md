# Chess Trainer

A personal chess app: play Stockfish at your level, solve rated puzzles, and learn with lessons and an opening guide.
It runs in the browser and can be installed as an app on Windows, iPad and Android.

## Put it online (one time, free)

1. Create a free GitHub account (if you don't have one) and a **new public repository**, e.g. `chess`.
2. Push this folder to it:
   ```sh
   git remote add origin https://github.com/<your-user>/chess.git
   git push -u origin main
   ```
3. On GitHub: repository → **Settings → Pages → Source: GitHub Actions**.
   The workflow builds and publishes the app to `https://<your-user>.github.io/chess/` after every push (watch the "Actions" tab).

## Install on each device

- **Windows (Edge/Chrome)**: open the URL → the install icon in the address bar (or menu → "Apps → Install").
- **iPad (Safari)**: open the URL → Share button → **Add to Home Screen**. Open it from the home screen.
- **Android (Chrome)**: open the URL → menu ⋮ → **Install app** / Add to Home screen.

The app works offline after the first load.

## Set up sync (one time)

1. On the first device: Settings → Sync → "create GitHub token". Tick only **gist**, choose *No expiration*, generate, copy.
2. Paste the token into the app and press **Connect**. A secret Gist is created to hold accounts and games.
3. Still on that device, press **Show sync code** and copy it (e.g. by e-mailing it to yourself).
4. On each other device, open the *installed* app → Settings → Sync → paste the sync code → Connect.

Sync happens automatically after every game/puzzle and when the app is opened. Games played offline sync later.

## Development

```sh
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

Credits: Stockfish (GPL-3.0) via stockfish.js · chessground (GPL-3.0) · chess.js (BSD-2) · puzzles from the Lichess database (CC0) · cburnett pieces (CC BY-SA 3.0).
