import type { Lang } from '../i18n';
import { noteColor, noteName } from '../pitch/notes';
import { DO4, type ChordId, type CompareAnswer, type GameKind } from './game';
import type { EarStrings } from './strings';

/** The words on an answer button. */
export function choiceLabel(kind: GameKind, id: string, s: EarStrings, lang: Lang): string {
  switch (kind) {
    case 'compare':
      return s.compare[id as CompareAnswer];
    case 'note':
      return Number(id) === 12 ? s.highDo : noteName(DO4 + Number(id), lang);
    case 'interval':
      return s.intervals[Number(id)];
    case 'chord':
      return s.chords[id as ChordId];
  }
}

const COMPARE_COLORS: Record<CompareAnswer, string> = { up: '#3BB7D9', down: '#FF8A5B', same: '#4CC38A' };
const CHORD_COLORS: Record<ChordId, string> = {
  major: '#F5C33B',
  minor: '#7B6CF6',
  dim: '#F25F5C',
  aug: '#D46BD8',
  sus2: '#3BB7D9',
  sus4: '#2290B0',
  dom7: '#FF8A5B',
  maj7: '#4CC38A',
  min7: '#5B4BD6',
};

/** A colour per answer: notes keep their usual rainbow colour. */
export function choiceColor(kind: GameKind, id: string): string {
  switch (kind) {
    case 'compare':
      return COMPARE_COLORS[id as CompareAnswer];
    case 'note':
      return noteColor(DO4 + Number(id));
    case 'interval':
      // Small to large intervals go round the rainbow.
      return noteColor(DO4 + [0, 2, 4, 5, 7, 9, 11, 0, 2, 4, 5, 7, 9][Number(id)]);
    case 'chord':
      return CHORD_COLORS[id as ChordId];
  }
}
