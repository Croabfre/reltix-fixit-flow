# Plan: "Fix-it Flow" — reltix hackathon challenge (Plug a Partner into centrix)

## 0. Context for Claude Code
We are a hackathon team (24 hours). Challenge by reltix, an AI-native property manager in Germany. Their platform is called **centrix**: one structured record per property (units, owners, tenants, contracts, cases, documents, communication). We do NOT get access to their systems; we build our own stand-ins.

**Challenge:** pick ONE ecosystem partner and integrate it into centrix, so that one moment in a property's life becomes a finished outcome with **zero forms**.

**Our flow:** Broken heater → Craftsman (heating engineer).
Outcome: the right craftsman is picked, a slot is booked with the tenant, the repair is done, and the invoice is linked to the case on the unit.

Plan first, then build in the milestones below. Ask before adding anything outside scope.

## 1. Judging criteria (optimise for these)
| Criterion | Weight | What it means for us |
|---|---|---|
| Demo quality | 30% | Flow works end to end, live, from trigger to result |
| User experience | 25% | Minimal effort for tenant, partner and property manager |
| Feasibility & realism | 20% | Realistic data, consent/privacy handled, partner side thought through |
| Connector spec | 15% | Generic: the next partner plugs in without redesign |
| Partner choice | 10% | Clear reason for this partner at this moment |

## 2. Platform and tech stack
- **App first, web as well, from ONE codebase:** Expo (React Native) + Expo Router + TypeScript.
  - Mobile: run on phones via Expo Go.
  - Web: `npx expo start --web` (react-native-web). Use only components that work on both.
- **Backend:** small Node.js + Express server, data stored in a JSON file (e.g. lowdb). All three apps read/write through this API so the demo works across devices live.
- **Live updates:** simple polling every 2–3 s (no websockets needed).
- **AI (optional, behind a flag):** one LLM call to classify the tenant's free-text report (trade, urgency, short summary). API key from an environment variable. Must have a keyword-rule fallback so the demo works without the key.
- Monorepo layout:
  ```
  /app        Expo app (all three role views)
  /server     Express API + db.json + seed data
  /docs       connector-spec.md, assumptions.md, demo-script.md
  ```

## 3. Roles and views (one app, role picker on the start screen)
| View | User | Main device in demo | Purpose |
|---|---|---|---|
| **Tenant portal** | Tenant (Lena Hoffmann) | Phone | Report problem in one sentence + optional photo, pick a slot in one tap, follow status, rate the repair |
| **Partner app** | Craftsman company | Phone | Receive pre-filled job, accept/decline, see slots, mark arrived/done, upload invoice |
| **centrix workspace** | reltix property manager | Laptop (web) | See all units and cases, see AI suggestion, approve (one click), watch timeline, see invoice on the unit |

## 4. The flow and its states
Case status machine (one source of truth, every change logged in the timeline):

`reported → triaged → partner_matched → awaiting_pm_approval → job_sent → job_accepted → slot_offered → slot_confirmed → in_progress → completed → invoiced → closed`

Plus side states: `partner_declined` (→ match next partner), `no_slot_fits` (→ offer new slots), `escalated` (→ human in centrix).

Step by step:
1. **Detect the moment:** tenant writes "no heating since yesterday" in the portal → event `case.created` → AI/rules classify: trade = heating, urgency = high (winter, no heating).
2. **Hand over context:** centrix builds the job automatically from the unit record: address, floor, heating type, building year, photos, access notes, tenant first name + phone (only after consent), urgency. Nobody types this.
3. **Match the partner:** rules pick the best craftsman: trade matches, covers the postcode, handles this heating type, has slots in the urgency window, then best rating. Show the reason ("chosen because…").
4. **Property manager approves** in one click (human in the loop; auto-approve below a cost threshold is a configurable setting).
5. **Partner receives job** in the partner app, accepts, and publishes 2–3 slots.
6. **Tenant picks a slot** in one tap; tenant consent to share phone number is captured here.
7. **Repair:** partner marks in progress → completed, adds a short note and uploads the invoice (PDF/image or generated mock).
8. **Close the loop:** invoice + completion note are attached to the case and shown on the unit in centrix; tenant gets "repaired" and a 1–5 rating; case → closed.

Every step writes a message to the unit's communication log.

## 5. Data model (server/db.json)
- **Property:** id, address, building_year, heating_type, energy_certificate
- **Unit:** id, property_id, floor, size_sqm, rooms, meters[], access_notes
- **Contact:** id, role (owner/tenant), name, email, phone, unit_id, move_in
- **Contract:** id, unit_id, type (lease/service), details
- **Partner:** id, name, category (heating/plumbing/…), trades[], heating_types[], postcodes[], rating, hourly_rate, connector (see §7)
- **Slot:** id, partner_id, start, end, status (free/offered/booked)
- **Case:** id, unit_id, reporter_contact_id, text, photos[], trade, urgency, status, partner_id, slot_id, created_at
- **Job:** id, case_id, partner_id, payload (the pre-filled context actually shared), status
- **Consent:** id, contact_id, partner_id, data_shared[], purpose, given_at, channel
- **Document:** id, case_id, unit_id, type (invoice/photo/report), url, amount_eur
- **Message:** id, unit_id, case_id, channel (portal/app/email/system), from, to, text, timestamp
- **Event:** id, type (`case.created`, `job.accepted`, …), case_id, timestamp, data

