import express from 'express';
import cors from 'cors';
import os from 'node:os';
import { getDb, reset, save } from './store.js';
import * as flow from './flow.js';
import { FIELD_LABELS } from './connector.js';
import { matchPartners } from './matching.js';
import { aiProvider } from './triage.js';

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
    view.documents = db.documents.filter((d) => d.unit_id === unit.id);
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
  for (const k of ['owner_approval_above_eur', 'ai_triage']) if (k in req.body) s[k] = req.body[k];
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

app.get('/connector/partners/:id/availability', wrap((req) => {
  const from = req.query.from ? new Date(req.query.from) : new Date();
  const to = req.query.to ? new Date(req.query.to) : new Date(Date.now() + 14 * 864e5);
  return getDb().slots
    .filter((s) => s.partner_id === req.params.id)
    .filter((s) => new Date(s.start) >= from && new Date(s.start) <= to)
    .sort((a, b) => a.start.localeCompare(b.start));
}));

// Partner inbox: jobs with the minimal payload (what the partner actually sees).
app.get('/connector/partners/:id/jobs', wrap((req) => {
  const db = getDb();
  return db.jobs
    .filter((j) => j.partner_id === req.params.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((j) => {
      const kase = db.cases.find((c) => c.id === j.case_id);
      return {
        ...j,
        case_status: kase.status,
        case_status_label: flow.STATUS_LABELS[kase.status],
        offered_slots: db.slots.filter((s) => j.offered_slot_ids.includes(s.id)),
        slot: db.slots.find((s) => s.id === j.slot_id) ?? null,
        documents: db.documents.filter((d) => d.job_id === j.id),
        rating: kase.rating,
      };
    });
}));

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
  if (doc.type !== 'invoice') return `<pre>${doc.note ?? ''}</pre>`;
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
