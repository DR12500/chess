import { useMemo, useState } from 'react';
import { MAX_PROFILES, activeProfiles, computeStats } from '../lib/model';
import {
  connectSync,
  createProfile,
  deleteProfile,
  disconnectSync,
  renameProfile,
  syncNow,
  updateSettings,
  useStore,
} from '../lib/store';

const START_LEVELS = [
  { rating: 400, label: 'New to chess', desc: 'I know little or nothing about chess' },
  { rating: 800, label: 'Beginner', desc: 'I know the rules and play casually' },
  { rating: 1200, label: 'Intermediate', desc: 'I know basic tactics and openings' },
  { rating: 1600, label: 'Advanced', desc: 'I play regularly and study' },
  { rating: 2000, label: 'Expert', desc: 'Club / tournament strength' },
];

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Chess%20Trainer%20sync';

function NewProfileForm({ onDone }: { onDone?: () => void }) {
  const [name, setName] = useState('');
  const [rating, setRating] = useState(800);
  return (
    <div className="card">
      <h3>New account</h3>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
      <p className="muted small">Your level sets your starting rating (like chess.com). It adjusts quickly over your first games.</p>
      <div className="levels">
        {START_LEVELS.map((l) => (
          <button key={l.rating} className={`level ${rating === l.rating ? 'on' : ''}`} onClick={() => setRating(l.rating)}>
            <b>{l.label}</b> <span className="muted small">{l.desc} · {l.rating}</span>
          </button>
        ))}
      </div>
      <button
        className="btn primary"
        disabled={!name.trim()}
        onClick={() => {
          createProfile(name, rating);
          onDone?.();
        }}
      >
        Create account
      </button>
    </div>
  );
}

function SyncCard() {
  const sync = useStore((s) => s.settings.sync);
  const status = useStore((s) => s.syncStatus);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  const connect = async () => {
    setBusy(true);
    setErr(null);
    try {
      await connectSync(code);
      setCode('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sync) {
    const syncCode = `${sync.token}:${sync.gistId}`;
    return (
      <div className="card">
        <h3>Sync between devices</h3>
        <p>
          Status: <b className={`sync-text ${status.state}`}>{status.state}</b>
          {status.lastSync && <span className="muted small"> · last synced {new Date(status.lastSync).toLocaleTimeString()}</span>}
        </p>
        {status.message && <p className="neg small">{status.message}</p>}
        <div className="controls">
          <button className="btn" onClick={() => void syncNow()}>⟳ Sync now</button>
          <button className="btn" onClick={() => setShowCode(!showCode)}>{showCode ? 'Hide' : 'Show'} sync code for another device</button>
          <button className="btn danger" onClick={() => confirm('Stop syncing on this device? Local data stays.') && disconnectSync()}>Disconnect</button>
        </div>
        {showCode && (
          <div className="sync-code">
            <p className="small">Paste this code into <b>Settings → Sync</b> on your other device. It contains your GitHub token; don't share it.</p>
            <code>{syncCode}</code>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(syncCode)}>Copy</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Sync between devices</h3>
      <p className="small">
        Accounts, games and ratings sync through a private (secret) GitHub Gist: free, no server. Set it up once on the first device,
        then copy the <i>sync code</i> to your other devices.
      </p>
      <ol className="small">
        <li>
          On the first device, create a token (only the <code>gist</code> scope; choose "No expiration"):{' '}
          <a href={TOKEN_URL} target="_blank" rel="noreferrer">create GitHub token</a>
        </li>
        <li>Paste the token below and press Connect. A secret gist is created automatically.</li>
        <li>On your other devices: Settings → Sync → "Show sync code" on the first device, and paste that code here.</li>
      </ol>
      <input placeholder="Token (ghp_…) or sync code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
      {err && <p className="neg small">{err}</p>}
      <button className="btn primary" onClick={connect} disabled={!code.trim() || busy}>{busy ? 'Connecting…' : 'Connect'}</button>
    </div>
  );
}

export function SettingsPage() {
  const profiles = useStore((s) => activeProfiles(s.doc));
  const settings = useStore((s) => s.settings);
  const [adding, setAdding] = useState(false);

  return (
    <div className="page narrow">
      <h1>Settings</h1>

      <div className="card">
        <h3>Accounts ({profiles.length}/{MAX_PROFILES})</h3>
        {profiles.map((p) => (
          <ProfileRow key={p.id} id={p.id} current={p.id === settings.currentProfileId} />
        ))}
        {profiles.length < MAX_PROFILES && !adding && <button className="btn" onClick={() => setAdding(true)}>+ Add account</button>}
      </div>
      {adding && <NewProfileForm onDone={() => setAdding(false)} />}

      <SyncCard />

      <div className="card">
        <h3>Board</h3>
        <div className="seg">
          {(['brown', 'blue', 'green'] as const).map((t) => (
            <button key={t} className={settings.boardTheme === t ? 'on' : ''} onClick={() => updateSettings({ boardTheme: t })}>{t}</button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} /> Sounds
        </label>
      </div>

      <div className="card small muted">
        <p>
          Engine: Stockfish 19 (lite, WebAssembly) by the Stockfish team, via stockfish.js. GPL-3.0. Puzzles: Lichess open database (CC0).
          Pieces: cburnett (CC BY-SA 3.0). Board: chessground (GPL-3.0).
        </p>
      </div>
    </div>
  );
}

function ProfileRow({ id, current }: { id: string; current: boolean }) {
  const profile = useStore((s) => s.doc.profiles[id]);
  const stats = useMemo(() => computeStats(profile), [profile]);
  return (
    <div className={`profile-row ${current ? 'current' : ''}`}>
      <button className="link" onClick={() => updateSettings({ currentProfileId: id })}>
        <b>{profile.name}</b> <span className="muted small">{Math.round(stats.game.rating)} · {profile.games.length} games</span>
      </button>
      <button className="btn small" onClick={() => {
        const n = prompt('New name', profile.name);
        if (n) renameProfile(id, n);
      }}>Rename</button>
      <button className="btn small danger" onClick={() => confirm(`Delete account "${profile.name}" and all its games on all devices?`) && deleteProfile(id)}>Delete</button>
    </div>
  );
}

/** First-run screen: create an account or connect sync to pull existing ones. */
export function Onboarding() {
  return (
    <div className="page narrow onboarding">
      <h1><span className="logo">♞</span> Chess Trainer</h1>
      <p>Play Stockfish at your level, solve puzzles and learn. Create your first account, or connect sync if you already use the app on another device.</p>
      <NewProfileForm />
      <SyncCard />
    </div>
  );
}
