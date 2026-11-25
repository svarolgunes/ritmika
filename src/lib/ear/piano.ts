/**
 * Piano notes for the Kulak (Ear) tab, Sol2 … Do6, synthesized by
 * scripts/sounds/piano.py at A4 = 440 Hz. For another A4 the player runs a
 * little faster or slower (without pitch correction), which moves the pitch
 * by the same small amount.
 *
 * Every note has two players, so the same note can sound twice in a row
 * (a reference Do followed by a Do) or ring while it starts again.
 */
import { Asset } from 'expo-asset';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import type { Playback } from './game';

// require() needs literal paths, so every note is listed.
const FILES: Record<number, number> = {
  43: require('../../../assets/sounds/piano-43.wav'),
  44: require('../../../assets/sounds/piano-44.wav'),
  45: require('../../../assets/sounds/piano-45.wav'),
  46: require('../../../assets/sounds/piano-46.wav'),
  47: require('../../../assets/sounds/piano-47.wav'),
  48: require('../../../assets/sounds/piano-48.wav'),
  49: require('../../../assets/sounds/piano-49.wav'),
  50: require('../../../assets/sounds/piano-50.wav'),
  51: require('../../../assets/sounds/piano-51.wav'),
  52: require('../../../assets/sounds/piano-52.wav'),
  53: require('../../../assets/sounds/piano-53.wav'),
  54: require('../../../assets/sounds/piano-54.wav'),
  55: require('../../../assets/sounds/piano-55.wav'),
  56: require('../../../assets/sounds/piano-56.wav'),
  57: require('../../../assets/sounds/piano-57.wav'),
  58: require('../../../assets/sounds/piano-58.wav'),
  59: require('../../../assets/sounds/piano-59.wav'),
  60: require('../../../assets/sounds/piano-60.wav'),
  61: require('../../../assets/sounds/piano-61.wav'),
  62: require('../../../assets/sounds/piano-62.wav'),
  63: require('../../../assets/sounds/piano-63.wav'),
  64: require('../../../assets/sounds/piano-64.wav'),
  65: require('../../../assets/sounds/piano-65.wav'),
  66: require('../../../assets/sounds/piano-66.wav'),
  67: require('../../../assets/sounds/piano-67.wav'),
  68: require('../../../assets/sounds/piano-68.wav'),
  69: require('../../../assets/sounds/piano-69.wav'),
  70: require('../../../assets/sounds/piano-70.wav'),
  71: require('../../../assets/sounds/piano-71.wav'),
  72: require('../../../assets/sounds/piano-72.wav'),
  73: require('../../../assets/sounds/piano-73.wav'),
  74: require('../../../assets/sounds/piano-74.wav'),
  75: require('../../../assets/sounds/piano-75.wav'),
  76: require('../../../assets/sounds/piano-76.wav'),
  77: require('../../../assets/sounds/piano-77.wav'),
  78: require('../../../assets/sounds/piano-78.wav'),
  79: require('../../../assets/sounds/piano-79.wav'),
  80: require('../../../assets/sounds/piano-80.wav'),
  81: require('../../../assets/sounds/piano-81.wav'),
  82: require('../../../assets/sounds/piano-82.wav'),
  83: require('../../../assets/sounds/piano-83.wav'),
  84: require('../../../assets/sounds/piano-84.wav'),
};

const PLAYERS_PER_NOTE = 2;
const players = new Map<number, AudioPlayer[]>();
const turn = new Map<number, number>();
const sounding = new Set<AudioPlayer>();
let timers: ReturnType<typeof setTimeout>[] = [];

function playerFor(note: number): AudioPlayer | null {
  if (!(note in FILES)) return null;
  let pool = players.get(note);
  if (!pool) {
    pool = Array.from({ length: PLAYERS_PER_NOTE }, () => createAudioPlayer(FILES[note]));
    players.set(note, pool);
  }
  const i = turn.get(note) ?? 0;
  turn.set(note, (i + 1) % pool.length);
  return pool[i];
}

/** Plays one piano note now. */
export function playNote(note: number, a4 = 440, volume = 1) {
  const p = playerFor(note);
  if (!p) return;
  p.volume = volume;
  try {
    p.shouldCorrectPitch = false;
    p.setPlaybackRate(a4 / 440);
  } catch {
    // Some platforms can't change the rate; the note is then at A4 = 440.
  }
  sounding.add(p);
  p.pause();
  p.seekTo(0)
    .then(() => p.play())
    .catch(() => p.play());
}

/** Plays notes together, a little softer each so a chord doesn't get too loud. */
export function playChord(notes: number[], a4 = 440, volume = 1) {
  const v = volume * (notes.length > 1 ? 1 / Math.sqrt(notes.length) + 0.1 : 1);
  for (const n of notes) playNote(n, a4, Math.min(1, v));
}

/** Stops everything still sounding or waiting to start. */
export function stopPiano() {
  for (const id of timers) clearTimeout(id);
  timers = [];
  for (const p of sounding) {
    try {
      p.pause();
    } catch {
      // The player may already be gone.
    }
  }
  sounding.clear();
}

/** Plays a question's steps one after another; cuts off whatever was playing before. */
export function playSequence(playback: Playback, a4 = 440, volume = 1) {
  stopPiano();
  playback.steps.forEach((step, i) => {
    if (i === 0) playChord(step, a4, volume);
    else timers.push(setTimeout(() => playChord(step, a4, volume), i * playback.gap));
  });
}

/** Loads the samples ahead of time, so the first note starts on time. */
export async function preparePiano() {
  if (Platform.OS !== 'web') await Asset.loadAsync(Object.values(FILES)).catch(() => undefined);
}
