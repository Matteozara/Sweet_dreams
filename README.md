# Sweet Dreams

Prototype of a mental-health check-in app (React Native + Expo).

## Flow

1. **Home**: title and two buttons, **Test** and **Analysis**.
2. **Test → Question**: the user answers either by **typing** or by **recording audio** (they choose with a toggle). Recordings can be played back or re-recorded.
3. **Draw**: the user draws a line with a finger showing how the day went (x = morning → night, y = bad → good).
4. **Done**: summary with the drawn line.
5. **Analysis**: list of the check-ins from this session with the answer, the mood line and the average mood.

> Data is kept **in memory only** for now; it's gone when the app reloads. The next step is to add storage (e.g. `expo-sqlite` or `@react-native-async-storage/async-storage`).

## Setup (Linux / macOS)

Requirements: `python3` (with `venv`) and the **Expo Go** app on your phone.

```bash
chmod +x setup_env.sh run.sh
./setup_env.sh          # creates .venv with its own Node.js + installs everything
./run.sh                # = source .venv/bin/activate && npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). Phone and computer must be on the same Wi-Fi; if they aren't (or the university network blocks it), use `./run.sh --tunnel`.

Every new terminal: `source .venv/bin/activate` before running `npx expo ...` by hand.

## Project structure

```
App.js                     screen switching + in-memory state
index.js                   entry point
app.json                   Expo config (microphone permission)
src/theme.js               colours
src/components/            BigButton, MoodLinePreview
src/screens/               Home, Question, Draw, Done, Analysis
setup_env.sh / run.sh      environment + launch scripts
```

## Libraries

- `expo-audio`: microphone recording and playback
- `react-native-svg`: drawing the mood line
- Touch handling uses React Native's built-in `PanResponder`
