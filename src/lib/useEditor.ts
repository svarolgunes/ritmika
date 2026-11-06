import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { hapticError, hapticTap } from './feedback';
import { normalizeCursor, sanitizeSong, startCursor, type Cursor, type EditMessage, type EditResult, type Song } from './song';

type State = { song: Song; cursor: Cursor };

const SAVE_DELAY_MS = 400;
const MESSAGE_MS = 2600;

/**
 * Holds one song being edited, plus the cursor, and saves it on the device.
 * Every change goes through `edit`, which takes a pure operation from song.ts.
 */
export function useEditor(storageKey: string, makeDefault: () => Song) {
  const [state, setState] = useState<State>(() => {
    const song = makeDefault();
    return { song, cursor: startCursor(song) };
  });
  const [message, setMessage] = useState<EditMessage | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const loaded = useRef(false);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        const song = raw ? sanitizeSong(JSON.parse(raw)) : null;
        if (song) {
          stateRef.current = { song, cursor: startCursor(song) };
          setState(stateRef.current);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        loaded.current = true;
      });
  }, [storageKey]);

  useEffect(() => {
    if (!loaded.current) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(storageKey, JSON.stringify(state.song)).catch(() => undefined);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.song, storageKey]);

  useEffect(() => () => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
  }, []);

  const showMessage = useCallback((m: EditMessage | null) => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMessage(m);
    if (m) messageTimer.current = setTimeout(() => setMessage(null), MESSAGE_MS);
  }, []);

  /** Runs an edit and shows its message, if any. */
  const edit = useCallback(
    (op: (song: Song, cursor: Cursor) => EditResult): EditResult => {
      const { song, cursor } = stateRef.current;
      const result = op(song, cursor);
      if (result.message) {
        if (result.message.key !== 'dropped') hapticError();
        showMessage(result.message);
      } else {
        hapticTap();
        showMessage(null);
      }
      const next = { song: result.song, cursor: normalizeCursor(result.song, result.cursor) };
      stateRef.current = next;
      setState(next);
      return result;
    },
    [showMessage],
  );

  /** Changes the song without touching the cursor (tempo, instruments…). */
  const update = useCallback((op: (song: Song) => Song) => {
    const { song, cursor } = stateRef.current;
    const next = op(song);
    const s = { song: next, cursor: normalizeCursor(next, cursor) };
    stateRef.current = s;
    setState(s);
  }, []);

  const setCursor = useCallback((op: (song: Song, cursor: Cursor) => Cursor) => {
    const { song, cursor } = stateRef.current;
    const s = { song, cursor: normalizeCursor(song, op(song, cursor)) };
    stateRef.current = s;
    setState(s);
  }, []);

  const replace = useCallback((song: Song) => {
    const s = { song, cursor: startCursor(song) };
    stateRef.current = s;
    setState(s);
    showMessage(null);
  }, [showMessage]);

  return { song: state.song, cursor: state.cursor, message, edit, update, setCursor, replace };
}
