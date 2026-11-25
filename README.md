# Ritmika

Ritmika is a mobile app for writing and playing rhythms on percussion instruments. You place notes and rests of different values on a stave, then play them back with a metronome. It is a sister app to [Litera](https://github.com/svarolgunes/litera) and uses the same stack: [Expo](https://expo.dev) SDK 58, Expo Router, `expo-audio`, `react-native-svg` and AsyncStorage. It is ready to ship to iOS and Android with EAS.

## What's in the app

Four tabs:

| Tab | What it does |
| --- | --- |
| **Ritim** (Rhythm) | One instrument on one stave. Pick the instrument, write a rhythm bar by bar, play it. |
| **Topluluk** (Ensemble) | Several instruments, each on its own stave, with their bars lined up like a score. Add, mute, change or remove instruments. |
| **Ses** (Sing) | A live pitch analyzer: sing or play into the microphone and see the note, how in tune it is, and its line over time. Includes a "match the note" game. |
| **Ayarlar** (Settings) | Language (Turkish / English), metronome and note volume, tuning (A4), short how-to. |

### Play mode and edit mode

The ✏️ **Düzenle / Edit** button at the top right switches the editor on and off, and the app remembers the choice. With editing off (the default), the screen keeps only what's needed to play: the play button, the tempo, the beat dots, the score and the ✨ examples. The palette, bar tools, time signature picker, playback options, cursor, dashed gaps and hints all appear when editing is on.

### The stave editor

- **Values:** whole, half, quarter, eighth and sixteenth notes, the matching rests, and dotted versions (except the dotted sixteenth).
- **Writing:** tap a value and it goes in at the orange cursor. When a bar is full the cursor moves on, and a bar is added when needed. A note that doesn't fit is refused, with a message saying how much room is left.
- **Changing:** tap a note to select it. The palette then changes its value, turns it into a rest or back, or toggles its dot, as long as the bar still adds up. Tap it again to unselect it.
- **Deleting:** ⌫ deletes the selected note or, like backspace, the one before the cursor.
- **Bars:** add or delete bars. *Fill gaps with rests* writes out the unfinished part of each bar with beat-aligned rests.
- **Time signatures:** 2/4, 3/4, 4/4, 5/4, 3/8, 6/8, 12/8, 9/8 (3+3+3), and the Turkish *aksak* meters 5/8 (2+3), 7/8 (2+2+3) and 9/8 (2+2+2+3). The grouping controls metronome accents and how eighths are beamed.
- Notation is drawn in SVG: a one-line percussion stave and clef, beams by beat or pulse group, flags, sixteenth beam stubs, augmentation dots, and real rest shapes. A whole-bar rest is centred in the bar. Unfinished bars show a dashed box.

### Playing

- **The metronome always ticks** during playback, louder on the downbeat and slightly louder at the start of each pulse group (e.g. 2+2+2+3). The dots under the tempo show the beat.
- **🔊 Notes** toggles whether the notes are heard. When they're silent the notes still light up, so you can play the rhythm yourself against the metronome.
- **🔁 Loop** repeats the piece. **⏱ Count-in** plays one bar of metronome before the start.
- Edits made while playing are picked up at the next loop, so the beat never stops.
- In the ensemble, a muted staff stays visible but silent.

### Singing and pitch (Ses)

- Press 🎤 and sing, hum, whistle or play an instrument. The big note name (Do Re Mi in Turkish, C D E in English, with the octave) and a tuner needle show the note and how many cents it is flat (*pes*) or sharp (*tiz*). The face smiles when it's within 10 cents.
- The **pitch trail** scrolls the last 6 seconds over coloured note lanes, like a karaoke or singing app. Each note has its own colour (Do red, Re orange, Mi yellow …), and the lanes follow the voice up and down.
- **Notayı yakala / Match the note:** pick an octave (2, 3 or 4) and tap a note from its Do to the next Do to hear it, then sing or play exactly that note and hold it in tune (±30 cents) for a second to earn a ⭐. Only the chosen octave counts: if the right note is sung an octave off, the app says to go an octave up or down. *Sıradaki / Next* goes up the scale. The app remembers the octave.
- The microphone is only on while 🎤 is pressed, and turns off when you leave the tab or the app. Sound is analysed on the device; nothing is recorded, saved or sent.
- Tuning reference A4 = 432, 440 (default) or 442 Hz in Settings.

How it works: expo-audio's `useAudioStream` delivers live PCM from the microphone on iOS and Android (the Web Audio API with an AudioWorklet does it in the browser). `src/lib/pitch/tracker.ts` low-passes and decimates it to about 16 kHz and runs the **McLeod Pitch Method** (`src/lib/pitch/mpm.ts`, FFT-based NSDF with parabolic peak refinement) on a 64 ms window about 25 times a second, between 60 and 1500 Hz. A loudness and clarity gate hides silence and noise, an onset check and octave-jump hold remove the classic detector glitches, and light smoothing keeps the line calm without lagging a melody. It is pure TypeScript with no native code beyond expo-audio, so it runs in Expo Go.

All 11 instruments (davul, trampet, zil, tef, marakas, üçgen, tahta blok, alkış, çan, darbuka, kastanyet) the three metronome clicks and the 22 reference tones for *Match the note* (Do2 to Do5) are short WAV files synthesized by `scripts/sounds/generate.py`. They work offline and sound the same on every device.

Both tabs save their piece on the device and come with example rhythms (✨). The examples include a rock beat, a *Karşılama* in 9/8, a carnival groove and a waltz band.

## Development

```bash
npm install
npx expo start        # scan the QR code with Expo Go, or press i / a / w
npm test              # rhythm, editing, timeline, layout, preset and pitch tests
npm run typecheck
npm run lint
```

All native modules (`expo-audio`, `expo-haptics`, `react-native-svg`, AsyncStorage) are in Expo Go, so no development build is needed. The Sing tab asks for microphone access the first time 🎤 is pressed; in the browser it needs `localhost` or HTTPS.

### Project layout

```
src/app/                 screens (Expo Router)
  (tabs)/index.tsx       Ritim – one instrument
  (tabs)/ensemble.tsx    Topluluk – several staves
  (tabs)/sing.tsx        Ses – live pitch analyzer and "match the note"
  (tabs)/settings.tsx    Ayarlar
src/components/
  Score.tsx              the stave(s): layout, notes, beams, cursor, tap targets
  glyphs.tsx             notes, rests, flags and clef drawn in SVG
  Palette.tsx            note values, note/rest, dot, delete
  Transport.tsx          play, tempo, time signature, toggles, beat dots
  EditorScreen.tsx       the editor screen both tabs share
  PitchTrail.tsx         the scrolling pitch line over note lanes
  TunerMeter.tsx         the flat/sharp needle
src/lib/
  rhythm.ts              durations, time signatures, beaming, rest splitting
  song.ts                songs and every editing operation (pure functions)
  timeline.ts            song → time-ordered clicks and hits
  engine.ts              audio players and the playback scheduler
  layout.ts              where bars and notes go on screen
  usePitch.ts            microphone on/off, pitch frames and the trail
  pitch/mpm.ts           McLeod Pitch Method detector (FFT)
  pitch/tracker.ts       stream → steady pitch line (decimation, gates, octave fix, smoothing)
  pitch/notes.ts         Hz ↔ note numbers, cents, note names and colours
  pitch/match.ts         the "match the note" game
  pitch/tones.ts         reference tones
  pitch/useMicStream*.ts live mic samples (native / web)
src/data/
  instruments.ts         the instruments
  presets.ts             example rhythms in a small text notation
scripts/sounds/generate.py   synthesizes assets/sounds/*.wav
```

### Adding example rhythms

Presets in `src/data/presets.ts` use a short text form, one bar per `|`. `w h q e s` are whole to sixteenth, a trailing `.` makes a value dotted, and a leading `-` makes it a rest. For example, `q -q e e q | h. -q`. `npm test` fails if any bar doesn't add up exactly.

### Changing the sounds

Edit a recipe in `scripts/sounds/generate.py` and run `npm run sounds` (needs `numpy`).

### About timing

`expo-audio` plays sounds but cannot schedule them sample-accurately. The engine keeps time like a game loop: every click and note has an absolute time from one starting point, a 4 ms timer fires whatever is due, and each sound has a small pool of pre-loaded, pre-rewound players. Errors therefore never build up over a long piece. In testing, the JS-side jitter stayed within about 5 ms. If you ever need sample-accurate timing, the Expo docs point to [React Native Audio API](https://docs.swmansion.com/react-native-audio-api/). It needs a development build instead of Expo Go.

## Shipping with EAS

One-time setup:

```bash
npm install -g eas-cli
eas login
eas init              # creates the EAS project and adds its id to app.json
```

Builds:

```bash
eas build --profile preview --platform android    # installable APK for testers
eas build --profile production --platform all     # store builds
eas submit --platform ios
eas submit --platform android
```

The bundle id / package is `com.svarolgunes.ritmika`; change it in `app.json` before the first store build if you want a different one.
