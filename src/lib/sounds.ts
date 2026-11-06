// The samples are made by scripts/sounds/generate.py.
import type { InstrumentId } from '../data/instruments';

export type ClickId = 'click-accent' | 'click-group' | 'click';
export type SoundId = InstrumentId | ClickId;

export const SOUND_FILES: Record<SoundId, number> = {
  drum: require('../../assets/sounds/drum.wav'),
  snare: require('../../assets/sounds/snare.wav'),
  hihat: require('../../assets/sounds/hihat.wav'),
  tambourine: require('../../assets/sounds/tambourine.wav'),
  maracas: require('../../assets/sounds/maracas.wav'),
  triangle: require('../../assets/sounds/triangle.wav'),
  woodblock: require('../../assets/sounds/woodblock.wav'),
  clap: require('../../assets/sounds/clap.wav'),
  cowbell: require('../../assets/sounds/cowbell.wav'),
  darbuka: require('../../assets/sounds/darbuka.wav'),
  castanets: require('../../assets/sounds/castanets.wav'),
  'click-accent': require('../../assets/sounds/click-accent.wav'),
  'click-group': require('../../assets/sounds/click-group.wav'),
  click: require('../../assets/sounds/click.wav'),
};

/** Ringing sounds need more players so a fast rhythm doesn't cut them short. */
export const POOL_SIZE: Partial<Record<SoundId, number>> = { triangle: 4, cowbell: 3, tambourine: 3, drum: 3, click: 3 };
