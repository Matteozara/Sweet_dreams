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

## Project structure

```
App.js                     flow + state (welcome, setup, evening ritual, analysis)
app.json                   Expo config (microphone, location, notifications)
src/theme.js               design tokens (colours, type, radii)
src/line.js                day-line maths, dates, formatting
src/storage.js             AsyncStorage persistence + sample data
src/services.js            reminder notification, location, haptics
src/components/            Backdrop, Buttons, Chrome (header, nav, toggle), Icon, LineArt, TimeSheet
src/screens/               Welcome, Setup, Reflection, DayLine, Rest, Analysis
setup_env.sh / run.sh      environment + launch scripts
```

## Libraries

- `expo-audio`: microphone recording with live level metering
- `react-native-svg`: the day line, charts, gradients and icons
- `@react-native-async-storage/async-storage`: on-device storage
- `expo-notifications`: the daily evening reminder
- `expo-location`: one position sample per evening, if allowed
- `@expo-google-fonts/plus-jakarta-sans` + `expo-font`: typeface
- Touch handling uses React Native's built-in `PanResponder`
