"""Synthesizes the piano notes for the Kulak (Ear) tab's guessing games.

Run with `npm run sounds:piano` (needs numpy). It writes one short mono WAV
per semitone, piano-43.wav (Sol2) to piano-84.wav (Do6), tuned to A4 = 440 Hz.

The sound is modelled on a real piano string, so it is clearly a piano and
not a beep: stiff-string (slightly sharp) overtones, a hammer that strikes
1/7 of the way along the string (which mutes the 7th overtone), three
slightly detuned strings per note that beat gently, a fast "prompt" decay
followed by a long ringing "aftersound", brighter overtones dying first, and
a soft felt thump at the start.
"""

import os
import wave

import numpy as np

RATE = 22050
SECONDS = 1.8
LOW, HIGH = 43, 84
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'sounds')
rng = np.random.default_rng(11)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def piano(midi):
    f0 = hz(midi)
    n = int(RATE * SECONDS)
    x = np.arange(n) / RATE
    out = np.zeros(n)

    # Bass strings are stiffer relative to their pitch, so they stretch more.
    B = 0.00012 * (f0 / 261.6) ** 0.6 + 0.00004
    # Low notes ring longer than high ones.
    t_long = float(np.clip(3.2 * (261.6 / f0) ** 0.45, 1.2, 5.0))
    detune_cents = (-0.9, 0.0, 0.8)
    for k in range(1, 40):
        fk = k * f0 * np.sqrt(1 + B * k * k)
        if fk > RATE * 0.45:
            break
        # Hammer at 1/7 of the string, and a gentle roll-off for felt.
        amp = abs(np.sin(np.pi * k / 7.0)) / k ** 1.05
        # A deeper bass needs strong low overtones to sound on a phone speaker.
        if f0 < 130 and k <= 4:
            amp *= 1.6 - 0.15 * k
        # In the treble the fundamental dominates.
        if f0 > 500 and k >= 2:
            amp *= 0.55
        decay_long = t_long / (1 + 0.35 * (k - 1))
        decay_short = decay_long * 0.18
        e = 0.62 * np.exp(-x / decay_short) + 0.38 * np.exp(-x / decay_long)
        phase0 = rng.uniform(0, 2 * np.pi)
        partial = sum(np.sin(2 * np.pi * fk * 2 ** (c / 1200) * x + phase0 + i) for i, c in enumerate(detune_cents)) / 3
        out += amp * e * partial

    # Felt hammer thump: a few milliseconds of low-passed noise.
    thump_len = int(RATE * 0.012)
    thump = rng.uniform(-1, 1, thump_len)
    for i in range(1, thump_len):
        thump[i] = thump[i - 1] + 0.25 * (thump[i] - thump[i - 1])
    out[:thump_len] += thump * np.linspace(1, 0, thump_len) * 0.12

    attack = np.minimum(1, x / 0.002)
    release = np.minimum(1, np.maximum(0, (SECONDS - x) / 0.35))
    return out * attack * release


def save(name, x, peak):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    data = (x * 32767).astype('<i2')
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for midi in range(LOW, HIGH + 1):
        # High notes are a little quieter, as on a real piano, so chords blend.
        peak = 0.75 - 0.15 * (midi - LOW) / (HIGH - LOW)
        save(f'piano-{midi}', piano(midi), peak)
        print(f'piano-{midi}.wav')
