# Demo script (under 2 minutes)

**Setup:** laptop runs the server and shows `/centrix` on the projector. Phone 1 (tenant) and phone 2 (partner) open the app in Expo Go (or the web URL on the LAN). Before going on stage: tap **Reset demo** in centrix.

| Time | Who / device | Action | Say |
|---|---|---|---|
| 0:00 | – | – | "It's November in Aachen. Lena's heating has been off since yesterday. Today that's a dozen calls and e-mails. Watch it with zero forms." |
| 0:10 | Tenant phone | Type or tap **No heating since yesterday** → send (↑) – it opens as a chat | "One sentence. No address, no flat number, no boiler model – centrix already knows." |
| 0:20 | Laptop | Case appears on unit 2nd floor right, chips *heating · high urgency* | "Triage: heating, high urgency because it's heating season." |
| 0:30 | Laptop | Point at **Suggested next step**, open **Show why** | "centrix picked Smith Heating: covers 52062, handles gas, free tomorrow, 4.8 stars. Cooper & Sons has better ratings but no slot within 48 hours – so it's excluded, and we say why." |
| 0:45 | Laptop | **Approve & send job** | "Human in the loop: nothing goes to a partner without a person approving it. One click." |
| 0:50 | Partner phone | Job appears pre-filled; his calendar shows where he already has to be – tap **Suggest times** (or tap free time) → **Accept & offer 3 times** | "The engineer gets address, floor, boiler model and photos. Not her name, not the door code, not the phone number – that is locked until Lena agrees." |
| 1:05 | Tenant phone | Tap one slot (toggle *may call me* stays on) | "One tap books it and records her consent to share her number – for this repair only." |
| 1:15 | Partner phone | Phone number now visible → **I've arrived** → type the part and its price → **Done – send report & invoice** | "He enters parts himself; call-out and labour come from his own rates." |
| 1:30 | Laptop | Timeline, invoice under *Documents*, consent record, communication log | "Invoice and report sit on the unit, the owner got an e-mail, consent is logged and expires with the case." |
| 1:40 | Tenant phone | Tap ★★★★★ | "Lena rates it, case closed. Same connector works for internet at move-in or a new energy contract – only the manifest changes." |

**Backup paths to show if asked**
- Tenant taps **I need an internet connection** → the assistant offers what the building supports (fibre, cable, DSL, 5G bridge) with prices → tenant replies "Yes, Fibre 500" → centrix shows *Service lead: Example Fibre Fibre 500*. Same for **Do I need contents insurance?** and **Help with moving out**.
- Tenant asks in the chat "When is the paper bin collected?" → the reltix assistant answers from the house info; "Can I pay less rent?" → it hands over to the PM (centrix shows *Reply needed*).
- centrix **Insights**: unsolved cases over time, new vs resolved per week, open cases by city (urgent vs routine), partner workload and changes, contract deadlines – updates live every few seconds.
- centrix search: type a street, tenant or owner across ~1,150 units; filter by city or open cases.
- Unit → **Change tenant**: new lease, old consents revoked, history stays.
- Partner app → **History**: a completed job (work done, invoice lines, rating) and a declined one (reason, date). **Schedule**: the next two weeks with *Add to Google Calendar* and a calendar feed.
- Partner taps **Fully booked** → centrix suggests *Miller Building Services* automatically.
- Tenant taps **None of these work for me** → partner sees "Tenant needs other times" and offers new slots.

**If something breaks:** `curl -X POST http://<laptop>:4000/demo/reset`, or run `npm run smoke` in `server/` to push a full case through the API.
