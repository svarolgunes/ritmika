import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { STRINGS, type Lang, type Strings } from './i18n';

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
};

const DEFAULTS: Settings = { lang: 'tr', clickVolume: 0.7, noteVolume: 1, notesAudible: true, loop: true, countIn: true, editing: false };

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
