/**
 * Install ("download") and update handling for the PWA.
 *
 * - Install: Chrome/Edge (Windows, Android) fire `beforeinstallprompt`, which we keep and
 *   trigger from our own "Install app" button. iPad/iPhone Safari has no such API, so we
 *   show "Share → Add to Home Screen" instructions instead.
 * - Updates: the service worker checks GitHub Pages for a new build on start, every 30 min
 *   and whenever the app comes back to the foreground. When one is found, a banner offers
 *   to reload into the new version.
 */
import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  installEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
  updateAvailable: boolean;
  checking: boolean;
  lastCheck: number | null;
  offlineReady: boolean;
}

let state: PwaState = {
  installEvent: null,
  installed: false,
  updateAvailable: false,
  checking: false,
  lastCheck: null,
  offlineReady: false,
};
const listeners = new Set<() => void>();
function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export const APP_VERSION = `${__APP_VERSION__} (${__COMMIT__})`;
export const BUILD_TIME = __BUILD_TIME__;

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function platform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent;
  // iPadOS reports itself as Mac; touch support gives it away.
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export async function promptInstall(): Promise<boolean> {
  const e = state.installEvent;
  if (!e) return false;
  await e.prompt();
  const choice = await e.userChoice;
  set({ installEvent: null, installed: choice.outcome === 'accepted' });
  return choice.outcome === 'accepted';
}

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;

export async function checkForUpdates(): Promise<boolean> {
  if (!registration) return false;
  set({ checking: true });
  try {
    await registration.update();
  } catch {
    /* offline */
  }
  // Give the browser a moment to find and install a new worker.
  await new Promise((r) => setTimeout(r, 1500));
  set({ checking: false, lastCheck: Date.now() });
  return state.updateAvailable;
}

export function applyUpdate() {
  void updateSW?.(true);
}

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    set({ installEvent: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => set({ installed: true, installEvent: null }));
  set({ installed: isStandalone() });

  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => set({ updateAvailable: true }),
    onOfflineReady: () => set({ offlineReady: true }),
    onRegisteredSW: (_url, reg) => {
      registration = reg;
      set({ lastCheck: Date.now() });
      setInterval(() => void reg?.update().catch(() => undefined), 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg?.update().catch(() => undefined);
      });
    },
  });
}
