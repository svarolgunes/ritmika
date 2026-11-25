import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { PitchTracker, type PitchFrame } from './pitch/tracker';
import { useMicStream } from './pitch/useMicStream';
import { useSettings } from './settings';

export type MicStatus = 'idle' | 'starting' | 'listening' | 'denied' | 'error';

/** A point on the pitch trail; midi is null where nothing was heard. */
export type TrailPoint = { t: number; midi: number | null };

/** How much of the past the trail keeps, in seconds. */
export const TRAIL_SECONDS = 6;

type Reading = { frame: PitchFrame | null; trail: TrailPoint[] };
const EMPTY: Reading = { frame: null, trail: [] };

/**
 * Listens to the microphone and reports the pitch about 25 times a second.
 * The mic is only on between start() and stop(), and it is switched off when
 * the screen loses focus or the app goes to the background.
 *
 * onFrame, if given, is called for every frame with the time since the last
 * one, which is what a game that counts how long a note is held needs.
 */
export function usePitch(onFrame?: (frame: PitchFrame, dt: number) => void) {
  const { a4 } = useSettings();
  const [tracker] = useState(() => new PitchTracker({ a4 }));
  const [reading, setReading] = useState<Reading>(EMPTY);
  const [status, setStatus] = useState<MicStatus>('idle');
  /** Until this time (Date.now) the mic is ignored, while a reference tone plays. */
  const ignoreUntil = useRef(0);
  const lastT = useRef(0);
  const frameHandler = useRef(onFrame);

  useEffect(() => {
    frameHandler.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    tracker.setA4(a4);
  }, [tracker, a4]);

  const handle = useCallback(
    (samples: Float32Array, rate: number) => {
      const frames = tracker.push(samples, rate);
      if (!frames.length) return;
      const muted = Date.now() < ignoreUntil.current;
      const points: TrailPoint[] = [];
      let last = frames[0];
      for (let f of frames) {
        if (muted) f = { ...f, hz: null, midi: null };
        last = f;
        const dt = lastT.current ? Math.min(0.2, f.t - lastT.current) : 0;
        lastT.current = f.t;
        points.push({ t: f.t, midi: f.midi });
        frameHandler.current?.(f, dt);
      }
      const cutoff = last.t - TRAIL_SECONDS;
      setReading((r) => {
        let drop = 0;
        while (drop < r.trail.length && r.trail[drop].t < cutoff) drop += 1;
        return { frame: last, trail: r.trail.slice(drop).concat(points) };
      });
    },
    [tracker],
  );

  // Both are stable callbacks, so the focus and app-state effects below don't re-run every frame.
  const { start: micStart, stop: micStop } = useMicStream(handle);

  /** Bumped by stop(), so a start that finishes after leaving the screen is undone. */
  const session = useRef(0);

  const stop = useCallback(() => {
    session.current += 1;
    micStop();
    tracker.reset();
    lastT.current = 0;
    setReading(EMPTY);
    setStatus((s) => (s === 'listening' || s === 'starting' ? 'idle' : s));
  }, [micStop, tracker]);

  const start = useCallback(async () => {
    session.current += 1;
    const mine = session.current;
    setStatus('starting');
    const result = await micStart();
    if (mine !== session.current) {
      micStop();
      return;
    }
    setStatus(result === 'ok' ? 'listening' : result);
  }, [micStart, micStop]);

  /** Ignores the mic for a while, e.g. while a reference tone plays. */
  const ignoreFor = useCallback((ms: number) => {
    ignoreUntil.current = Date.now() + ms;
  }, []);

  useFocusEffect(useCallback(() => () => stop(), [stop]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => sub.remove();
  }, [stop]);

  return { status, frame: reading.frame, trail: reading.trail, start, stop, ignoreFor };
}
