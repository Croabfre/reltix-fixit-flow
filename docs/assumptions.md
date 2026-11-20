# Assumptions

## Why this partner, at this moment
- A broken heater is the most frequent urgent repair a German property manager handles, and the one that costs the most phone calls today (tenant → PM → several craftsmen → tenant → craftsman …).
- In heating season (Oct–Apr) the landlord must restore heating quickly; a cold flat is a rent-reduction risk. The moment is unambiguous and time-critical, so automation pays off immediately.
- centrix already holds everything the craftsman needs (address, floor, access, boiler make and age, service history). That makes "zero forms" real, not a gimmick.

## Data
- centrix holds per property: address, building year, heating type **and boiler model / install year / location / last service** (realistic: comes from the annual service report and the chimney sweep's record).
- Units hold floor, size, rooms, meters and **access notes** (door codes, key safe) – PMs keep these for caretakers anyway.
- Tenant phone and email exist in centrix from the lease; sharing them with a third party needs consent.
- **Prices for repairs:** each craftsman registers a call-out fee and hourly rate in his connector manifest (framework agreement with reltix). centrix uses them for the estimate the PM sees before approving. On site, the craftsman enters each part and any other item with its amount himself; labour is his hours × his rate. centrix checks the total against the owner's €500 limit.
- Slots are seeded relative to today so the demo always shows "tomorrow 08:00", whatever day it runs.

## Process
- **Human in the loop:** a property manager approves every job with one click before it goes to a partner. There is no automatic approval, whatever the amount.
- **Owner budget:** repairs are booked to the owner. Above €500 the owner must approve (shown in the suggestion and in the owner e-mail after invoicing).
- **Matching:** trade → postcode → heating type → free slot within the urgency window (high = 48 h) → best rating → earliest slot. Every check is stored, so "chosen because…" and "excluded because…" are explainable.
- **Decline:** the next eligible partner is suggested automatically and again needs PM approval. If none is left, the case is escalated to a human.
- **Rescheduling:** the tenant can say "none of these work"; the partner gets the note and offers new slots.
- **Triage:** an LLM (OpenAI, or Anthropic) classifies trade, urgency and summary when a key is set in `server/.env` and AI triage is on; otherwise keyword rules (German and English) decide. The demo never depends on the LLM.

- **Portfolio grouping:** centrix groups units by city, then by building. Ownership is too mixed to group by (companies, single owners, WEGs with many owners), while a property manager plans by location – craftsmen, caretakers and site visits are local. The owner is shown on each building.
- **Request history is kept, not deleted after 30 days.** Resolved requests stay in the tenant's "My requests" and on the unit in centrix. Reasons: craftsman work has a 2-year warranty (5 years on building work, § 634a BGB), so the record is needed if the same fault comes back; invoices have to be kept for the owner's accounts (§ 147 AO: up to 10 years); rent-reduction disputes refer back to when a defect was reported; and the tenant can see what was already fixed. What *is* limited: the consent to share the phone number ends when the case closes, and the partner never received name, access codes or anything beyond the job. Deleting old chats after a retention period is a policy setting we would add for a real deployment, not something to do after 30 days.

- **Unit file vs. history:** the top of a unit's file holds the papers that describe the tenancy and the flat – leases, handover protocols, energy certificate. Invoices and repair reports are not loose documents; they sit inside the case that caused them, in the unit's history.
- **Changing tenants:** the PM enters the new tenant's name, contact and move-in date. centrix ends the old lease the day before, marks the old tenant as former tenant, revokes every consent they gave (partners lose the phone number), adjusts the doorbell name in the access notes, files a new lease and sends the new tenant a portal invite. The unit keeps its full history – cases, invoices, documents, and who reported what. The old tenant keeps read access to their own requests for 6 months; the new tenant sees none of them.
- **Tenant assistant:** after the first report, the tenant can ask questions in the request's chat. With an API key, an LLM answers using only that request, the flat's furnishings and the building's house info (bins, caretaker, emergency numbers, quiet hours, heating tips). It never makes up dates or prices, never discusses rent, other tenants or blame for damage – those go to the property manager, who sees "reply needed" in centrix. Without a key, every question goes to the PM.
- **Handymen:** anything that isn't a specialist trade (furniture provided by the landlord, doors, locks, small fixes) goes to a handyman partner. If no partner fits at all, the PM picks one by hand from the case page.
- **Scale:** the demo data includes ~150 generated buildings (~1,150 units) in six cities, owned by companies, owners' associations and private landlords – all fictional. The workspace starts with search instead of a list, and the server answers searches, so it doesn't matter how many units there are.
- **Insights dashboard:** computed on the server from the live records (cases, partner events, contracts) every time it is opened, refreshed every 5 seconds. The seed adds a year of fictional case history (more heating cases in winter), partner joins, declines and rating changes, service contracts with notice periods, leases ending, energy certificates and heating services falling due, so the charts have something to show.
- **AI language:** the tenant assistant and the triage write in English by default, even when the tenant writes German; the assistant switches only if the tenant asks for another language.
- **Storage:** a single SQLite file (`server/centrix.db`) through Node's built-in driver – free, no account, no domain, nothing to host. Supabase (free tier, hosted Postgres) would also work without a domain, but needs an account and internet during the demo, and adds nothing to it; `store.js` is the only file to replace when moving there.

## Privacy and consent (GDPR)
- **Legal basis:** maintaining the rented property is the landlord's duty (§ 535 BGB). The PM commissions the repair on the owner's behalf. Passing the address and access details to the craftsman is necessary to perform that duty (Art. 6(1)(b)/(f) GDPR). The tenant's **phone number** is shared only with consent (Art. 6(1)(a)).
- **Data minimisation:** the partner manifest lists required fields with a purpose. Only those are sent. The craftsman gets the address, floor, heating system, problem and photos – not the tenant's name and not the access notes (door codes). He gets in by calling the tenant (with consent) or ringing the bell. Rent, lease terms, other tenants and owner data are never in the field catalogue.
- **Consent record:** who, which fields, which partner, purpose, channel, timestamp. Shown to the tenant and in centrix. It expires when the case closes.
- **Withheld until consent:** the job first goes out without the phone number; it is added automatically once the tenant books a slot with "may call me" on.

## Out of scope / simplified
- No real SMS, e-mail or phone; messages are logged and shown in the portal / partner app.
- No authentication: a role picker stands in for login.
- No real payments; the invoice is a generated document booked to the owner.
- Partner systems are simulated inside our server, behind the same endpoints a real partner would host.
- One partner category (heating craftsmen). The connector spec is written so others plug in without changes.
