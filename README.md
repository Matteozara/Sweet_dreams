# Sweet Dreams

Prototype of a mental-health check-in app (React Native + Expo).

## Flow

1. **Welcome**: "Continue with Google" (placeholder: no real OAuth yet).
2. **Setup**: what we may measure (movement / location) and the evening reminder time.
3. **Reflection**: one card, "How was your day?", answered by voice or by keyboard.
4. **The Day Line**: one line, left to right (morning to night), top is light, bottom is heavy.
5. **Rest**: sleeping moon, "Goodnight.", and a way into your progress.
6. **Analysis**: every line layered (oldest faintest, tonight brightest) and the last seven joined end to end.

The look follows the Stitch "Pastel Galaxy" design system (tokens in `src/theme.js`).

Profile and entries are stored on the device with AsyncStorage. Each entry keeps the answer
(text with typing timings, or the audio file URI), the line, the raw finger motion with
timestamps, and a location sample if movement is allowed. In development builds the Analysis
screen has a "Load a sample week" button for demos.

## Setup (Linux / macOS)

Requirements: `python3` (with `venv`) and the **Expo Go** app on your phone.

```bash
chmod +x setup_env.sh run.sh
./setup_env.sh          # creates .venv with its own Node.js + installs everything
./run.sh                # = source .venv/bin/activate && npx expo start
```

```bash
source .venv/bin/activate
npx expo login
./run.sh --tunnel
```


Scan the QR code with Expo Go (Android) or the Camera app (iOS). Phone and computer must be on the same Wi-Fi; if they aren't (or the university network blocks it), use `./run.sh --tunnel`.

Every new terminal: `source .venv/bin/activate` before running `npx expo ...` by hand.

## Live transcription

While recording, the words appear under the waveform ("Hide words" turns the display off).
Microphone audio is streamed to the Gemini Live API (`gemini-3.5-transcribe-live`) and the
transcript is saved with the entry. After stopping, the transcript becomes a text field so it
can be corrected; the original recognised text is kept alongside when it was edited. Copy `.env.example` to `.env`, set
`EXPO_PUBLIC_GEMINI_API_KEY`, and restart with `./run.sh --clear`. Without a key the app
records as before, with no transcript.

## Voice state

When an evening answered by voice is closed, the recording is sent once to the Gemini
Interactions API (`gemini-4-hydrogen`, see `src/voiceState.js`). It is judged on how it sounds,
not on the words: prosody (pitch, energy, speaking rate, pauses) and voice quality. The reply is
a score from 0 (depleted, strained) to 10 (calm, energised) and a short written analysis, saved on
the entry as `voiceState` and shown under "How you sounded" on the Analysis screen. It uses the
same `EXPO_PUBLIC_GEMINI_API_KEY`; without a key, or offline, the entry is simply saved without it.

## Project structure

```
App.js                     flow + state (welcome, setup, evening ritual, analysis)
app.json                   Expo config (microphone, location, notifications)
src/theme.js               design tokens (colours, type, radii)
src/line.js                day-line maths, dates, formatting
src/storage.js             AsyncStorage persistence + sample data
src/services.js            reminder notification, location, haptics
src/transcribe.js          live speech-to-text over the Gemini Live API
src/voiceState.js          prosody / voice-quality score and analysis of the recording
src/components/            Backdrop, Buttons, Chrome (header, nav, toggle), Icon, LineArt, TimeSheet
src/screens/               Welcome, Setup, Reflection, DayLine, Rest, Analysis
setup_env.sh / run.sh      environment + launch scripts
```

## Libraries

- `expo-audio`: microphone PCM stream (WAV file, waveform, live transcription)
- `react-native-svg`: the day line, charts, gradients and icons
- `@react-native-async-storage/async-storage`: on-device storage
- `expo-notifications`: the daily evening reminder
- `expo-location`: one position sample per evening, if allowed
- `@expo-google-fonts/plus-jakarta-sans` + `expo-font`: typeface
- Touch handling uses React Native's built-in `PanResponder`
