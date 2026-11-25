"""Synthesizes every instrument, metronome and reference-tone sample in assets/sounds.

Run with `npm run sounds` (needs numpy). The samples are short, mono, 44.1 kHz
16-bit WAV files, so they load fast and need no network. Tweak a recipe here
and run the script again to change how an instrument sounds.
"""

import os
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'sounds')
rng = np.random.default_rng(7)


def t(seconds):
    return np.arange(int(SR * seconds)) / SR


def env(length_s, decay, attack=0.001):
    x = t(length_s)
    e = np.exp(-x / decay)
    a = np.minimum(1.0, x / attack)
    return e * a


def noise(seconds):
    return rng.uniform(-1, 1, int(SR * seconds))


def highpass(x, cutoff):
    # One-pole high-pass: enough to thin out noise for hats and shakers.
    rc = 1.0 / (2 * np.pi * cutoff)
    alpha = rc / (rc + 1.0 / SR)
    y = np.zeros_like(x)
    for i in range(1, len(x)):
        y[i] = alpha * (y[i - 1] + x[i] - x[i - 1])
    return y


def lowpass(x, cutoff):
    dt = 1.0 / SR
    alpha = dt / (1.0 / (2 * np.pi * cutoff) + dt)
    y = np.zeros_like(x)
    for i in range(1, len(x)):
        y[i] = y[i - 1] + alpha * (x[i] - y[i - 1])
    return y


def bandpass(x, low, high):
    return lowpass(highpass(x, low), high)


