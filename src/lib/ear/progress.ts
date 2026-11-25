/** Stars earned in the training lessons, saved on the device. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'ritmika.ear.v1';

type Progress = { stars: Record<string, number> };

let state: Progress = { stars: {} };
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Progress>;
      const stars: Record<string, number> = {};
      for (const [k, v] of Object.entries(saved.stars ?? {})) if (typeof v === 'number') stars[k] = Math.max(0, Math.min(3, v));
      // Keep anything earned before loading finished.
      for (const [k, v] of Object.entries(state.stars)) stars[k] = Math.max(stars[k] ?? 0, v);
      state = { stars };
      emit();
    })
    .catch(() => undefined);
}

/** Keeps the best result for a lesson. */
export function recordStars(lessonId: string, stars: number) {
  if ((state.stars[lessonId] ?? 0) >= stars) return;
  state = { stars: { ...state.stars, [lessonId]: stars } };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLessonStars(): Record<string, number> {
  useEffect(load, []);
  return useSyncExternalStore(
    subscribe,
    () => state.stars,
    () => state.stars,
  );
}
