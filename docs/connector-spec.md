# centrix Partner Connector Spec v1.0

One contract for every partner around a property – craftsmen, internet, energy, insurance, moving. A partner implements this once and receives demand from every centrix unit it is eligible for. Nothing in the spec is heating-specific; the heating engineer is just the first implementation.

**Principles**
- **centrix fills, the partner never re-types.** The partner declares which fields it needs; centrix resolves them from the property record.
- **Minimal data, consent where personal.** Only declared fields are shared. Fields marked `consent: true` are withheld until the resident agrees, and the consent is logged.
- **One status vocabulary.** Every partner reports the same job states, so centrix can show one timeline for any service.
- **Results land on the unit.** Invoices, contracts and reports are written back and linked to the case and the unit.

| # | Part | Direction | Endpoint |
|---|------|-----------|----------|
| 1 | Manifest | partner → centrix (registration) | `GET /connector/partners` lists them |
| 2 | Eligibility rules | in manifest | – |
| 3 | Required data | in manifest | – |
| 4 | Availability | centrix → partner | `GET {partner}/availability?from&to` |
| 5 | Place job/order | centrix → partner | `POST {partner}/jobs` |
| 6 | Status updates | partner → centrix | `POST /centrix/jobs/{id}/status` |
| 7 | Result | partner → centrix | `POST /centrix/jobs/{id}/result` |
| 8 | Errors | partner → centrix | `status: declined / cancelled`, `slots_offered` to reschedule |

