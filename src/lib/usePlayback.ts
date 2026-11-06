import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { startPlayback, stopPlayback, updatePlayback } from './engine';
import { useSettings } from './settings';
import type { Song } from './song';
import { buildTimeline } from './timeline';

export type BeatState = { bar: number; beat: number; countIn: boolean } | null;

/**
 * Plays a song with the metronome, and reports which note of each staff is
 * sounding so the score can light it up. Leaving the screen stops playback.
 */
export function usePlayback(song: Song) {
  const settings = useSettings();
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState<Record<string, string>>({});
  const [beat, setBeat] = useState<BeatState>(null);
  const owner = useRef<symbol | null>(null);

  // Live values the engine reads on every event.
  const live = useRef({ settings, song });
  useEffect(() => {
    live.current = { settings, song };
  }, [settings, song]);

  const stop = useCallback(() => {
    if (owner.current) stopPlayback(owner.current);
  }, []);

  const play = useCallback(() => {
    const { song: s, settings: st } = live.current;
    const timeline = buildTimeline(s, { countIn: st.countIn });
    setPlaying(true);
    owner.current = startPlayback(
      timeline,
      {
        loop: () => live.current.settings.loop,
        audible: (staffId) => {
          const { settings: now, song: current } = live.current;
          return now.notesAudible && !current.staves.find((x) => x.id === staffId)?.muted;
        },
        clickVolume: () => live.current.settings.clickVolume,
        noteVolume: () => live.current.settings.noteVolume,
      },
      {
        onClick: (c) => {
          setBeat({ bar: c.bar, beat: c.beat, countIn: c.countIn });
          // A new bar starts with nothing lit until its first note.
          if (c.beat === 0) setActive({});
        },
        onHit: (h) => setActive((a) => (a[h.staffId] === h.eventId ? a : { ...a, [h.staffId]: h.eventId })),
        onEnd: () => {
          owner.current = null;
          setPlaying(false);
          setActive({});
          setBeat(null);
        },
      },
    );
  }, []);

  // Edits while playing take effect at the next loop.
  useEffect(() => {
    if (owner.current) updatePlayback(owner.current, buildTimeline(song, { countIn: false }));
  }, [song]);

  useFocusEffect(
    useCallback(() => {
      return () => stop();
    }, [stop]),
  );

  return { playing, play, stop, toggle: () => (owner.current ? stop() : play()), active, beat };
}
