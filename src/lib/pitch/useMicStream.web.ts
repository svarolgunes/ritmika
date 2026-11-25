/**
 * Live microphone samples in the browser: getUserMedia into the Web Audio
 * API. An AudioWorklet passes the samples on where the browser has one, and a
 * ScriptProcessor (older, but everywhere) where it doesn't. The browser's
 * echo cancelling, noise suppression and gain control are turned off,
 * because they bend the pitch of sustained notes.
 */
import { useCallback, useEffect, useRef } from 'react';

import type { MicStart, SampleHandler } from './useMicStream';

export type { MicStart, SampleHandler } from './useMicStream';

const WORKLET = `
class RitmikaTap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('ritmika-tap', RitmikaTap);
`;

type Session = { context: any; media: any; nodes: any[] };

export function useMicStream(onSamples: SampleHandler) {
  const handler = useRef(onSamples);
  useEffect(() => {
    handler.current = onSamples;
  }, [onSamples]);
  const session = useRef<Session | null>(null);

  const stop = useCallback(() => {
    const s = session.current;
    session.current = null;
    if (!s) return;
    for (const node of s.nodes) {
      try {
        node.disconnect();
      } catch {
        // Not connected.
      }
    }
    s.media.getTracks().forEach((track: any) => track.stop());
    s.context.close().catch(() => undefined);
  }, []);

  const start = useCallback(async (): Promise<MicStart> => {
    if (session.current) return 'ok';
    const g = globalThis as any;
    const AudioContextClass = g.AudioContext ?? g.webkitAudioContext;
    if (!g.navigator?.mediaDevices?.getUserMedia || !AudioContextClass) return 'error';
    let media: any;
    try {
      media = await g.navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
    } catch (e: any) {
      return e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'error';
    }
    try {
      const context = new AudioContextClass();
      if (context.state === 'suspended') await context.resume();
      const source = context.createMediaStreamSource(media);
      const rate: number = context.sampleRate;
      const nodes: any[] = [source];
      // Connected to the output through a muted gain, so the graph runs but nothing is heard.
      const mute = context.createGain();
      mute.gain.value = 0;
      mute.connect(context.destination);
      nodes.push(mute);
      if (context.audioWorklet && g.Blob && g.URL?.createObjectURL) {
        const url = g.URL.createObjectURL(new g.Blob([WORKLET], { type: 'application/javascript' }));
        await context.audioWorklet.addModule(url);
        g.URL.revokeObjectURL(url);
        const tap = new g.AudioWorkletNode(context, 'ritmika-tap');
        tap.port.onmessage = (e: { data: Float32Array }) => handler.current(e.data, rate);
        source.connect(tap);
        tap.connect(mute);
        nodes.push(tap);
      } else {
        const processor = context.createScriptProcessor(1024, 1, 1);
        processor.onaudioprocess = (e: any) => handler.current(new Float32Array(e.inputBuffer.getChannelData(0)), rate);
        source.connect(processor);
        processor.connect(mute);
        nodes.push(processor);
      }
      session.current = { context, media, nodes };
      return 'ok';
    } catch {
      media.getTracks().forEach((track: any) => track.stop());
      return 'error';
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop };
}
