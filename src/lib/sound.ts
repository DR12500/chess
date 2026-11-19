/**
 * Game sounds. Sound sets by Enigmahack from Lichess (AGPLv3+), see public/sounds/CREDITS.md.
 * Uses WebAudio with pre-decoded buffers for low latency; iOS needs a first user tap to unlock.
 */
import { getState, type SoundSet } from './store';

export type SoundKind = 'move' | 'capture' | 'check' | 'win' | 'loss' | 'draw' | 'good' | 'bad' | 'notify';

const FILES: Record<SoundKind, string> = {
  move: 'Move',
  capture: 'Capture',
  check: 'Check',
  win: 'Victory',
  loss: 'Defeat',
  draw: 'Draw',
  good: 'Confirmation',
  bad: 'Error',
  notify: 'GenericNotify',
};

export const SOUND_SETS: { id: SoundSet; label: string }[] = [
  { id: 'sfx', label: 'Classic' },
  { id: 'piano', label: 'Piano' },
  { id: 'nes', label: 'Retro (8-bit)' },
  { id: 'futuristic', label: 'Futuristic' },
];

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function context(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function load(set: SoundSet, kind: SoundKind): Promise<AudioBuffer | null> {
  const key = `${set}/${FILES[kind]}`;
  let p = buffers.get(key);
  if (!p) {
    const c = context();
    p = c
      ? fetch(`${import.meta.env.BASE_URL}sounds/${key}.mp3`)
          .then((r) => r.arrayBuffer())
          .then((b) => c.decodeAudioData(b))
          .catch(() => null)
      : Promise.resolve(null);
    buffers.set(key, p);
  }
  return p;
}

/** Preload the current set so the first move sound isn't delayed. */
export function preloadSounds(set: SoundSet = getState().settings.soundSet) {
  for (const k of Object.keys(FILES) as SoundKind[]) void load(set, k);
}

export async function playSound(kind: SoundKind, opts?: { set?: SoundSet; force?: boolean }) {
  const s = getState().settings;
  if (!s.sound && !opts?.force) return;
  const c = context();
  if (!c) return;
  if (c.state === 'suspended') await c.resume().catch(() => undefined);
  const buf = await load(opts?.set ?? s.soundSet, kind);
  if (!buf) return;
  const src = c.createBufferSource();
  const gain = c.createGain();
  gain.gain.value = Math.max(0, Math.min(1, s.volume));
  src.buffer = buf;
  src.connect(gain).connect(c.destination);
  src.start();
}

// iOS/Safari only allow audio after a user gesture: resume the context on the first tap.
if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = context();
    void c?.resume();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
}
