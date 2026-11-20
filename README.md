# Fix-it Flow – broken heater → craftsman, plugged into centrix

Hackathon build for the reltix challenge. A tenant reports "no heating" in one sentence; centrix triages it, picks the right heating engineer, the PM approves in one click, the engineer accepts with a pre-filled job and offers slots, the tenant books in one tap (consent captured), and the invoice lands on the unit.

```
/app     Expo (React Native + Expo Router) – tenant portal, partner app, centrix workspace
/server  Express API, JSON-file store (db.json), seed data, connector endpoints
/docs    connector-spec.md, assumptions.md, demo-script.md
```

## Run

```bash
cd server && npm install && npm start          # API on :4000 (prints the LAN address)
cd app && npm install && npx expo start         # press w for web, scan the QR with Expo Go
```

Phones in Expo Go reach the API on the laptop's LAN address automatically (same host as Metro). Override with `EXPO_PUBLIC_API_URL=http://<ip>:4000`.

Optional AI triage: copy `server/.env.example` to `server/.env` and set `OPENAI_API_KEY` (model via `OPENAI_MODEL`, default `gpt-4.1-mini`) or `ANTHROPIC_API_KEY`. Restart the server; it prints which provider is active, and **AI triage** is switched on in centrix after a reset. The model's answer is validated (allowed trades/urgencies only); if the call fails or returns garbage, keyword rules are used, so the demo never depends on the LLM.

- Reset demo data: **Reset demo** in centrix, or `POST /demo/reset`.
- Full flow via API: `cd server && npm run smoke` (server must be running).

## Theme
All colours, fonts and radii live in `app/src/lib/theme.ts`. Neutrals and type follow reltix.de (warm off-white, plum ink, Instrument Serif headlines, Inter body, pill tags); the accent is orange.
