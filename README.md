# Ritmika

Ritmika is a mobile app for writing and playing rhythms on percussion instruments. You place notes and rests of different values on a stave, then play them back with a metronome. It is a sister app to [Litera](https://github.com/svarolgunes/litera) and uses the same stack: [Expo](https://expo.dev) SDK 58, Expo Router, `expo-audio`, `react-native-svg` and AsyncStorage. It is ready to ship to iOS and Android with EAS.

## What's in the app

Three tabs:

| Tab | What it does |
| --- | --- |
| **Ritim** (Rhythm) | One instrument on one stave. Pick the instrument, write a rhythm bar by bar, play it. |
| **Topluluk** (Ensemble) | Several instruments, each on its own stave, with their bars lined up like a score. Add, mute, change or remove instruments. |
| **Ayarlar** (Settings) | Language (Turkish / English), metronome and note volume, short how-to. |

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

All 11 instruments (davul, trampet, zil, tef, marakas, üçgen, tahta blok, alkış, çan, darbuka, kastanyet) and the three metronome clicks are short WAV files synthesized by `scripts/sounds/generate.py`. They work offline and sound the same on every device.

Both tabs save their piece on the device and come with example rhythms (✨). The examples include a rock beat, a *Karşılama* in 9/8, a carnival groove and a waltz band.

## Development

```bash
npm install
npx expo start        # scan the QR code with Expo Go, or press i / a / w
npm test              # rhythm, editing, timeline, layout and preset tests
npm run typecheck
npm run lint
```

All native modules (`expo-audio`, `expo-haptics`, `react-native-svg`, AsyncStorage) are in Expo Go, so no development build is needed.

### Project layout

```
src/app/                 screens (Expo Router)
  (tabs)/index.tsx       Ritim – one instrument
  (tabs)/ensemble.tsx    Topluluk – several staves
  (tabs)/settings.tsx    Ayarlar
src/components/
  Score.tsx              the stave(s): layout, notes, beams, cursor, tap targets
  glyphs.tsx             notes, rests, flags and clef drawn in SVG
  Palette.tsx            note values, note/rest, dot, delete
  Transport.tsx          play, tempo, time signature, toggles, beat dots
  EditorScreen.tsx       the editor screen both tabs share
src/lib/
  rhythm.ts              durations, time signatures, beaming, rest splitting
  song.ts                songs and every editing operation (pure functions)
  timeline.ts            song → time-ordered clicks and hits
  engine.ts              audio players and the playback scheduler
  layout.ts              where bars and notes go on screen
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
