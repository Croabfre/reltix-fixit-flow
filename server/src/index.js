import express from 'express';
import cors from 'cors';
import os from 'node:os';
import { getDb, reset, save } from './store.js';
import * as flow from './flow.js';
import { FIELD_LABELS } from './connector.js';
import { matchPartners, freeWindows } from './matching.js';
import { aiProvider } from './triage.js';
import { buildStats } from './stats.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use((req, _res, next) => {
  if (req.method !== 'GET') console.log(`${req.method} ${req.path}`);
  next();
});

const wrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req, res));
  } catch (err) {
    if (!(err instanceof flow.FlowError)) console.error(err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
};

// ------------------------------------------------------------ views (read models)

function partnerName(id) {
  return getDb().partners.find((p) => p.id === id)?.name ?? null;
}

function caseView(kase, { full = false } = {}) {
  const db = getDb();
  const job = db.jobs.find((j) => j.id === kase.job_id) ?? null;
  const slot = db.slots.find((s) => s.id === kase.slot_id) ?? null;
  const partner = db.partners.find((p) => p.id === kase.partner_id);
  const view = {
    ...kase,
    status_label: flow.STATUS_LABELS[kase.status],
    partner: partner ? { id: partner.id, name: partner.name, rating: partner.rating, contact_person: partner.contact_person } : null,
    slot,
    offered_slots: job ? db.slots.filter((s) => job.offered_slot_ids.includes(s.id)) : [],
    documents: db.documents.filter((d) => d.case_id === kase.id),
    consents: db.consents.filter((c) => c.case_id === kase.id).map((c) => ({ ...c, partner_name: partnerName(c.partner_id) })),
  };
  if (full) {
    view.job = job;
    view.timeline = db.events.filter((e) => e.case_id === kase.id);
    view.messages = db.messages.filter((m) => m.case_id === kase.id);
  }
  return view;
}

function unitView(unit, { full = false } = {}) {
  const db = getDb();
  const property = db.properties.find((p) => p.id === unit.property_id);
  const tenant = db.contacts.find((c) => c.unit_id === unit.id && c.role === 'tenant');
  const owner = db.contacts.find((c) => c.id === property.owner_contact_id);
  const cases = db.cases.filter((c) => c.unit_id === unit.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const view = {
    ...unit,
    property,
    tenant,
    owner,
    open_cases: cases.filter((c) => c.status !== 'closed').length,
    latest_case: cases[0] ? { id: cases[0].id, status: cases[0].status, status_label: flow.STATUS_LABELS[cases[0].status], summary: cases[0].summary } : null,
  };
  if (full) {
    view.contracts = db.contracts.filter((c) => c.unit_id === unit.id);
    view.cases = cases.map((c) => caseView(c, { full: true }));
    // The unit's file: leases, handover protocols, certificates. Invoices live with their case.
    view.documents = db.documents.filter((d) => d.unit_id === unit.id && !d.case_id);
    view.tenancies = db.contacts
      .filter((c) => c.unit_id === unit.id && (c.role === 'tenant' || c.role === 'former_tenant'))
      .sort((a, b) => (b.move_in ?? '').localeCompare(a.move_in ?? ''));
    view.consents = db.consents.filter((c) => c.contact_id === tenant?.id).map((c) => ({ ...c, partner_name: partnerName(c.partner_id) }));
    view.messages = db.messages.filter((m) => m.unit_id === unit.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
  return view;
}

// ------------------------------------------------------------ centrix workspace

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/settings', wrap(() => ({ ...getDb().settings, ai_available: Boolean(aiProvider()), ai_provider: aiProvider() })));
app.patch('/settings', wrap((req) => {
  const s = getDb().settings;
  for (const k of ['owner_approval_above_eur', 'auto_approve_below_eur', 'ai_triage']) if (k in req.body) s[k] = req.body[k];
  save();
  return s;
}));

app.get('/units', wrap(() => getDb().units.map((u) => unitView(u))));
app.get('/units/:id', wrap((req) => {
  const unit = getDb().units.find((u) => u.id === req.params.id);
  if (!unit) throw new flow.FlowError('Unit not found', 404);
  return unitView(unit, { full: true });
}));

app.get('/cases', wrap(() => getDb().cases.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((c) => caseView(c))));
app.get('/cases/:id', wrap((req) => {
  const kase = getDb().cases.find((c) => c.id === req.params.id);
  if (!kase) throw new flow.FlowError('Case not found', 404);
  return caseView(kase, { full: true });
}));
app.post('/cases', wrap((req) => flow.createCase(req.body)));
app.post('/cases/:id/approve', wrap((req) => flow.approve(req.params.id, req.body ?? {})));
app.post('/cases/:id/escalate', wrap((req) => flow.escalate(req.params.id, req.body ?? {})));
app.post('/cases/:id/confirm-slot', wrap((req) => flow.confirmSlot(req.params.id, req.body)));
app.post('/cases/:id/no-slot-fits', wrap((req) => flow.noSlotFits(req.params.id, req.body ?? {})));
app.get('/stats', wrap((req) => buildStats(getDb(), { city: String(req.query.city ?? 'all'), weeks: Math.min(52, Math.max(4, Number(req.query.weeks) || 26)) })));
app.post('/cases/:id/close', wrap((req) => flow.closeRequest(req.params.id, req.body ?? {})));
app.post('/cases/:id/assign', wrap((req) => flow.assign(req.params.id, req.body)));
app.post('/units/:id/tenancy', wrap((req) => flow.changeTenant(req.params.id, req.body)));
app.get('/units/:id/current-tenant', wrap((req) => {
  const t = getDb().contacts.find((c) => c.unit_id === req.params.id && c.role === 'tenant');
  if (!t) throw new flow.FlowError('This unit is vacant.', 404);
  return { id: t.id, name: t.name };
}));

// Workspace search across buildings, units, people and cases. Runs on the server so it scales past what a page can hold.
app.get('/search', wrap((req) => {
  const db = getDb();
  const q = String(req.query.q ?? '').toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  const type = String(req.query.type ?? 'all');
  const city = String(req.query.city ?? 'all');
  const status = String(req.query.status ?? 'all');
  const limit = 25;
  const hit = (...parts) => {
    const hay = parts.filter(Boolean).join(' ').toLowerCase();
    return tokens.every((t) => hay.includes(t));
  };
  const propOf = (unitId) => db.properties.find((p) => p.id === db.units.find((u) => u.id === unitId)?.property_id);
  const inCity = (p) => city === 'all' || p?.city === city;
  const openCaseOf = (unitId) => db.cases.find((c) => c.unit_id === unitId && c.status !== 'closed');

  const units = db.units
    .map((u) => {
      const p = propOf(u.id);
      const tenant = db.contacts.find((c) => c.unit_id === u.id && c.role === 'tenant');
      const open = openCaseOf(u.id);
      return { id: u.id, label: u.label, street: p.street, city: p.city, postcode: p.postcode, tenant: tenant?.name ?? null, open_case: open ? { id: open.id, title: open.title, status: open.status, status_label: flow.STATUS_LABELS[open.status] } : null, _p: p, _owner: db.contacts.find((c) => c.id === p.owner_contact_id)?.name };
    })
    .filter((u) => inCity(u._p) && (status === 'all' || (status === 'open' ? u.open_case : !u.open_case)))
    .filter((u) => hit(u.label, u.street, u.city, u.postcode, u.tenant, u._owner, u.id));

  const buildings = db.properties
    .filter((p) => inCity(p))
    .map((p) => ({ id: p.id, street: p.street, city: p.city, postcode: p.postcode, owner: db.contacts.find((c) => c.id === p.owner_contact_id)?.name, units: db.units.filter((u) => u.property_id === p.id).length, first_unit: db.units.find((u) => u.property_id === p.id)?.id }))
    .filter((b) => hit(b.street, b.city, b.postcode, b.owner));

  const people = db.contacts
    .filter((c) => c.role === 'tenant' || c.role === 'former_tenant' || c.role === 'owner')
    .map((c) => {
      const u = db.units.find((x) => x.id === c.unit_id);
      const p = u ? propOf(u.id) : db.properties.find((x) => x.owner_contact_id === c.id);
      return { id: c.id, name: c.name, role: c.role, unit_id: u?.id ?? db.units.find((x) => x.property_id === p?.id)?.id, where: u ? `${u.label} · ${p.street}` : p ? `Owner of ${p.street}` : '', city: p?.city, _p: p, move_out: c.move_out };
    })
    .filter((c) => inCity(c._p) && tokens.length && hit(c.name, c.where));

  const cases = db.cases
    .map((k) => {
      const u = db.units.find((x) => x.id === k.unit_id);
      const p = propOf(k.unit_id);
      return { id: k.id, unit_id: k.unit_id, title: k.title, trade: k.trade, status: k.status, status_label: flow.STATUS_LABELS[k.status], created_at: k.created_at, where: `${u.label} · ${p.street}`, city: p.city, _p: p, _text: k.text };
    })
    .filter((k) => inCity(k._p) && (status === 'all' || (status === 'open' ? k.status !== 'closed' : k.status === 'closed')))
    .filter((k) => tokens.length && hit(k.title, k.trade, k.where, k._text))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const strip = (list) => list.slice(0, limit).map(({ _p, _owner, _text, ...rest }) => rest);
  const want = (t) => type === 'all' || type === t;
  return {
    query: q,
    cities: [...new Set(db.properties.map((p) => p.city))],
    needs_approval: db.cases.filter((c) => c.status === 'awaiting_pm_approval' || c.status === 'escalated' || c.needs_pm_reply).map((c) => ({ id: c.id, unit_id: c.unit_id, title: c.title, status: c.status, needs_reply: !!c.needs_pm_reply, reason: c.handover_reason ?? null })),
    units: want('units') ? { total: units.length, items: strip(units) } : null,
    buildings: want('buildings') && tokens.length ? { total: buildings.length, items: strip(buildings) } : null,
    people: want('people') ? { total: people.length, items: strip(people) } : null,
    cases: want('cases') ? { total: cases.length, items: strip(cases) } : null,
  };
}));

app.post('/cases/:id/messages', wrap((req) => flow.postMessage(req.params.id, req.body)));
app.post('/cases/:id/rate', wrap((req) => flow.rate(req.params.id, req.body)));
app.get('/cases/:id/match', wrap((req) => {
  const kase = getDb().cases.find((c) => c.id === req.params.id);
  return matchPartners(getDb(), kase, { exclude: kase.declined_partner_ids });
}));

app.get('/documents/:id', (req, res) => {
  const doc = getDb().documents.find((d) => d.id === req.params.id);
  if (!doc) return res.status(404).send('Not found');
  res.type('html').send(invoiceHtml(doc));
});

// ------------------------------------------------------------ tenant portal

app.get('/tenants/:contactId', wrap((req) => {
  const db = getDb();
  const contact = db.contacts.find((c) => c.id === req.params.contactId);
  if (!contact) throw new flow.FlowError('Tenant not found', 404);
  const unit = db.units.find((u) => u.id === contact.unit_id);
  const property = db.properties.find((p) => p.id === unit.property_id);
  const cases = db.cases
    .filter((c) => c.reporter_contact_id === contact.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((c) => {
      const v = caseView(c, { full: true });
      delete v.match; // tenant doesn't see partner ranking
      delete v.job;
      // Only name the craftsman once the PM has approved and the job is out.
      if (['reported', 'triaged', 'partner_matched', 'awaiting_pm_approval', 'partner_declined', 'escalated'].includes(c.status)) v.partner = null;
      return v;
    });
  return { contact, unit: { ...unit, address: property.address }, cases };
}));
app.get('/tenants', wrap(() => getDb().contacts.filter((c) => c.role === 'tenant')));

// ------------------------------------------------------------ connector: partner side
// These mirror docs/connector-spec.md. The partner app uses exactly these.

app.get('/connector/partners', wrap(() => getDb().partners.map((p) => p.connector)));
app.get('/connector/fields', wrap(() => FIELD_LABELS));
app.get('/partners', wrap(() => getDb().partners.map(({ connector, ...p }) => p)));

// Suggested free windows (working hours minus everything in the calendar).
app.get('/connector/partners/:id/free-windows', wrap((req) => {
  const partner = getDb().partners.find((p) => p.id === req.params.id);
  if (!partner) throw new flow.FlowError('Unknown partner', 404);
  const days = Math.min(14, Number(req.query.days) || 7);
  return freeWindows(getDb(), partner, { until: new Date(Date.now() + days * 864e5), hours: Number(req.query.hours) || 2 });
}));

app.get('/connector/partners/:id/availability', wrap((req) => {
  const from = req.query.from ? new Date(req.query.from) : new Date();
  const to = req.query.to ? new Date(req.query.to) : new Date(Date.now() + 14 * 864e5);
  return getDb().slots
    .filter((s) => s.partner_id === req.params.id)
    .filter((s) => new Date(s.start) >= from && new Date(s.start) <= to)
    .sort((a, b) => a.start.localeCompare(b.start));
}));

// Partner inbox: jobs with the minimal payload (what the partner actually sees).
function partnerJobView(db, j) {
  const kase = db.cases.find((c) => c.id === j.case_id);
  const unit = db.units.find((u) => u.id === kase.unit_id);
  const property = db.properties.find((p) => p.id === unit.property_id);
  const payload = structuredClone(j.payload);
  // Once the tenant's consent has ended (case closed), the phone number is gone from the partner's view too.
  const consentActive = db.consents.some((c) => c.case_id === kase.id && c.partner_id === j.partner_id && !c.expired_at && !c.revoked_at);
  if (!consentActive && payload.fields['tenant.phone']) {
    delete payload.fields['tenant.phone'];
    payload.expired = ['tenant.phone'];
  }
  // A partner who declined only keeps the bare job, no further updates.
  const declined = j.status === 'declined';
  return {
    ...j,
    payload,
    title: kase.title ?? `${kase.trade} repair`,
    city: property.city,
    case_status: declined ? 'declined' : kase.status,
    case_status_label: declined ? 'Declined' : flow.STATUS_LABELS[kase.status],
    offered_slots: db.slots.filter((s) => j.offered_slot_ids.includes(s.id)),
    slot: db.slots.find((s) => s.id === j.slot_id) ?? null,
    documents: declined ? [] : db.documents.filter((d) => d.job_id === j.id),
    rating: declined ? null : kase.rating,
    completed_at: j.completed_at ?? db.documents.find((d) => d.job_id === j.id && d.type === 'invoice')?.issued_at ?? null,
  };
}

app.get('/connector/partners/:id/jobs', wrap((req) => {
  const db = getDb();
  return db.jobs
    .filter((j) => j.partner_id === req.params.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((j) => partnerJobView(db, j));
}));

// Partner calendar as iCalendar: subscribe from Google Calendar ("From URL") or import the file.
app.get('/connector/partners/:id/calendar.ics', (req, res) => {
  const db = getDb();
  const partner = db.partners.find((p) => p.id === req.params.id);
  if (!partner) return res.status(404).send('Unknown partner');
  const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (t) => String(t).replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const events = db.jobs
    .filter((j) => j.partner_id === partner.id && j.slot_id && j.status !== 'declined')
    .map((j) => {
      const slot = db.slots.find((s) => s.id === j.slot_id);
      const kase = db.cases.find((c) => c.id === j.case_id);
      const f = j.payload.fields;
      return [
        'BEGIN:VEVENT',
        `UID:${j.id}@centrix.demo`,
        `DTSTAMP:${stamp(new Date().toISOString())}`,
        `DTSTART:${stamp(slot.start)}`,
        `DTEND:${stamp(slot.end)}`,
        `SUMMARY:${esc(`${kase.title ?? 'Repair'} – ${f['unit.floor'] ?? ''}`)}`,
        `LOCATION:${esc(f['property.address'] ?? '')}`,
        `DESCRIPTION:${esc(`${f['case.summary'] ?? ''}\nJob ${j.id} via centrix`)}`,
        'END:VEVENT',
      ].join('\r\n');
    });
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//centrix demo//partner calendar//EN', `X-WR-CALNAME:${esc(partner.name)} – centrix jobs`, ...events, 'END:VCALENDAR'].join('\r\n');
  res.type('text/calendar').set('content-disposition', `inline; filename="${partner.id}.ics"`).send(ics);
});

// Webhooks partner → centrix (spec §6, §7)
app.post('/centrix/jobs/:id/status', wrap((req) => flow.partnerStatus(req.params.id, req.body)));
app.post('/centrix/jobs/:id/result', wrap((req) => flow.partnerResult(req.params.id, req.body)));

// Short aliases from the plan
app.post('/jobs/:id/accept', wrap((req) => flow.partnerStatus(req.params.id, { ...req.body, status: 'accepted' })));
app.post('/jobs/:id/decline', wrap((req) => flow.partnerStatus(req.params.id, { ...req.body, status: 'declined' })));
app.post('/jobs/:id/slots', wrap((req) => flow.partnerStatus(req.params.id, { ...req.body, status: 'slots_offered' })));
app.post('/jobs/:id/status', wrap((req) => flow.partnerStatus(req.params.id, req.body)));
app.post('/jobs/:id/invoice', wrap((req) => flow.partnerResult(req.params.id, req.body)));

// ------------------------------------------------------------ demo

app.post('/demo/reset', wrap(() => {
  reset();
  return { ok: true };
}));

function invoiceHtml(doc) {
  const eur = (n) => `€${Number(n).toFixed(2)}`;
  if (doc.type !== 'invoice') {
    return `<!doctype html><meta charset="utf-8"><title>${doc.title}</title>
<style>body{font:15px/1.6 -apple-system,'IBM Plex Sans',sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#1A1A1A;background:#FCF6EF}
h1{font-family:Baskervville,Georgia,serif;font-weight:600;color:#330933;letter-spacing:-.02em}td{padding:8px 0;border-bottom:1px solid #EDE4DB}td:first-child{color:#797979;width:40%}table{width:100%;border-collapse:collapse}.muted{color:#797979}</style>
<p class="muted">${doc.issuer ?? ''} · demo document${doc.status === 'ended' ? ' · ended' : ''}</p><h1>${doc.title}</h1>
<table>${(doc.fields ?? []).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
${doc.note ? `<p>${doc.note}</p>` : ''}`;
  }
  return `<!doctype html><meta charset="utf-8"><title>${doc.number}</title>
<style>body{font:15px/1.5 -apple-system,Inter,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#2A0E2C}
h1{font-family:Georgia,serif;font-weight:400}table{width:100%;border-collapse:collapse}td,th{padding:8px 0;border-bottom:1px solid #EAE3DD;text-align:left}
td:last-child,th:last-child{text-align:right}.muted{color:#7A6F72}.tot td{font-weight:600;border:0}</style>
<p class="muted">${doc.issuer} · demo invoice</p><h1>Invoice ${doc.number}</h1>
<p>Bill to: ${doc.bill_to}<br>Issued: ${new Date(doc.issued_at).toLocaleDateString('en-GB')}<br>Reference: ${doc.case_id}</p>
<table><tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
${doc.lines.map((l) => `<tr><td>${l.text}</td><td>${l.qty}</td><td>${eur(l.qty * l.unit_eur)}</td></tr>`).join('')}
<tr class="tot"><td>Net</td><td></td><td>${eur(doc.net_eur)}</td></tr><tr class="tot"><td>VAT 19%</td><td></td><td>${eur(doc.vat_eur)}</td></tr>
<tr class="tot"><td>Total</td><td></td><td>${eur(doc.amount_eur)}</td></tr></table>
<p class="muted">Work done: ${doc.note ?? '—'}</p>`;
}

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i?.family === 'IPv4' && !i.internal)?.address;
  console.log(`centrix demo API on http://localhost:${PORT}${lan ? `  (LAN: http://${lan}:${PORT})` : ''}`);
  console.log(`AI triage: ${aiProvider() ? `${aiProvider()} (${aiProvider() === 'openai' ? process.env.OPENAI_MODEL || 'gpt-4.1-mini' : process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5'})` : 'off – no API key, keyword rules'}`);
});
