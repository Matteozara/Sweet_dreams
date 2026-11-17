# Sweet Dreams

Source code for our entry in Aalto University’s "Beyond the Clinic" challenge at Junction 2026

When clinical treatment ends, the risk of relapse doesn't. Once active treatment is over, patients often may have little to no scheduled contact with their clinician, and the warning signs of a relapse tend to build quietly until they are already struggling again. Sweet Dreams keeps that connection open with a short, effortless nightly ritual that lets clinicians follow patients between sessions and after treatment has ended, without turning reporting into a chore.

Each night, Sweet Dreams invites the user to do two things:

1. Reflect briefly on their day, by voice or text.
2. Draw a line with their finger that represents how they felt during the day.

The central idea is that how someone answers can carry just as much information as what they answer. The user is asked to just express themselves, and the app listens to the different signals emitted. Because the ritual is light enough to maintain over time, it can carry on long after active treatment has ended.

---

## How it works
1.  **Capture.** Live transcription and passive collection of drawing kinematics, typing dynamics, and voice features.
2.  **Analyze.** A multimodal model interprets text, audio, and drawings together alongside the objective features.
3.  **Score.** The data is turned into longitudinal scores, which stay hidden from the patient to avoid possible anxiety and score-chasing.
4.  **Review.** The patient's clinician has access to a dashboard with trend lines, component scores, and breakdowns of the patient's signals.
5.  **Alert.** If aggregated scores fall below a threshold, the clinician is notified and can reach out early, even if the patient has not been seen in months.
6.  **Support.** The patient receives personalized suggestions for soothing activities based on their inferred state.

---

## Setup (Linux / macOS)

Requirements: `python3` (with `venv`) and the **Expo Go** app on your phone.

Copy `.env.example` to `.env`, set `EXPO_PUBLIC_GEMINI_API_KEY`, and restart with `./run.sh --clear`.

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

Every new terminal: `source .venv/bin/activate` before running `npx expo ...`.

## Project structure

```
App.js                     flow + state (welcome, setup, evening ritual, analysis)
app.json                   Expo config (microphone, location, notifications)
src/theme.js               design tokens (colours, type, radii)
src/line.js                day-line maths, dates, formatting
src/storage.js             AsyncStorage persistence + sample data
src/services.js            reminder notification, location, haptics
src/transcribe.js          live speech-to-text over the Gemini Live API
src/gemini.js              one structured request to the Gemini Interactions API
src/voiceState.js          prosody / voice-quality score and analysis of the recording
src/contentState.js        score and analysis of the words, typed or transcribed
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