In the demo, `{partner}` is `/connector/partners/{partner_id}` on our server (we simulate the partner's system). A real partner hosts these on its own domain.

---

## 1. Manifest

```json
{
  "spec_version": "1.0",
  "partner_id": "p_schmitz",
  "name": "Smith Heating Ltd",
  "category": "craftsman",
  "services": [
    {
      "code": "heating.repair",
      "name": "Heating fault repair",
      "price_model": {
        "type": "time_and_material",
        "callout_fee_eur": 49,
        "hourly_rate_eur": 68,
        "typical_hours": 1.5,
        "vat_rate": 0.19
      }
    },
    { "code": "heating.service", "name": "Annual heating service",
      "price_model": { "type": "fixed", "price_eur": 129, "vat_rate": 0.19 } }
  ],
  "eligibility": { "...": "see §2" },
  "required_data": [ "...see §3" ],
  "endpoints": { "availability": "https://api.schmitz.example/availability", "jobs": "https://api.schmitz.example/jobs" },
  "webhooks": { "status": "/centrix/jobs/{job_id}/status", "result": "/centrix/jobs/{job_id}/result" }
}
```

`price_model.type` is one of `fixed`, `time_and_material`, `subscription` (monthly, e.g. internet/energy), `quote` (partner returns a price after seeing the job). centrix uses it to estimate cost before approval and to check the owner's budget.

## 2. Eligibility rules

```json
{
  "trades": ["heating"],
  "postcodes": ["52062", "52064", "52066"],
  "property": { "heating_types": ["gas", "oil"] },
  "lead_time_hours": { "emergency": 6, "high": 48, "normal": 120, "low": 336 }
}
```

centrix runs these as checks and keeps the result per candidate, so the property manager sees *why* a partner was chosen or excluded. Ranking among eligible partners: rating, then earliest free slot. Any rule is optional; unknown keys are ignored, so new categories add their own (e.g. `fibre_available: true`).

## 3. Required data

Each entry maps to a field in the centrix record. This list is the **only** data the partner can receive, and it drives the consent screen.

```json
[
  { "field": "property.address",        "purpose": "Get to the building" },
  { "field": "unit.floor",              "purpose": "Find the flat" },
  { "field": "property.heating_system", "purpose": "Bring the right parts" },
  { "field": "case.summary",            "purpose": "Understand the fault" },
  { "field": "case.photos",             "purpose": "Diagnose before arrival" },
  { "field": "tenant.phone",            "purpose": "Call to be let in", "consent": true }
]
```

Available fields today: `property.address`, `property.heating_system`, `property.building_year`, `unit.floor`, `unit.access_notes`, `unit.meters`, `unit.move_in`, `case.summary`, `case.urgency`, `case.photos`, `tenant.first_name`, `tenant.name`, `tenant.phone`, `tenant.email`. Rent, lease terms, other residents and owner data are never in the catalogue.

## 4. Availability

`GET {partner}/availability?from=2026-11-21T00:00:00Z&to=2026-11-23T00:00:00Z`

```json
[
  { "id": "s_sch_1", "start": "2026-11-21T07:00:00Z", "end": "2026-11-21T09:00:00Z", "status": "free" },
  { "id": "s_sch_2", "start": "2026-11-21T12:00:00Z", "end": "2026-11-21T14:00:00Z", "status": "free" }
]
```

The availability feed lists what the partner is **already doing** (`busy` blocks from his own calendar, `booked` centrix visits, `offered` windows waiting for a tenant) – not free slots. Free time is computed by centrix: working hours (`working_hours` in the partner profile) minus everything in the feed. `GET {partner}/free-windows?days=5&hours=2` returns ready-made suggestions.

**Calendar feed (centrix → partner):** `GET /connector/partners/{partner_id}/calendar.ics` returns every booked visit as iCalendar, so a partner can subscribe from Google Calendar, Outlook or Apple Calendar and never copy appointments by hand. Each visit can also be added on its own with a Google Calendar link from the partner app.

## 5. Place job / order

`POST {partner}/jobs` → `201 { "job_id": "job_mwpbvgj8q" }`

```json
{
  "job_ref": "case_mwpbvgj6i",
  "service": "heating.repair",
  "case": { "trade": "heating", "urgency": "high", "reported_at": "2026-11-20T18:48:00Z" },
  "fields": {
    "property.address": "12 Sample Street, 52062 Aachen",
    "unit.floor": "2nd floor right (floor 2)",
    "property.heating_system": { "type": "Gas central heating", "make": "ThermoMax Combi 24", "installed": 2014 },
    "case.summary": "Heating failure in the flat. Tenant: \"No heating since yesterday\""
  },
  "withheld": [ { "field": "tenant.phone", "reason": "awaiting tenant consent" } ]
}
```

When the resident later consents, centrix re-sends the job with the extra fields (same `job_ref`).

## 6. Status updates (webhook)

`POST /centrix/jobs/{job_id}/status`

| status | meaning | extra fields |
|---|---|---|
| `accepted` | partner takes the job | `windows: [{start, end}]` – up to 3 times picked from his free time; centrix rejects anything that overlaps his calendar |
| `declined` | partner can't take it | `reason` → centrix matches the next partner |
| `slots_offered` | (re)offer times, e.g. after the resident asked for others | `windows` |
| `scheduled` | sent by centrix to the partner when the resident picks a slot | `slot` |
| `in_progress` | work started / on site | – |
| `completed` | work finished | `note` |
| `cancelled` | partner cancels after accepting | `reason` → escalated to a human |

```json
{ "status": "accepted", "windows": [
  { "start": "2026-11-21T07:00:00Z", "end": "2026-11-21T09:00:00Z" },
  { "start": "2026-11-23T06:00:00Z", "end": "2026-11-23T08:00:00Z" } ] }
```
```json
{ "status": "completed", "note": "Replaced ignition electrode. Topped up system pressure to 1.5 bar" }
```

## 7. Result (webhook)

`POST /centrix/jobs/{job_id}/result` – documents are linked to the case **and** the unit.

```json
{
  "note": "Replaced ignition electrode",
  "invoice": { "hours": 1.5, "parts": [ { "text": "Ignition electrode", "amount_eur": 38.9 } ] },
  "documents": [ { "type": "invoice", "url": "https://…/INV-2026-1001.pdf", "amount_eur": 225.98 } ]
}
```

Document types: `invoice`, `report`, `contract`, `photo`, `certificate`. In the demo, centrix generates the invoice from `invoice` (hours + parts) and the partner's manifest rates, so the partner only confirms hours and parts; uploaded `documents` are a planned extension.

## 8. Errors and edge cases

- **Decline** → `status: declined` with a reason. centrix excludes that partner and re-runs matching; the next suggestion goes to the PM for approval.
- **No slot fits** → the resident taps "none of these work". The job goes to `reschedule_requested` and the partner receives the note; it answers with `slots_offered`.
- **No eligible partner** → case is `escalated` to a human.
- **Validation errors** → `4xx { "error": "human-readable message" }`. (Planned: idempotency per `(job_id, status)`; not in the demo.)

---

## How an internet provider would use the same spec

Moment: `tenant.move_in` 10 days ahead. Partner: *Example Fibre Ltd*.

| Part | Heating engineer | Internet provider |
|---|---|---|
| Manifest services | `heating.repair`, `time_and_material` | `internet.fibre_500`, `subscription` 34.99 €/month |
| Eligibility | postcodes, heating types, lead time | postcodes, `fibre_available` per building, earliest activation date |
| Required data | address, floor, heating system, phone (consent) | `tenant.name`, `property.address`, `unit.move_in`, `tenant.email` (consent) |
| Availability | engineer slots | installation appointments (if a technician visit is needed), else skipped |
| Place order | job with pre-filled fields | order with pre-filled fields; resident signs in one tap |
| Status | accepted → in_progress → completed | accepted → scheduled → `completed` = line active |
| Result | invoice + report → unit | signed `contract` (product, start date, monthly price) → unit |

No new endpoints, no new states – only a new manifest. Energy (`energy.electricity`, meter number from `unit.meters`) and insurance (`insurance.contents`, `unit.size_sqm`) follow the same pattern.
