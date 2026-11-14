# Sweet Dreams — Specialist Clinical Dashboard

Standalone browser dashboard for clinicians/specialists to inspect multi-modal **v2** biomarkers (Finger Drawing, Typing, Voice) alongside **Gemini Day Scores (`0–10`)** and **Day Line** trajectories.

## Launch

From the repository root:

```bash
node specialist-dashboard/serve.mjs
```

Then open `http://127.0.0.1:4173/specialist-dashboard/` in your browser.

## Loading Recorded Data

1. **Export from the app:** In the app's **Analysis** tab, tap **Export data (JSON)** to save/share `entries`, then drag-and-drop or click **Import JSON** in the dashboard.
2. **Same-origin web:** If running Expo Web on the same origin, the dashboard auto-reads `sweetdreams.entries.v1` from `localStorage`.
3. **Demo dataset:** Click **Load 21-Day Demo** to explore a 3-week trajectory (5 practice + 10 baseline + 6 follow-up days, including an objective-vs-subjective divergence).
