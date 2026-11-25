/**
 * Live microphone samples on iOS and Android, through expo-audio's
 * AudioStream (raw PCM as it is captured; nothing is recorded or saved).
 * The web version is in useMicStream.web.ts.
 */
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

export type MicStart = 'ok' | 'denied' | 'error';
export type SampleHandler = (samples: Float32Array, sampleRate: number) => void;

export function useMicStream(onSamples: SampleHandler) {
  const handler = useRef(onSamples);
  useEffect(() => {
    handler.current = onSamples;
  }, [onSamples]);
  const running = useRef(false);

  const { stream } = useAudioStream({
    sampleRate: 48000,
    channels: 1,
    encoding: 'float32',
    onBuffer: (buffer) => {
      if (!running.current) return;
      let samples = new Float32Array(buffer.data);
      if (buffer.channels > 1) samples = samples.filter((_, i) => i % buffer.channels === 0);
      handler.current(samples, buffer.sampleRate);
    },
  });

  const start = useCallback(async (): Promise<MicStart> => {
    if (running.current) return 'ok';
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return 'denied';
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await stream.start();
      running.current = true;
      return 'ok';
    } catch {
      return 'error';
    }
  }, [stream]);

  const stop = useCallback(() => {
    if (!running.current) return;
    running.current = false;
    try {
      stream.stop();
    } catch {
      // Already stopped.
    }
    // Back to playback-only, so the speaker isn't ducked for the rhythm tabs.
    setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
  }, [stream]);

  useEffect(() => stop, [stop]);

  return { start, stop };
}