def sweep_sine(seconds, f_start, f_end, sweep_time):
    x = t(seconds)
    f = f_end + (f_start - f_end) * np.exp(-x / sweep_time)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase)


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def save(name, x, peak=0.9, rate=SR):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    fade = min(len(x), int(rate * 0.004))
    x[-fade:] *= np.linspace(1, 0, fade)
    data = (x * 32767).astype('<i2')
    path = os.path.join(OUT, f'{name}.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data.tobytes())
    print(f'{name}.wav  {len(x) / rate:.2f}s')


def drum():
    body = sweep_sine(0.45, 150, 52, 0.04) * env(0.45, 0.16)
    beater = lowpass(noise(0.02), 3000) * env(0.02, 0.004) * 0.5
    return mix(body, beater)


def snare():
    tone = (np.sin(2 * np.pi * 185 * t(0.25)) + 0.5 * np.sin(2 * np.pi * 330 * t(0.25))) * env(0.25, 0.05)
    wires = highpass(noise(0.25), 1500) * env(0.25, 0.07)
    return mix(tone * 0.6, wires)


def hihat():
    metal = sum(np.sign(np.sin(2 * np.pi * f * t(0.18))) for f in (205, 304, 369, 522, 540, 800))
    return highpass(metal * 0.3 + noise(0.18), 6000) * env(0.18, 0.035)


def tambourine():
    out = np.zeros(int(SR * 0.35))
    for k in range(6):
        start = int(SR * (0.004 * k + rng.uniform(0, 0.004)))
        jingle = highpass(noise(0.3), 5000) * env(0.3, 0.06)
        ring = np.sin(2 * np.pi * rng.uniform(6500, 9000) * t(0.3)) * env(0.3, 0.05) * 0.3
        part = jingle + ring
        out[start : start + len(part)] += part[: len(out) - start]
    return out


def maracas():
    shake = bandpass(noise(0.12), 3500, 9000)
    e = env(0.12, 0.025, attack=0.008)
    return shake * e


def triangle():
    x = t(1.4)
    partials = [(1250, 1.0), (3410, 0.5), (5180, 0.3), (7600, 0.15)]
    tone = sum(a * np.sin(2 * np.pi * f * x) for f, a in partials)
    strike = highpass(noise(0.01), 4000) * 0.3
    return mix(tone * env(1.4, 0.45), strike)


def woodblock():
    x = t(0.15)
    tone = np.sin(2 * np.pi * 1050 * x) + 0.4 * np.sin(2 * np.pi * 2650 * x)
    return tone * env(0.15, 0.022)


def clap():
    out = np.zeros(int(SR * 0.3))
    for k, start_s in enumerate((0.0, 0.011, 0.022, 0.031)):
        length = 0.25 if k == 3 else 0.02
        burst = bandpass(noise(length), 900, 3500) * env(length, 0.08 if k == 3 else 0.006)
        s = int(SR * start_s)
        out[s : s + len(burst)] += burst[: len(out) - s]
    return out


def cowbell():
    x = t(0.4)
    tone = np.sign(np.sin(2 * np.pi * 562 * x)) + np.sign(np.sin(2 * np.pi * 845 * x))
    tone = bandpass(tone, 400, 4000)
    return tone * (0.7 * env(0.4, 0.03) + 0.3 * env(0.4, 0.15))


def darbuka():
    # The bright "tek" stroke near the rim.
    ring = sweep_sine(0.25, 820, 640, 0.02) * env(0.25, 0.05)
    slap = highpass(noise(0.03), 2500) * env(0.03, 0.006) * 0.8
    return mix(ring, slap)


def castanets():
    out = np.zeros(int(SR * 0.08))
    for start_s in (0.0, 0.012):
        x = t(0.05)
        click = (np.sin(2 * np.pi * 2300 * x) + highpass(noise(0.05), 2000) * 0.6) * env(0.05, 0.007)
        s = int(SR * start_s)
        out[s : s + len(click)] += click[: len(out) - s]
    return out


def click(freq, decay=0.012, length=0.06):
    x = t(length)
    return (np.sin(2 * np.pi * freq * x) + 0.3 * np.sin(2 * np.pi * freq * 2 * x)) * env(length, decay, attack=0.0005)


SOUNDS = {
    'drum': drum,
    'snare': snare,
    'hihat': hihat,
    'tambourine': tambourine,
    'maracas': maracas,
    'triangle': triangle,
    'woodblock': woodblock,
    'clap': clap,
    'cowbell': cowbell,
    'darbuka': darbuka,
    'castanets': castanets,
    'click-accent': lambda: click(1760),
    'click-group': lambda: click(1320),
    'click': lambda: click(990, decay=0.01),
}

# Reference tones for the Sing tab's "match the note" game: a synthesized
# piano on the white keys from Do2 to Do5, tuned to A4 = 440 Hz.
TONE_RATE = 22050
TONE_NOTES = sorted({12 * (octave + 1) + k for octave in (2, 3, 4) for k in (0, 2, 4, 5, 7, 9, 11, 12)})


def reference_tone(midi, seconds=1.5):
    """A piano note: struck, slightly stretched partials that each die away.

    Each partial n sits at n·f0·sqrt(1 + B·n²) (string stiffness), with two
    strings a hair apart for the slow beating of a real piano, a decay that
    is faster for higher partials and higher notes, a soft hammer thump at
    the start, and a short damper release at the end. Low notes keep strong
    overtones so a phone speaker still makes their pitch clear.
    """
    f0 = 440.0 * 2 ** ((midi - 69) / 12)
    x = np.arange(int(TONE_RATE * seconds)) / TONE_RATE
    inharm = 0.0004 * 2 ** ((midi - 60) / 24)
    base_decay = 2.2 * 2 ** (-(midi - 48) / 24)  # seconds; low notes ring longer
    tone = np.zeros_like(x)
    for n in range(1, 13):
        fn = n * f0 * np.sqrt(1 + inharm * n * n)
        if fn > TONE_RATE / 2 - 500:
            break
        amp = (1.0 / n ** 0.9) * (1.6 if (midi < 55 and n in (2, 3)) else 1.0)
        decay = base_decay / (1 + 0.45 * (n - 1))
        detune = 1 + 0.0007 * (1 if n % 2 else -1)
        tone += amp * np.exp(-x / decay) * (np.sin(2 * np.pi * fn * x) + 0.6 * np.sin(2 * np.pi * fn * detune * x + 0.3))
    thump = rng.uniform(-1, 1, len(x)) * np.exp(-x / 0.008) * 0.15
    attack = np.minimum(1, x / 0.003)
    release = np.minimum(1, np.maximum(0, (seconds - x) / 0.12))
    return (tone + lowpass(thump, 2000)) * attack * release


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, make in SOUNDS.items():
        save(name, make())
    for midi in TONE_NOTES:
        save(f'tone-{midi}', reference_tone(midi), peak=0.8, rate=TONE_RATE)