Seed: 1 property in Aachen (Musterstraße 12, 1972, gas central heating), 3 units, owner Maria Becker, tenant Lena Hoffmann (unit_4b), 3 heating partners with different postcodes/ratings/slots so matching visibly chooses one.

## 6. Privacy and consent
- **Data minimisation:** the job payload contains only what the trade needs (address, floor, access notes, heating type, problem, photos, tenant first name + phone). Never rent, lease or other tenants' data.
- **Consent record** is stored when the tenant confirms the slot (what was shared, with whom, when, which channel). Show it in centrix.
- **Legal basis note** (for the pitch): the repair is the landlord's duty; the property manager commissions it on the owner's behalf; contact details go to the craftsman only with the tenant's consent.
- **Owner cost:** the repair is booked to the owner; above a threshold (e.g. €500) the owner must approve.

## 7. Partner connector spec (/docs/connector-spec.md + implemented for our partner)
Generic contract any partner implements. Write it so internet/energy/insurance partners could use the same shape.
1. **Manifest:** partner id, name, category, services offered (with price model)
2. **Eligibility rules:** postcodes, property/heating types, unit types, lead times
3. **Required data:** list of fields the partner needs (maps to centrix fields) → drives consent
4. **Availability:** `GET /availability?from&to` → slots
5. **Place order/job:** `POST /jobs` with the pre-filled payload → job id
6. **Status updates:** partner → centrix webhook `POST /centrix/jobs/{id}/status` with standard states (accepted, scheduled, in_progress, completed, cancelled)
7. **Result:** `POST /centrix/jobs/{id}/result` → documents (invoice, contract, report) linked to unit
8. **Errors:** decline with reason, reschedule

Include one JSON example per endpoint, and a short "how an internet provider would use the same spec" section.

## 8. API (server)
- `GET /units`, `GET /units/:id` (with cases, documents, messages)
- `POST /cases` (tenant report) · `GET /cases/:id` · `POST /cases/:id/approve`
- `GET /partners/:id/jobs` · `POST /jobs/:id/accept` · `POST /jobs/:id/decline` · `POST /jobs/:id/slots`
- `POST /cases/:id/confirm-slot` (tenant, includes consent)
- `POST /jobs/:id/status` · `POST /jobs/:id/invoice`
- `POST /demo/reset` (reset db to seed — essential for repeated demos)

## 9. Theme
- Base it on reltix's own website (reltix.de, built with Framer): inspect it for fonts, layout style, spacing, corner radius and neutral colours. Keep that clean, professional look.
- **Change the accent to orange** (we associate it with home organisation). Starting tokens, adjust after inspecting reltix.de:
  - primary `#EA580C`, primary-hover `#C2410C`, primary-soft `#FFF1E6`
  - text `#1C1917`, muted `#78716C`, border `#E7E5E4`, background `#FAFAF9`, card `#FFFFFF`
  - success `#16A34A`, warning `#D97706`, danger `#DC2626`
- Put all tokens in one `theme.ts` so the colour can be changed in one place.
- Status chips coloured by state; a vertical timeline component for the case history.
- Do not copy reltix's logo; use the name "centrix (demo)" in plain text.

## 10. Milestones (24h)
1. **(2h)** Repo, Expo app with role picker and theme, server with seed data and `/demo/reset`.
2. **(4h)** Tenant report → case created → centrix shows it (polling).
3. **(4h)** Matching + PM approval + partner receives pre-filled job.
4. **(3h)** Slots offered → tenant confirms (consent stored) → partner completes → invoice on unit.
5. **(2h)** Timeline + communication log + consent view in centrix.
6. **(2h)** Optional AI triage with fallback; decline/reschedule path.
7. **(3h)** Docs: connector spec, assumptions, demo script. Polish UI.
8. **(rest)** Rehearse demo on 2 phones + 1 laptop; buffer.

## 11. Acceptance criteria
- Full flow runs in under 2 minutes live, across a phone (tenant), a phone (partner) and a laptop (centrix).
- Tenant types one sentence and makes one tap; no forms.
- Partner never re-enters data that centrix already has.
- Invoice and consent record visible on the unit at the end.
- `/demo/reset` restores a clean state.
- Works on web and in Expo Go.

## 12. Out of scope
Real email/SMS/phone, real payments, authentication (role picker only), real reltix APIs, multiple partner categories.
