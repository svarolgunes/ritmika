export type InstrumentId =
  | 'drum'
  | 'snare'
  | 'hihat'
  | 'tambourine'
  | 'maracas'
  | 'triangle'
  | 'woodblock'
  | 'clap'
  | 'cowbell'
  | 'darbuka'
  | 'castanets';

export type Instrument = {
  id: InstrumentId;
  name: { tr: string; en: string };
  emoji: string;
  color: string;
};

export const INSTRUMENTS: Instrument[] = [
  { id: 'drum', name: { tr: 'Davul', en: 'Bass drum' }, emoji: '🥁', color: '#7B6CF6' },
  { id: 'snare', name: { tr: 'Trampet', en: 'Snare' }, emoji: '🪘', color: '#F25F5C' },
  { id: 'hihat', name: { tr: 'Zil', en: 'Hi-hat' }, emoji: '📀', color: '#E0A100' },
  { id: 'tambourine', name: { tr: 'Tef', en: 'Tambourine' }, emoji: '⭕', color: '#FF8A5B' },
  { id: 'maracas', name: { tr: 'Marakas', en: 'Maracas' }, emoji: '🪇', color: '#4CC38A' },
  { id: 'triangle', name: { tr: 'Üçgen', en: 'Triangle' }, emoji: '🔺', color: '#3FA7D6' },
  { id: 'woodblock', name: { tr: 'Tahta Blok', en: 'Wood block' }, emoji: '🪵', color: '#A8673B' },
  { id: 'clap', name: { tr: 'Alkış', en: 'Clap' }, emoji: '👏', color: '#E85D9E' },
  { id: 'cowbell', name: { tr: 'Çan', en: 'Cowbell' }, emoji: '🔔', color: '#C49A00' },
  { id: 'darbuka', name: { tr: 'Darbuka', en: 'Darbuka' }, emoji: '🏺', color: '#9C5BD1' },
  { id: 'castanets', name: { tr: 'Kastanyet', en: 'Castanets' }, emoji: '🌰', color: '#6E7B8B' },
];

const BY_ID = new Map(INSTRUMENTS.map((i) => [i.id, i]));

export function instrument(id: InstrumentId): Instrument {
  return BY_ID.get(id) ?? INSTRUMENTS[0];
}

export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === 'string' && BY_ID.has(value as InstrumentId);
}
