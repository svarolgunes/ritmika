# Ritmika

Ritmika is a mobile app for writing and playing rhythms on percussion instruments. You place notes and rests of different values on a stave, then play them back with a metronome. It is a sister app to [Litera](https://github.com/svarolgunes/litera) and uses the same stack: [Expo](https://expo.dev) SDK 58, Expo Router, `expo-audio`, `react-native-svg` and AsyncStorage. It is ready to ship to iOS and Android with EAS.

## What's in the app

Five tabs:

| Tab | What it does |
| --- | --- |
| **Ritim** (Rhythm) | One instrument on one stave. Pick the instrument, write a rhythm bar by bar, play it. |
| **Topluluk** (Ensemble) | Several instruments, each on its own stave, with their bars lined up like a score. Add, mute, change or remove instruments. |
| **Ses** (Sing) | A live pitch analyzer: sing or play into the microphone and see the note, how in tune it is, and its line over time. Includes a "match the note" game. |
| **Kulak** (Ear) | Ear-training games on the piano: higher or lower, guess the note, guess the interval (two notes) and guess the chord, plus step-by-step training lessons with stars. |
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
- The **pitch trail** scrolls the last 6 seconds over coloured note lanes, like a karaoke or singing app. Each note has its own colour (Do red, Re orange, Mi yellow …). With 🎯 *Sesi takip et / Follow my voice* on (the default) the lanes follow the voice up and down; turn it off and they stay put, and you drag the trail up and down to move smoothly through notes and octaves (Do1 to Do7). The app remembers the choice.
- A line is cut where the pitch leaps (more than a semitone at once) and a new one starts, so a jump never draws a stroke across the notes in between; glides and vibrato stay one line.
- 🎹 **Çoklu nota / Several notes** (off by default) finds several notes at once, such as a piano chord or two voices, and draws each as its own line. The strongest (dominant) note is drawn in full colour and shown big in the readout; the others are see-through, and listed under it (e.g. *Sol3 · Si3 · Re4*).
- **Notayı yakala / Match the note:** pick an octave (2, 3 or 4) and tap a note from its Do to the next Do to hear it, then sing or play exactly that note and hold it in tune (±30 cents) for a second to earn a ⭐. Only the chosen octave counts: if the right note is sung an octave off, the app says to go an octave up or down. *Sıradaki / Next* goes up the scale. The app remembers the octave.
- The microphone is only on while 🎤 is pressed, and turns off when you leave the tab or the app. Sound is analysed on the device; nothing is recorded, saved or sent.
- Tuning reference A4 = 432, 440 (default) or 442 Hz in Settings.

How it works: expo-audio's `useAudioStream` delivers live PCM from the microphone on iOS and Android (the Web Audio API with an AudioWorklet does it in the browser). `src/lib/pitch/tracker.ts` low-passes and decimates it to about 16 kHz and runs the **McLeod Pitch Method** (`src/lib/pitch/mpm.ts`, FFT-based NSDF with parabolic peak refinement) on a 64 ms window about 40 times a second, between 60 and 1500 Hz. A loudness and clarity gate with hysteresis hides silence and noise but follows a held note through quieter, breathier moments; dropouts under 150 ms are bridged; an onset check and octave-jump hold remove the classic detector glitches; and a 3-frame median plus adaptive smoothing (strong for wobbles, weak for real moves and glides) keeps the line calm without lagging a melody. The trail is drawn as a smooth curve. With several-note mode on, `src/lib/pitch/poly.ts` also analyses a 128 ms window 20 times a second with Klapuri's **iterative harmonic-sum estimation and cancellation** (whitened spectrum, harmonic salience, removing each found note's partials before looking for the next, with checks against octave and twelfth mistakes and a noise-contrast gate), and `src/lib/pitch/voices.ts` joins the notes frame to frame into lines, ending a line at any jump bigger than 0.8 semitone. Notes exactly an octave apart come out as one. It is pure TypeScript with no native code beyond expo-audio, so it runs in Expo Go.

### Ear training (Kulak)

Every sound is a piano note (Sol2 to Do6), so children learn to hear real instrument tones.

- **Free play** has four games, each with its own settings:
  - **Tiz mi pes mi? / Higher or lower?** Two notes; was the second one higher, lower, or the same? Easy, medium and hard step sizes.
  - **Notayı bul / Find the note:** a Do is played first as a starting point (can be turned off), then a note. Pick which notes can come up, from Do to the high Do, sharps included.
  - **Aralığı bul / Find the interval:** two notes, from a minor second to an octave, going up, down, together or mixed.
  - **Akoru bul / Find the chord:** major, minor, diminished, augmented, sus2, sus4, dominant 7, major 7 and minor 7, played together or one note at a time first.
- **Eğitimler / Training:** 24 lessons of 10 questions in four units (higher or lower, single notes, intervals, chords). They start with the easiest contrast (Do or Sol? octave or fifth? happy major or sad minor?) and add one idea at a time. 6, 8 and 10 right earn one, two and three stars; a star opens the next lesson in the unit. Progress is saved on the device.
- After each answer a small keyboard lights up the notes that were played, and tapping any choice plays what it would have sounded like, so a wrong guess becomes a comparison. Keys on the keyboard can be tapped too.

All 11 instruments (davul, trampet, zil, tef, marakas, üçgen, tahta blok, alkış, çan, darbuka, kastanyet) the three metronome clicks and the 22 piano reference tones for *Match the note* (Do2 to Do5) are short WAV files synthesized by `scripts/sounds/generate.py`. The piano notes for the Ear tab come from `scripts/sounds/piano.py`, a string model with stretched overtones, three detuned strings and a two-stage decay. They work offline and sound the same on every device.

Both tabs save their piece on the device and come with example rhythms (✨). The examples include a rock beat, a *Karşılama* in 9/8, a carnival groove and a waltz band.

## Development

```bash
npm install
npx expo start        # scan the QR code with Expo Go, or press i / a / w
npm test              # rhythm, editing, timeline, layout, preset, pitch and ear-training tests
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
  (tabs)/ear/index.tsx   Kulak – training lessons and free-play games
  (tabs)/ear/play.tsx    one guessing game or lesson
  (tabs)/settings.tsx    Ayarlar
src/components/
  Score.tsx              the stave(s): layout, notes, beams, cursor, tap targets
  glyphs.tsx             notes, rests, flags and clef drawn in SVG
  Palette.tsx            note values, note/rest, dot, delete
  Transport.tsx          play, tempo, time signature, toggles, beat dots
  EditorScreen.tsx       the editor screen both tabs share
  PitchTrail.tsx         the scrolling pitch line over note lanes
  TunerMeter.tsx         the flat/sharp needle
  PianoKeys.tsx          a small keyboard that lights up notes
src/lib/
  rhythm.ts              durations, time signatures, beaming, rest splitting
  song.ts                songs and every editing operation (pure functions)
  timeline.ts            song → time-ordered clicks and hits
  engine.ts              audio players and the playback scheduler
  layout.ts              where bars and notes go on screen
  usePitch.ts            microphone on/off, pitch frames and the trail
  pitch/mpm.ts           McLeod Pitch Method detector (FFT)
  pitch/tracker.ts       stream → steady pitch line (decimation, gates, gap bridging, octave fix, smoothing)
  pitch/notes.ts         Hz ↔ note numbers, cents, note names and colours
  pitch/poly.ts          several notes at once (harmonic-sum estimation and cancellation)
  pitch/voices.ts        several notes over time → separate lines, dominant one marked
  pitch/match.ts         the "match the note" game
  pitch/tones.ts         piano reference tones
  pitch/useMicStream*.ts live mic samples (native / web)
  ear/game.ts            ear-training questions (pure functions)
  ear/lessons.ts         the training path
  ear/piano.ts           piano note player
  ear/progress.ts        lesson stars, saved on the device
  ear/strings.ts         the Ear tab's words (Turkish / English)
src/data/
  instruments.ts         the instruments
  presets.ts             example rhythms in a small text notation
scripts/sounds/generate.py   synthesizes assets/sounds/*.wav
scripts/sounds/piano.py      synthesizes assets/sounds/piano-*.wav
```

### Adding example rhythms

Presets in `src/data/presets.ts` use a short text form, one bar per `|`. `w h q e s` are whole to sixteenth, a trailing `.` makes a value dotted, and a leading `-` makes it a rest. For example, `q -q e e q | h. -q`. `npm test` fails if any bar doesn't add up exactly.

### Changing the sounds

Edit a recipe in `scripts/sounds/generate.py` and run `npm run sounds` (needs `numpy`). The piano is in `scripts/sounds/piano.py` (`npm run sounds:piano`).

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
