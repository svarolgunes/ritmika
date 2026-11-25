/**
 * Reference tones for "match the note": the white keys Do2 … Do5, made by
 * scripts/sounds/generate.py and tuned to A4 = 440 Hz. For another A4 the
 * player is sped up or slowed down (without pitch correction), which moves
 * the pitch by the same small amount.
 */
import { Asset } from 'expo-asset';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

export { TONE_NOTES } from './match';

/** How long a tone sounds, so the mic can ignore it meanwhile. */
export const TONE_MS = 1300;

// require() needs literal paths, so every tone is listed.
const FILES: Record<number, number> = {
  36: require('../../../assets/sounds/tone-36.wav'),
  38: require('../../../assets/sounds/tone-38.wav'),
  40: require('../../../assets/sounds/tone-40.wav'),
  41: require('../../../assets/sounds/tone-41.wav'),
  43: require('../../../assets/sounds/tone-43.wav'),
  45: require('../../../assets/sounds/tone-45.wav'),
  47: require('../../../assets/sounds/tone-47.wav'),
  48: require('../../../assets/sounds/tone-48.wav'),
  50: require('../../../assets/sounds/tone-50.wav'),
  52: require('../../../assets/sounds/tone-52.wav'),
  53: require('../../../assets/sounds/tone-53.wav'),
  55: require('../../../assets/sounds/tone-55.wav'),
  57: require('../../../assets/sounds/tone-57.wav'),
  59: require('../../../assets/sounds/tone-59.wav'),
  60: require('../../../assets/sounds/tone-60.wav'),
  62: require('../../../assets/sounds/tone-62.wav'),
  64: require('../../../assets/sounds/tone-64.wav'),
  65: require('../../../assets/sounds/tone-65.wav'),
  67: require('../../../assets/sounds/tone-67.wav'),
  69: require('../../../assets/sounds/tone-69.wav'),
  71: require('../../../assets/sounds/tone-71.wav'),
  72: require('../../../assets/sounds/tone-72.wav'),
};

const players = new Map<number, AudioPlayer>();

export function playTone(note: number, a4 = 440, volume = 1) {
  if (!(note in FILES)) return;
  let player = players.get(note);
  if (!player) {
    player = createAudioPlayer(FILES[note]);
    players.set(note, player);
  }
  const p = player;
  p.volume = volume;
  try {
    p.shouldCorrectPitch = false;
    p.setPlaybackRate(a4 / 440);
  } catch {
    // Some platforms can't change the rate; the tone is then at A4 = 440.
  }
  p.pause();
  p.seekTo(0)
    .then(() => p.play())
    .catch(() => p.play());
}

/** Loads the tones ahead of time, so the first one starts on time. */
export async function prepareTones() {
  if (Platform.OS !== 'web') await Asset.loadAsync(Object.values(FILES)).catch(() => undefined);
}
