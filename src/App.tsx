import { useEffect, useMemo, useState } from 'react';
import { activeProfiles, computeStats } from './lib/model';
import { connectSync, currentProfile, parseSyncCode, syncNow, updateSettings, useStore } from './lib/store';
import { applyUpdate, usePwa } from './lib/pwa';
import { HomePage } from './pages/Home';
import { PlayPage } from './pages/Play';
import { ReviewPage } from './pages/Review';
import { PuzzlesPage } from './pages/Puzzles';
import { LearnPage, LessonPage, OpeningPage } from './pages/Learn';
import { ProfilePage } from './pages/Profile';
import { SettingsPage, Onboarding } from './pages/Settings';

export type Route =
  | { name: 'home' }
  | { name: 'play'; startMoves?: string; color?: 'white' | 'black' }
  | { name: 'review'; gameId: string }
  | { name: 'puzzles' }
  | { name: 'learn'; tab?: 'lessons' | 'openings' }
  | { name: 'lesson'; id: string }
  | { name: 'opening'; id: string }
  | { name: 'profile' }
  | { name: 'settings' };

export type Nav = (r: Route) => void;

const TABS: { name: Route['name']; label: string; icon: string }[] = [
  { name: 'home', label: 'Home', icon: '⌂' },
  { name: 'play', label: 'Play', icon: '♟' },
  { name: 'puzzles', label: 'Puzzles', icon: '✦' },
  { name: 'learn', label: 'Learn', icon: '❖' },
  { name: 'profile', label: 'Stats', icon: '▤' },
  { name: 'settings', label: 'Settings', icon: '⚙' },
];

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const profile = useStore((s) => currentProfile(s));
  const profiles = useStore((s) => activeProfiles(s.doc));
  const sync = useStore((s) => s.syncStatus);
  const boardTheme = useStore((s) => s.settings.boardTheme);
  const stats = useMemo(() => (profile ? computeStats(profile) : null), [profile]);

  const pwa = usePwa();
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  useEffect(() => {
    // Opened via a sync link / QR code (…#sync=token:gist): connect this device.
    if (location.hash.startsWith('#sync=')) {
      const code = parseSyncCode(location.hash);
      history.replaceState(null, '', location.pathname + location.search);
      if (confirm('Connect this device to your Chess Trainer sync?')) {
        setLinkMsg('Connecting sync…');
        connectSync(code).then(
          () => setLinkMsg('Sync connected ✓'),
          (e: Error) => setLinkMsg(`Sync failed: ${e.message}`),
        );
        return;
      }
    }
    void syncNow();
  }, []);

  const banners = (
    <>
      {pwa.updateAvailable && (
        <div className="banner">
          A new version is available. <button className="btn primary small" onClick={applyUpdate}>Update now</button>
        </div>
      )}
      {linkMsg && (
        <div className="banner" onClick={() => setLinkMsg(null)}>{linkMsg}</div>
      )}
    </>
  );

  const nav: Nav = (r) => {
    setRoute(r);
    window.scrollTo(0, 0);
  };

  if (!profile) return <>{banners}<Onboarding /></>;

  const active = route.name === 'review' ? 'profile' : route.name === 'lesson' || route.name === 'opening' ? 'learn' : route.name;

  return (
    <div className="app" data-board={boardTheme}>
      <header className="topbar">
        <div className="brand" onClick={() => nav({ name: 'home' })}>
          <span className="logo">♞</span> Chess Trainer
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.name} className={active === t.name ? 'tab active' : 'tab'} onClick={() => nav({ name: t.name } as Route)}>
              <span className="tab-icon">{t.icon}</span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="account">
          <span className={`sync-dot ${sync.state}`} title={sync.message ?? (sync.state === 'off' ? 'Sync not set up' : `Sync: ${sync.state}`)} />
          <select
            value={profile.id}
            onChange={(e) => updateSettings({ currentProfileId: e.target.value })}
            aria-label="Account"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="rating-chip">{stats ? Math.round(stats.game.rating) + (stats.provisional ? '?' : '') : ''}</span>
        </div>
      </header>
      {banners}
      <main className="main">
        {route.name === 'home' && <HomePage nav={nav} />}
        {route.name === 'play' && <PlayPage key={profile.id + (route.startMoves ?? '')} nav={nav} startMoves={route.startMoves} forcedColor={route.color} />}
        {route.name === 'review' && <ReviewPage nav={nav} gameId={route.gameId} />}
        {route.name === 'puzzles' && <PuzzlesPage key={profile.id} />}
        {route.name === 'learn' && <LearnPage nav={nav} tab={route.tab} />}
        {route.name === 'lesson' && <LessonPage nav={nav} id={route.id} />}
        {route.name === 'opening' && <OpeningPage nav={nav} id={route.id} />}
        {route.name === 'profile' && <ProfilePage nav={nav} />}
        {route.name === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
