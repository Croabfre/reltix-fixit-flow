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

### Three separate sites, one role picker

`/` is only a launcher for the demo – a role picker that links out to the three apps below. Once inside one of them there is no link, button or back-gesture back to `/` or to either of the other two: each is its own closed site, as it would be if they were deployed to three different domains.

| Site | URL (web) | Who |
|---|---|---|
| Tenant portal | `http://localhost:8081/tenant` | the resident |
| Partner app | `http://localhost:8081/partner` | the craftsman |
| centrix workspace | `http://localhost:8081/centrix` | the property manager |

Swap `localhost` for the LAN address Metro prints when opening on a phone.

Optional AI triage: copy `server/.env.example` to `server/.env` and set `OPENAI_API_KEY` (model via `OPENAI_MODEL`, default `gpt-4.1-mini`) or `ANTHROPIC_API_KEY`. Restart the server; it prints which provider is active, and **AI triage** is switched on in centrix after a reset. The model's answer is validated (allowed trades/urgencies only); if the call fails or returns garbage, keyword rules are used, so the demo never depends on the LLM.

- Data lives in `server/centrix.db` (SQLite, built into Node 22.13+). It is created from the seed on first start; `SEED_BUILDINGS=0 npm start` skips the ~150 generated buildings.
- Reset demo data: **Reset demo** in centrix, or `POST /demo/reset`.
- Full flow via API: `cd server && npm run smoke` (server must be running).

## Theme
All colours, fonts and radii live in `app/src/lib/theme.ts`. Colours and type are taken from reltix.de: Baskervville headlines, IBM Plex Sans text, plum #330933, cream #FCF6EF. Orange is only a small "needs attention" accent.
