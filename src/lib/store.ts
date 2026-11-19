/**
 * App state: the synced document (profiles) plus per-device settings.
 * Persisted in localStorage; synced to a GitHub Gist when configured.
 */
import { useRef, useSyncExternalStore } from 'react';
import { findOrCreateGist, readGist, writeGist } from './gist';
import {
  GameRecord,
  MAX_PROFILES,
  Profile,
  PuzzleAttempt,
  SyncDoc,
  activeProfiles,
  emptyDoc,
  mergeDocs,
  newProfile,
} from './model';

export type ColorChoice = 'white' | 'black' | 'random';

export interface DeviceSettings {
  currentProfileId: string | null;
  boardTheme: 'brown' | 'blue' | 'green';
  difficultyOffset: number; // bot rating relative to the player's
  colorChoice: ColorChoice;
  sound: boolean;
  sync: { token: string; gistId: string } | null;
}

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSync: number | null;
  message?: string;
}

interface State {
  doc: SyncDoc;
  settings: DeviceSettings;
  syncStatus: SyncStatus;
}

const DOC_KEY = 'chess.doc.v1';
const SETTINGS_KEY = 'chess.settings.v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: keep running in memory */
  }
}

const defaultSettings: DeviceSettings = {
  currentProfileId: null,
  boardTheme: 'brown',
  difficultyOffset: 0,
  colorChoice: 'random',
  sound: true,
  sync: null,
};

let state: State = {
  doc: load<SyncDoc>(DOC_KEY, emptyDoc()),
  settings: load<DeviceSettings>(SETTINGS_KEY, defaultSettings),
  syncStatus: { state: 'off', lastSync: null },
};
if (state.settings.sync) state.syncStatus = { state: 'idle', lastSync: null };

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  if (patch.doc) save(DOC_KEY, state.doc);
  if (patch.settings) save(SETTINGS_KEY, state.settings);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Subscribe to a slice of state. The selection is recomputed only when the state changes. */
export function useStore<T>(select: (s: State) => T): T {
  const cache = useRef<{ s: State; v: T } | null>(null);
  const get = () => {
    if (!cache.current || cache.current.s !== state) cache.current = { s: state, v: select(state) };
    return cache.current.v;
  };
  return useSyncExternalStore(subscribe, get);
}

export const getState = () => state;

// ---------- settings ----------

export function updateSettings(patch: Partial<DeviceSettings>) {
  setState({ settings: { ...state.settings, ...patch } });
}

// ---------- profiles ----------

export function currentProfile(s: State = state): Profile | null {
  const list = activeProfiles(s.doc);
  return list.find((p) => p.id === s.settings.currentProfileId) ?? null;
}

function updateProfile(id: string, fn: (p: Profile) => Profile) {
  const p = state.doc.profiles[id];
  if (!p) return;
  setState({ doc: { ...state.doc, profiles: { ...state.doc.profiles, [id]: fn(p) } } });
  scheduleSync();
}

export function createProfile(name: string, startRating: number): Profile {
  if (activeProfiles(state.doc).length >= MAX_PROFILES) throw new Error(`At most ${MAX_PROFILES} accounts.`);
  const p = newProfile(name.trim() || 'Player', startRating);
  setState({ doc: { ...state.doc, profiles: { ...state.doc.profiles, [p.id]: p } } });
  updateSettings({ currentProfileId: p.id });
  scheduleSync();
  return p;
}

export function renameProfile(id: string, name: string) {
  updateProfile(id, (p) => ({ ...p, name: name.trim() || p.name, updatedAt: Date.now() }));
}

export function deleteProfile(id: string) {
  updateProfile(id, (p) => ({ ...p, deleted: true, updatedAt: Date.now() }));
  if (state.settings.currentProfileId === id) updateSettings({ currentProfileId: activeProfiles(state.doc)[0]?.id ?? null });
}

export function addGame(profileId: string, g: GameRecord) {
  updateProfile(profileId, (p) => ({ ...p, games: [...p.games, g] }));
}

export function addPuzzleAttempt(profileId: string, a: PuzzleAttempt) {
  updateProfile(profileId, (p) => ({ ...p, puzzles: [...p.puzzles, a] }));
}

export function markLessonDone(profileId: string, lessonId: string) {
  const p = state.doc.profiles[profileId];
  if (!p || p.lessonsDone.includes(lessonId)) return;
  updateProfile(profileId, (q) => ({ ...q, lessonsDone: [...q.lessonsDone, lessonId] }));
}

// ---------- sync ----------

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing: Promise<void> | null = null;

export function scheduleSync(delayMs = 1500) {
  if (!state.settings.sync) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncNow(), delayMs);
}

/** Pull remote, merge, push if anything changed remotely-unknown. Safe to call any time. */
export function syncNow(): Promise<void> {
  if (syncing) return syncing;
  const cfg = state.settings.sync;
  if (!cfg) return Promise.resolve();
  if (!navigator.onLine) {
    setState({ syncStatus: { ...state.syncStatus, state: 'error', message: 'Offline: will sync later.' } });
    return Promise.resolve();
  }
  setState({ syncStatus: { ...state.syncStatus, state: 'syncing', message: undefined } });
  syncing = (async () => {
    try {
      const remote = await readGist(cfg.token, cfg.gistId);
      const merged = mergeDocs(state.doc, remote);
      const mergedJson = JSON.stringify(merged);
      if (mergedJson !== JSON.stringify(remote)) await writeGist(cfg.token, cfg.gistId, merged);
      // Merge again with local in case something was added while we were talking to GitHub.
      setState({
        doc: mergeDocs(merged, state.doc),
        syncStatus: { state: 'idle', lastSync: Date.now() },
      });
      if (!currentProfile() && activeProfiles(state.doc).length > 0) {
        updateSettings({ currentProfileId: activeProfiles(state.doc)[0].id });
      }
    } catch (e) {
      setState({ syncStatus: { ...state.syncStatus, state: 'error', message: (e as Error).message } });
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/** Connect this device. Accepts either a bare token or a "token:gistId" sync code. */
export async function connectSync(code: string): Promise<void> {
  const [token, maybeGist] = code.trim().split(':');
  if (!token) throw new Error('Please paste a token.');
  const gistId = maybeGist || (await findOrCreateGist(token));
  updateSettings({ sync: { token, gistId } });
  await syncNow();
  if (state.syncStatus.state === 'error') throw new Error(state.syncStatus.message);
}

export function disconnectSync() {
  updateSettings({ sync: null });
  setState({ syncStatus: { state: 'off', lastSync: null } });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => scheduleSync(100));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(100);
  });
}
