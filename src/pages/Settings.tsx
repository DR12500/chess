import { useMemo, useRef, useState } from 'react';
import { MAX_PROFILES, Profile, activeProfiles, computeStats, ratingConfigOf } from '../lib/model';
import { BOT_RD } from '../lib/botStrength';
import { RATING_PRESETS, RatingConfig, newRating, presetIdFor, previewChanges } from '../lib/rating';
import { SOUND_SETS, playSound } from '../lib/sound';
import { APP_VERSION, BUILD_TIME, applyUpdate, checkForUpdates, platform, promptInstall, usePwa } from '../lib/pwa';
import { QrCode, QrScanner } from '../components/Qr';
import {
  BotSpeed,
  connectSync,
  createProfile,
  currentProfile,
  deleteProfile,
  disconnectSync,
  exportBackup,
  importBackup,
  renameProfile,
  setRatingConfig,
  setStartRating,
  syncLink,
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

// ------------------------------------------------------------------ accounts

function NewProfileForm({ onDone }: { onDone?: () => void }) {
  const [name, setName] = useState('');
  const [rating, setRating] = useState(800);
  return (
    <div className="card">
      <h3>New account</h3>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
      <p className="muted small">Your level sets your starting rating (like chess.com).</p>
      <div className="levels">
        {START_LEVELS.map((l) => (
          <button key={l.rating} className={`level ${rating === l.rating ? 'on' : ''}`} onClick={() => setRating(l.rating)}>
            <b>{l.label}</b> <span className="muted small">{l.desc} · {l.rating}</span>
          </button>
        ))}
      </div>
      <button className="btn primary" disabled={!name.trim()} onClick={() => { createProfile(name, rating); onDone?.(); }}>
        Create account
      </button>
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
      <button className="btn small" onClick={() => { const n = prompt('New name', profile.name); if (n) renameProfile(id, n); }}>Rename</button>
      <button className="btn small danger" onClick={() => confirm(`Delete account "${profile.name}" and all its games on all devices?`) && deleteProfile(id)}>Delete</button>
    </div>
  );
}

// ------------------------------------------------------------------ rating

function RatingCard({ profile }: { profile: Profile }) {
  const cfg = ratingConfigOf(profile);
  const stats = useMemo(() => computeStats(profile), [profile]);
  const presetId = presetIdFor(cfg);
  const [custom, setCustom] = useState(presetId === 'custom');
  const set = (c: RatingConfig) => setRatingConfig(profile.id, c);
  const bot = { rating: Math.round(stats.game.rating), rd: BOT_RD };
  const now = previewChanges(stats.game, bot, cfg);
  const fresh = previewChanges(newRating(profile.startRating, cfg), { rating: profile.startRating, rd: BOT_RD }, cfg);
  const f = (x: number) => `±${Math.abs(Math.round(x))}`;

  return (
    <div className="card">
      <h3>Rating system: {profile.name}</h3>
      <p className="muted small">
        How strongly your rating reacts to each result. Changing this recalculates your whole history with the new settings (on all devices).
      </p>
      <div className="levels">
        {RATING_PRESETS.map((p) => (
          <button key={p.id} className={`level ${!custom && presetId === p.id ? 'on' : ''}`} onClick={() => { setCustom(false); set(p.config); }}>
            <b>{p.label}</b> <span className="muted small">{p.desc}</span>
          </button>
        ))}
        <button className={`level ${custom || presetId === 'custom' ? 'on' : ''}`} onClick={() => setCustom(true)}>
          <b>Custom</b> <span className="muted small">Fine-tune the numbers yourself</span>
        </button>
      </div>
      {(custom || presetId === 'custom') && (
        <div className="sliders">
          <div className="seg small-seg">
            <button className={cfg.system === 'glicko' ? 'on' : ''} onClick={() => set({ ...cfg, system: 'glicko' })}>Glicko (chess.com)</button>
            <button className={cfg.system === 'elo' ? 'on' : ''} onClick={() => set({ ...cfg, system: 'elo' })}>Elo (FIDE)</button>
          </div>
          {cfg.system === 'glicko' ? (
            <>
              <Slider label="Starting uncertainty (RD)" hint="Higher = bigger changes in your first games" min={60} max={350} step={5} value={cfg.startRd} onChange={(v) => set({ ...cfg, startRd: v, minRd: Math.min(cfg.minRd, v) })} />
              <Slider label="Minimum uncertainty (RD)" hint="Higher = bigger changes once settled" min={30} max={150} step={5} value={cfg.minRd} onChange={(v) => set({ ...cfg, minRd: v, startRd: Math.max(cfg.startRd, v) })} />
            </>
          ) : (
            <Slider label="K-factor" hint="Points at stake per game (win vs equal = K/2)" min={8} max={64} step={2} value={cfg.k} onChange={(v) => set({ ...cfg, k: v })} />
          )}
        </div>
      )}
      <p className="small">
        A game vs an equal bot is now worth <b>{f(now.win)}</b>
        {cfg.system === 'glicko' && <> (a brand-new account: {f(fresh.win)})</>}.
      </p>
      <label className="small">Starting rating</label>
      <select value={profile.startRating} onChange={(e) => confirm('Change the starting rating? Your rating history is recalculated.') && setStartRating(profile.id, Number(e.target.value))}>
        {[...new Set([...START_LEVELS.map((l) => l.rating), profile.startRating])].sort((a, b) => a - b).map((r) => (
          <option key={r} value={r}>{r}{START_LEVELS.find((l) => l.rating === r) ? `: ${START_LEVELS.find((l) => l.rating === r)!.label}` : ''}</option>
        ))}
      </select>
    </div>
  );
}

function Slider({ label, hint, min, max, step, value, onChange }: { label: string; hint: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="slider">
      <div className="slider-head"><span>{label}</span><b>{value}</b></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <div className="muted small">{hint}</div>
    </div>
  );
}

// ------------------------------------------------------------------ sync

function SyncCard() {
  const sync = useStore((s) => s.settings.sync);
  const status = useStore((s) => s.syncStatus);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState<'none' | 'qr' | 'code'>('none');
  const [scanning, setScanning] = useState(false);

  const connect = async (input: string) => {
    setBusy(true);
    setErr(null);
    try {
      await connectSync(input);
      setCode('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sync) {
    const link = syncLink()!;
    const plain = `${sync.token}:${sync.gistId}`;
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
          <button className="btn primary" onClick={() => setShow(show === 'qr' ? 'none' : 'qr')}>▦ {show === 'qr' ? 'Hide' : 'Show'} QR code</button>
          <button className="btn" onClick={() => setShow(show === 'code' ? 'none' : 'code')}>Sync code</button>
          <button className="btn danger" onClick={() => confirm('Stop syncing on this device? Local data stays.') && disconnectSync()}>Disconnect</button>
        </div>
        {show === 'qr' && (
          <div className="sync-code center">
            <QrCode text={link} />
            <p className="small">
              On the other device open the <b>installed app</b> → Settings → Sync → <b>Scan QR code</b>. (Android: scanning with the normal camera also works.)
              The code contains your GitHub token: don't share it.
            </p>
          </div>
        )}
        {show === 'code' && (
          <div className="sync-code">
            <p className="small">Paste this into Settings → Sync on the other device. It contains your GitHub token: don't share it.</p>
            <code>{plain}</code>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(plain)}>Copy</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Sync between devices</h3>
      <p className="small"><b>Already set up on another device?</b> Scan its QR code (there: Settings → Sync → Show QR code).</p>
      <button className="btn primary" onClick={() => setScanning(true)} disabled={busy}>📷 Scan QR code</button>
      {scanning && (
        <QrScanner
          onClose={() => setScanning(false)}
          onResult={(text) => { setScanning(false); void connect(text); }}
        />
      )}
      <details className="small setup">
        <summary>First device: set up sync with GitHub</summary>
        <ol>
          <li>Create a token: <a href={TOKEN_URL} target="_blank" rel="noreferrer">GitHub → new token</a>. Tick only <code>gist</code>, choose "No expiration".</li>
          <li>Paste it below and press Connect. A secret Gist is created to hold your accounts and games.</li>
          <li>Then show the QR code here and scan it with your other devices.</li>
        </ol>
      </details>
      <input placeholder="Token (ghp_…) or sync code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
      {err && <p className="neg small">{err}</p>}
      <button className="btn" onClick={() => void connect(code)} disabled={!code.trim() || busy}>{busy ? 'Connecting…' : 'Connect'}</button>
    </div>
  );
}

// ------------------------------------------------------------------ app (install/update/backup)

export function InstallCard() {
  const pwa = usePwa();
  const [showHelp, setShowHelp] = useState(false);
  const plat = platform();
  if (pwa.installed) return null;
  return (
    <div className="card install">
      <h3>⬇ Install the app</h3>
      <p className="small">Install Chess Trainer like a normal app: own icon, full screen, works offline, updates itself.</p>
      {pwa.installEvent ? (
        <button className="btn primary" onClick={() => void promptInstall()}>Install app</button>
      ) : (
        <button className="btn primary" onClick={() => setShowHelp(!showHelp)}>How to install</button>
      )}
      {(showHelp || (!pwa.installEvent && plat === 'ios')) && (
        <div className="small install-help">
          {plat === 'ios' && <p><b>iPad / iPhone (Safari):</b> tap the Share button <span className="kbd">⎙</span> → <b>Add to Home Screen</b> → Add. Then open Chess from your home screen.</p>}
          {plat === 'android' && <p><b>Android (Chrome):</b> menu ⋮ → <b>Install app</b> (or "Add to Home screen").</p>}
          {plat === 'desktop' && <p><b>Windows (Edge or Chrome):</b> click the install icon <span className="kbd">⊕</span> at the right end of the address bar, or menu → Apps → <b>Install Chess Trainer</b>. It then appears in the Start menu.</p>}
        </div>
      )}
    </div>
  );
}

function AppCard() {
  const pwa = usePwa();
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chess-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="card">
      <h3>App &amp; updates</h3>
      <p className="small">
        Version <b>{APP_VERSION}</b>, built {new Date(BUILD_TIME).toLocaleString()}.
        {pwa.lastCheck && <span className="muted"> Last checked {new Date(pwa.lastCheck).toLocaleTimeString()}.</span>}
      </p>
      <p className="muted small">New versions pushed to GitHub are picked up automatically (on start, when you return to the app, and every 30 minutes); you'll see an "Update" banner.</p>
      <div className="controls">
        {pwa.updateAvailable ? (
          <button className="btn primary" onClick={applyUpdate}>⟳ Install update now</button>
        ) : (
          <button className="btn" disabled={pwa.checking} onClick={async () => setMsg((await checkForUpdates()) ? 'Update found!' : 'You have the latest version.')}>
            {pwa.checking ? 'Checking…' : 'Check for updates'}
          </button>
        )}
      </div>
      {msg && <p className="small">{msg}</p>}
      <h3 className="mt">Backup</h3>
      <div className="controls">
        <button className="btn" onClick={download}>Download backup</button>
        <button className="btn" onClick={() => file.current?.click()}>Restore from file</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try { importBackup(await f.text()); setMsg('Backup merged.'); } catch (err) { setMsg((err as Error).message); }
          e.target.value = '';
        }} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ page

export function SettingsPage() {
  const profiles = useStore((s) => activeProfiles(s.doc));
  const profile = useStore((s) => currentProfile(s));
  const s = useStore((st) => st.settings);
  const [adding, setAdding] = useState(false);

  return (
    <div className="page narrow">
      <h1>Settings</h1>
      <InstallCard />

      <div className="card">
        <h3>Accounts ({profiles.length}/{MAX_PROFILES})</h3>
        {profiles.map((p) => <ProfileRow key={p.id} id={p.id} current={p.id === s.currentProfileId} />)}
        {profiles.length < MAX_PROFILES && !adding && <button className="btn" onClick={() => setAdding(true)}>+ Add account</button>}
      </div>
      {adding && <NewProfileForm onDone={() => setAdding(false)} />}

      {profile && <RatingCard profile={profile} />}

      <div className="card">
        <h3>Playing</h3>
        <label className="small">Bot move speed</label>
        <div className="seg small-seg">
          {([['instant', 'Instant'], ['natural', 'Natural'], ['slow', 'Slow (human-like)']] as [BotSpeed, string][]).map(([v, l]) => (
            <button key={v} className={s.botSpeed === v ? 'on' : ''} onClick={() => updateSettings({ botSpeed: v })}>{l}</button>
          ))}
        </div>
        <Toggle label="Always promote to queen" checked={s.autoQueen} onChange={(v) => updateSettings({ autoQueen: v })} />
        <Toggle label="Confirm before resigning" checked={s.confirmResign} onChange={(v) => updateSettings({ confirmResign: v })} />
        <label className="small">Game review depth</label>
        <div className="seg small-seg">
          {[[10, 'Fast'], [12, 'Normal'], [16, 'Deep (slower)']].map(([v, l]) => (
            <button key={v} className={s.reviewDepth === v ? 'on' : ''} onClick={() => updateSettings({ reviewDepth: v as number })}>{l}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Board</h3>
        <div className="seg small-seg">
          {(['brown', 'blue', 'green'] as const).map((t) => (
            <button key={t} className={s.boardTheme === t ? 'on' : ''} onClick={() => updateSettings({ boardTheme: t })}>{t}</button>
          ))}
        </div>
        <Toggle label="Show legal moves" checked={s.showDests} onChange={(v) => updateSettings({ showDests: v })} />
        <Toggle label="Show coordinates" checked={s.coordinates} onChange={(v) => updateSettings({ coordinates: v })} />
        <label className="small">Piece animation</label>
        <div className="seg small-seg">
          {[[0, 'Off'], [120, 'Fast'], [180, 'Normal'], [300, 'Slow']].map(([v, l]) => (
            <button key={v} className={s.animationMs === v ? 'on' : ''} onClick={() => updateSettings({ animationMs: v as number })}>{l}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Sound</h3>
        <Toggle label="Sounds on" checked={s.sound} onChange={(v) => updateSettings({ sound: v })} />
        <div className="seg small-seg">
          {SOUND_SETS.map((x) => (
            <button key={x.id} className={s.soundSet === x.id ? 'on' : ''} onClick={() => { updateSettings({ soundSet: x.id }); void playSound('move', { set: x.id, force: true }); }}>{x.label}</button>
          ))}
        </div>
        <Slider label="Volume" hint="" min={0} max={100} step={5} value={Math.round(s.volume * 100)} onChange={(v) => updateSettings({ volume: v / 100 })} />
        <div className="controls">
          {(['move', 'capture', 'check', 'win'] as const).map((k) => (
            <button key={k} className="btn small" onClick={() => void playSound(k, { force: true })}>▶ {k}</button>
          ))}
        </div>
      </div>

      <SyncCard />
      <AppCard />

      <div className="card small muted">
        <p>
          Engine: Stockfish 19 (lite, WebAssembly) via stockfish.js, GPL-3.0. Puzzles: Lichess open database (CC0). Sounds: Enigmahack / Lichess (AGPLv3+).
          Pieces: cburnett (CC BY-SA 3.0). Board: chessground (GPL-3.0).
        </p>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check toggle-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

/** First-run screen: create an account or connect sync to pull existing ones. */
export function Onboarding() {
  return (
    <div className="page narrow onboarding">
      <h1><span className="logo">♞</span> Chess Trainer</h1>
      <p>Play Stockfish at your level, solve puzzles and learn. Create your first account, or scan the sync QR code if you already use the app on another device.</p>
      <SyncCard />
      <NewProfileForm />
      <InstallCard />
    </div>
  );
}
