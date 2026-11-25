import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { STRINGS, type Lang, type Strings } from './i18n';
import { DEFAULT_OCTAVE, MATCH_OCTAVES, type MatchOctave } from './pitch/match';

const STORAGE_KEY = 'ritmika.settings.v1';

export type Settings = {
  lang: Lang;
  clickVolume: number;
  noteVolume: number;
  /** Notes sound during playback; the metronome always does. */
  notesAudible: boolean;
  loop: boolean;
  countIn: boolean;
  /** Editing tools are shown; when off, the screen only has what's needed to play. */
  editing: boolean;
  /** Tuning reference for the Sing tab: the frequency of A4 (La4) in Hz. */
  a4: number;
  /** The octave picked in the Sing tab's "match the note" game. */
  matchOctave: MatchOctave;
  /** The Sing tab's note lanes follow the voice; when off, they're dragged by hand. */
  followPitch: boolean;
  /** The Sing tab finds several notes at once (chords) and draws a line for each. */
  polyphonic: boolean;
};

export const A4_CHOICES = [432, 440, 442] as const;

const DEFAULTS: Settings = { lang: 'tr', clickVolume: 0.7, noteVolume: 1, notesAudible: true, loop: true, countIn: true, editing: false, a4: 440, matchOctave: DEFAULT_OCTAVE, followPitch: true, polyphonic: false };

type SettingsApi = Settings & { t: Strings; set: (patch: Partial<Settings>) => void };

const SettingsContext = createContext<SettingsApi | null>(null);

/** Preferences saved on the device. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Settings>;
        setSettings((s) => ({
          lang: saved.lang === 'en' || saved.lang === 'tr' ? saved.lang : s.lang,
          clickVolume: typeof saved.clickVolume === 'number' ? saved.clickVolume : s.clickVolume,
          noteVolume: typeof saved.noteVolume === 'number' ? saved.noteVolume : s.noteVolume,
          notesAudible: typeof saved.notesAudible === 'boolean' ? saved.notesAudible : s.notesAudible,
          loop: typeof saved.loop === 'boolean' ? saved.loop : s.loop,
          countIn: typeof saved.countIn === 'boolean' ? saved.countIn : s.countIn,
          editing: typeof saved.editing === 'boolean' ? saved.editing : s.editing,
          polyphonic: typeof saved.polyphonic === 'boolean' ? saved.polyphonic : s.polyphonic,
          followPitch: typeof saved.followPitch === 'boolean' ? saved.followPitch : s.followPitch,
          matchOctave: (MATCH_OCTAVES as readonly number[]).includes(saved.matchOctave as number) ? (saved.matchOctave as MatchOctave) : s.matchOctave,
          a4: (A4_CHOICES as readonly number[]).includes(saved.a4 as number) ? (saved.a4 as number) : s.a4,
        }));
      })
      .catch(() => undefined);
  }, []);

  const set = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const api = useMemo<SettingsApi>(() => ({ ...settings, t: STRINGS[settings.lang], set }), [settings, set]);

  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
