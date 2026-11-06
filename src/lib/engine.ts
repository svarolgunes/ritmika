/**
 * Plays a timeline: the metronome on every beat and, when audible, the notes.
 *
 * expo-audio has no sample-accurate scheduler, so timing is kept the way a
 * game loop does it: every event has an absolute time measured from one
 * starting point, and a short timer fires whatever is due. Errors therefore
 * never add up over a long piece, and each sound has a small pool of
 * pre-loaded players so it can start again before the last one has faded.
 */
import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import { POOL_SIZE, SOUND_FILES, type ClickId, type SoundId } from './sounds';
import type { Click, Hit, Timeline } from './timeline';

const TICK_MS = 4;
/** Time between pressing play and the first sound, so it never starts mid-tick. */
const LEAD_MS = 120;
/** Anything this late (e.g. the app was in the background) is skipped, not crammed in. */
const TOO_LATE_MS = 90;

const perf = (globalThis as { performance?: { now(): number } }).performance;
const now = () => (perf ? perf.now() : Date.now());

class Voice {
  private players: AudioPlayer[] = [];
  private next = 0;

  constructor(source: number, size: number) {
    for (let i = 0; i < size; i += 1) {
      const player = createAudioPlayer(source, { updateInterval: 100 });
      // Rewind as soon as a sound ends, so the next trigger starts instantly.
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) player.seekTo(0).catch(() => undefined);
      });
      this.players.push(player);
    }
  }

  trigger(volume: number) {
    const player = this.players[this.next];
    this.next = (this.next + 1) % this.players.length;
    player.volume = volume;
    if (player.playing || player.currentTime > 0.005) {
      player.pause();
      player
        .seekTo(0)
        .then(() => player.play())
        .catch(() => undefined);
    } else {
      player.play();
    }
  }
}

const voices = new Map<SoundId, Voice>();
let audioReady = false;

function voice(id: SoundId): Voice {
  let v = voices.get(id);
  if (!v) {
    v = new Voice(SOUND_FILES[id], POOL_SIZE[id] ?? 2);
    voices.set(id, v);
  }
  return v;
}

/** Loads every sample and makes their players, so the first beat is on time. */
export async function prepareSounds() {
  if (audioReady) return;
  audioReady = true;
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(
    () => undefined,
  );
  if (Platform.OS !== 'web') {
    // In Expo Go assets otherwise stream from the computer on first play.
    await Asset.loadAsync(Object.values(SOUND_FILES)).catch(() => undefined);
  }
  (Object.keys(SOUND_FILES) as SoundId[]).forEach(voice);
}

export function playSound(id: SoundId, volume = 1) {
  voice(id).trigger(volume);
}

const CLICKS: ClickId[] = ['click', 'click-group', 'click-accent'];

export type PlaybackOptions = {
  loop: () => boolean;
  /** Whether a staff's notes should sound right now; read live for every note. */
  audible: (staffId: string) => boolean;
  clickVolume: () => number;
  noteVolume: () => number;
};

export type PlaybackCallbacks = {
  onClick: (click: Click) => void;
  onHit: (hit: Hit) => void;
  onEnd: () => void;
};

type Run = {
  owner: symbol;
  timeline: Timeline;
  /** Picked up at the start of the next loop, so edits apply without stopping. */
  pending: Timeline | null;
  /** now() at the song's time 0 for the current pass. */
  origin: number;
  index: number;
  timer: ReturnType<typeof setTimeout> | null;
  opts: PlaybackOptions;
  cb: PlaybackCallbacks;
};

let run: Run | null = null;

function fire(r: Run, e: Timeline['events'][number], late: number) {
  if (e.kind === 'click') {
    if (late < TOO_LATE_MS) playSound(CLICKS[e.accent], r.opts.clickVolume());
    r.cb.onClick(e);
  } else {
    if (e.sound && late < TOO_LATE_MS && r.opts.audible(e.staffId)) playSound(e.sound, r.opts.noteVolume());
    r.cb.onHit(e);
  }
}

function firstSongIndex(t: Timeline) {
  const i = t.events.findIndex((e) => e.t >= 0);
  return i < 0 ? t.events.length : i;
}

function tick() {
  const r = run;
  if (!r) return;
  const t = now() - r.origin;
  const events = r.timeline.events;
  while (r.index < events.length && events[r.index].t <= t + 1) {
    const e = events[r.index];
    r.index += 1;
    fire(r, e, t - e.t);
  }
  if (r.index >= events.length && t >= r.timeline.lengthMs - 1) {
    if (r.opts.loop() && r.timeline.lengthMs > 0) {
      r.origin += r.timeline.lengthMs;
      if (r.pending) {
        r.timeline = r.pending;
        r.pending = null;
      }
      r.index = firstSongIndex(r.timeline);
    } else {
      run = null;
      r.cb.onEnd();
      return;
    }
  }
  r.timer = setTimeout(tick, TICK_MS);
}

/** Starts playing; returns a token for stopPlayback / updatePlayback. */
export function startPlayback(timeline: Timeline, opts: PlaybackOptions, cb: PlaybackCallbacks): symbol {
  stopPlayback();
  prepareSounds();
  const owner = Symbol('playback');
  run = {
    owner,
    timeline,
    pending: null,
    origin: now() + LEAD_MS + timeline.countInMs,
    index: 0,
    timer: null,
    opts,
    cb,
  };
  tick();
  return owner;
}

/** Swaps in an edited song at the next loop, keeping the beat going. */
export function updatePlayback(owner: symbol, timeline: Timeline) {
  if (run?.owner === owner) run.pending = timeline;
}

export function stopPlayback(owner?: symbol) {
  if (!run || (owner && run.owner !== owner)) return;
  const r = run;
  run = null;
  if (r.timer) clearTimeout(r.timer);
  r.cb.onEnd();
}
