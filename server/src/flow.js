// The case lifecycle. One source of truth: every status change is logged as an
// event (timeline) and, where a person is told something, as a message.
import { getDb, save, id, now } from './store.js';
import { triage } from './triage.js';
import { matchPartners, estimate } from './matching.js';
import { buildPayload, contextFor, consentFields, FIELD_LABELS } from './connector.js';

export class FlowError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const find = (list, key, msg) => {
  const item = getDb()[list].find((x) => x.id === key);
  if (!item) throw new FlowError(msg ?? `${list} ${key} not found`, 404);
  return item;
};

export const STATUS_LABELS = {
  reported: 'Reported',
  triaged: 'Triaged',
  partner_matched: 'Partner matched',
  awaiting_pm_approval: 'Awaiting approval',
  job_sent: 'Sent to partner',
  job_accepted: 'Partner accepted',
  slot_offered: 'Slots offered',
  slot_confirmed: 'Appointment booked',
  in_progress: 'Repair in progress',
  completed: 'Repair completed',
  invoiced: 'Invoiced',
  closed: 'Closed',
  partner_declined: 'Partner declined',
  no_slot_fits: 'Needs other times',
  escalated: 'Escalated to PM',
};

function event(type, kase, data = {}, actor = 'centrix') {
  const e = { id: id('ev'), type, case_id: kase.id, unit_id: kase.unit_id, actor, timestamp: now(), data };
  getDb().events.push(e);
  return e;
}

function setStatus(kase, status, { actor = 'centrix', note } = {}) {
  const from = kase.status;
  kase.status = status;
  kase.updated_at = now();
  event('case.status_changed', kase, { from, to: status, label: STATUS_LABELS[status], note }, actor);
}

function message(kase, { channel, from, to, text }) {
  getDb().messages.push({ id: id('m'), unit_id: kase.unit_id, case_id: kase.id, channel, from, to, text, timestamp: now() });
}

const fmtSlot = (s) =>
  `${new Date(s.start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ` +
  `${new Date(s.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}–` +
  `${new Date(s.end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

// ---------------------------------------------------------------- tenant

export async function createCase({ unit_id, contact_id, text, photos = [] }) {
  const db = getDb();
  if (!text?.trim()) throw new FlowError('Please describe the problem in a sentence.');
  const unit = find('units', unit_id);
  const tenant = find('contacts', contact_id);
  const kase = {
    id: id('case'),
    unit_id: unit.id,
    reporter_contact_id: tenant.id,
    text: text.trim(),
    photos: photos.slice(0, 3),
    title: null,
    trade: null,
    urgency: null,
    summary: null,
    status: 'reported',
    partner_id: null,
    slot_id: null,
    job_id: null,
    declined_partner_ids: [],
    match: null,
    rating: null,
    created_at: now(),
    updated_at: now(),
  };
  db.cases.push(kase);
  event('case.created', kase, { text: kase.text, photos: kase.photos.length, channel: 'portal' }, tenant.name);
  message(kase, { channel: 'portal', from: tenant.name, to: 'centrix', text: kase.text });

  const t = await triage(kase.text, { useAi: db.settings.ai_triage });
  Object.assign(kase, { title: t.title, trade: t.trade, urgency: t.urgency, summary: t.summary, triage: t });
  setStatus(kase, 'triaged', { actor: t.source === 'ai' ? 'centrix AI' : 'centrix rules', note: `${t.trade}, urgency ${t.urgency}` });

  message(kase, {
    channel: 'portal',
    from: 'centrix',
    to: tenant.name,
    text: `Thanks ${tenant.name.split(' ')[0]}, we've got it. We're booking ${t.trade === 'general' ? 'a craftsman' : `a ${t.trade} specialist`} now – you'll pick an appointment right here, no calls needed.`,
  });

  runMatch(kase);
  save();
  return kase;
}

export function confirmSlot(caseId, { slot_id, share_phone = true }) {
  const db = getDb();
  const kase = find('cases', caseId);
  if (kase.status !== 'slot_offered') throw new FlowError(`Case is "${STATUS_LABELS[kase.status]}", no slot to confirm.`);
  const slot = find('slots', slot_id);
  if (slot.status !== 'offered' || slot.partner_id !== kase.partner_id) throw new FlowError('That slot is no longer available.', 409);
  const partner = find('partners', kase.partner_id);
  const tenant = find('contacts', kase.reporter_contact_id);
  const job = find('jobs', kase.job_id);

  // Book this slot, release the others.
  db.slots.filter((s) => job.offered_slot_ids.includes(s.id)).forEach((s) => (s.status = s.id === slot.id ? 'booked' : 'free'));
  kase.slot_id = slot.id;
  job.slot_id = slot.id;
  job.status = 'scheduled';

  if (share_phone) {
    const fields = consentFields(partner);
    const consent = {
      id: id('cons'),
      contact_id: tenant.id,
      partner_id: partner.id,
      case_id: kase.id,
      data_shared: fields,
      data_labels: fields.map((f) => FIELD_LABELS[f] ?? f),
      purpose: `Arrange the ${kase.trade} repair visit (${fmtSlot(slot)})`,
      legal_basis: 'Consent, Art. 6(1)(a) GDPR – revocable at any time in the portal',
      given_at: now(),
      channel: 'portal',
      expires: 'on case close',
    };
    db.consents.push(consent);
    event('consent.given', kase, { consent_id: consent.id, partner: partner.name, fields: consent.data_labels }, tenant.name);
  }
  // Re-send the payload: now includes the consented fields.
  job.payload = buildPayload(db, partner, kase);
  job.payload_history.push({ at: now(), reason: 'slot confirmed', fields: Object.keys(job.payload.fields) });

  setStatus(kase, 'slot_confirmed', { actor: tenant.name, note: fmtSlot(slot) });
  event('job.scheduled', kase, { slot: fmtSlot(slot) }, tenant.name);
  message(kase, { channel: 'portal', from: tenant.name, to: 'centrix', text: `Booked ${fmtSlot(slot)}${share_phone ? ' · OK to share my number' : ''}` });
  message(kase, {
    channel: 'app',
    from: 'centrix',
    to: partner.name,
    text: `Appointment confirmed: ${fmtSlot(slot)}.${share_phone ? ` Tenant phone: ${tenant.phone}.` : ' Tenant prefers no calls – ring the bell.'}`,
  });
  message(kase, {
    channel: 'portal',
    from: 'centrix',
    to: tenant.name,
    text: `You're booked: ${partner.name}, ${fmtSlot(slot)}. They'll ${share_phone ? 'call shortly before arriving' : 'ring the bell'}.`,
  });
  save();
  return kase;
}

export function noSlotFits(caseId, { note } = {}) {
  const db = getDb();
  const kase = find('cases', caseId);
  if (kase.status !== 'slot_offered') throw new FlowError('No slots are on offer right now.');
  const job = find('jobs', kase.job_id);
  const partner = find('partners', kase.partner_id);
  db.slots.filter((s) => job.offered_slot_ids.includes(s.id)).forEach((s) => (s.status = 'free'));
  job.rejected_slot_ids = [...(job.rejected_slot_ids ?? []), ...job.offered_slot_ids];
  job.offered_slot_ids = [];
  job.status = 'reschedule_requested';
  job.tenant_note = note ?? null;
  setStatus(kase, 'no_slot_fits', { actor: 'tenant', note });
  message(kase, { channel: 'app', from: 'centrix', to: partner.name, text: `None of the times work for the tenant${note ? ` (“${note}”)` : ''}. Please offer other slots.` });
  save();
  return kase;
}

export function rate(caseId, { rating, comment }) {
  const kase = find('cases', caseId);
  if (!['invoiced', 'completed'].includes(kase.status)) throw new FlowError('The repair is not finished yet.');
  const r = Math.max(1, Math.min(5, Number(rating) || 5));
  kase.rating = { stars: r, comment: comment ?? null, at: now() };
  const partner = find('partners', kase.partner_id);
  partner.rating = Math.round(((partner.rating * partner.reviews + r) / (partner.reviews + 1)) * 10) / 10;
  partner.reviews += 1;
  // Consent ends with the case: the partner no longer needs the phone number.
  getDb().consents.filter((c) => c.case_id === kase.id && !c.revoked_at).forEach((c) => (c.expired_at = now()));
  kase.resolved_at = now();
  event('case.rated', kase, { stars: r }, 'tenant');
  setStatus(kase, 'closed', { actor: 'tenant', note: `${r}★` });
  message(kase, { channel: 'portal', from: 'centrix', to: find('contacts', kase.reporter_contact_id).name, text: 'Thanks for your feedback! Case closed. The invoice has been booked to the owner – nothing for you to pay.' });
  save();
  return kase;
}

/** Free-text chat on a case: tenant ↔ property manager. */
export function postMessage(caseId, { text, from = 'tenant' }) {
  const kase = find('cases', caseId);
  if (!text?.trim()) throw new FlowError('Message is empty.');
  const tenant = find('contacts', kase.reporter_contact_id);
  const fromTenant = from === 'tenant';
  message(kase, {
    channel: 'portal',
    from: fromTenant ? tenant.name : 'centrix',
    to: fromTenant ? 'centrix' : tenant.name,
    text: text.trim(),
  });
  event('case.message', kase, { from: fromTenant ? 'tenant' : 'pm' }, fromTenant ? tenant.name : 'Property manager');
  save();
  return kase;
}

// ---------------------------------------------------------------- centrix / PM

function runMatch(kase) {
  const db = getDb();
  const m = matchPartners(db, kase, { exclude: kase.declined_partner_ids });
  kase.match = { ...m, at: now() };
  if (!m.chosen) {
    setStatus(kase, 'escalated', { note: 'No eligible partner – needs a human' });
    return;
  }
  kase.partner_id = m.chosen.partner_id;
  kase.estimate = m.chosen.estimate;
  setStatus(kase, 'partner_matched', { note: `${m.chosen.name} – ${m.reason}` });

  // A person always approves before anything goes out – no automatic approval.
  setStatus(kase, 'awaiting_pm_approval');
}

export function approve(caseId, { by = 'Property manager' } = {}) {
  const db = getDb();
  const kase = find('cases', caseId);
  if (kase.status !== 'awaiting_pm_approval') throw new FlowError(`Case is "${STATUS_LABELS[kase.status]}", nothing to approve.`);
  const partner = find('partners', kase.partner_id);
  const ownerNeeded = kase.estimate.gross_eur > db.settings.owner_approval_above_eur;
  event('case.approved', kase, { by, estimate: kase.estimate, owner_approval_needed: ownerNeeded }, by);

  const job = {
    id: id('job'),
    case_id: kase.id,
    partner_id: partner.id,
    status: 'sent',
    payload: buildPayload(db, partner, kase),
    payload_history: [],
    offered_slot_ids: [],
    slot_id: null,
    estimate: kase.estimate,
    price_model: partner.connector.services.find((s) => s.code === kase.estimate.service)?.price_model,
    created_at: now(),
  };
  job.payload_history.push({ at: now(), reason: 'job placed', fields: Object.keys(job.payload.fields) });
  db.jobs.push(job);
  kase.job_id = job.id;

  // POST {partner}/jobs – for this demo the partner system lives in-process.
  event('job.placed', kase, { partner: partner.name, endpoint: partner.connector.endpoints.jobs, fields: Object.keys(job.payload.fields), withheld: job.payload.withheld.map((w) => w.field) }, 'centrix');
  setStatus(kase, 'job_sent', { actor: by, note: partner.name });
  message(kase, { channel: 'app', from: 'centrix', to: partner.name, text: `New job: ${kase.trade} repair at ${job.payload.fields['property.address']}, urgency ${kase.urgency}.` });
  save();
  return kase;
}

export function escalate(caseId, { note } = {}) {
  const kase = find('cases', caseId);
  setStatus(kase, 'escalated', { actor: 'Property manager', note });
  save();
  return kase;
}

// ---------------------------------------------------------------- partner (connector webhooks)

export function partnerStatus(jobId, body) {
  const db = getDb();
  const job = find('jobs', jobId);
  const kase = find('cases', job.case_id);
  const partner = find('partners', job.partner_id);
  const tenant = find('contacts', kase.reporter_contact_id);
  const { status } = body;
  event(`job.${status}`, kase, { ...body, slot_ids: undefined }, partner.name);

  switch (status) {
    case 'accepted':
    case 'slots_offered': {
      const slotIds = body.slot_ids ?? [];
      const slots = slotIds.map((sid) => find('slots', sid)).filter((s) => s.partner_id === partner.id && s.status === 'free');
      if (!slots.length) throw new FlowError('Pick at least one free slot to offer.');
      slots.forEach((s) => (s.status = 'offered'));
      job.offered_slot_ids = slots.map((s) => s.id);
      job.status = 'accepted';
      if (status === 'accepted' && kase.status === 'job_sent') setStatus(kase, 'job_accepted', { actor: partner.name });
      setStatus(kase, 'slot_offered', { actor: partner.name, note: `${slots.length} slots` });
      message(kase, {
        channel: 'portal',
        from: 'centrix',
        to: tenant.name,
        text: `${partner.name} can come: ${slots.map(fmtSlot).join(' · ')}. Tap the one that suits you.`,
      });
      break;
    }
    case 'declined': {
      job.status = 'declined';
      job.decline_reason = body.reason ?? 'no reason given';
      job.declined_at = now();
      kase.declined_partner_ids.push(partner.id);
      setStatus(kase, 'partner_declined', { actor: partner.name, note: job.decline_reason });
      message(kase, { channel: 'system', from: partner.name, to: 'centrix', text: `Declined: ${job.decline_reason}` });
      kase.job_id = null;
      runMatch(kase); // → next best partner, back to PM approval
      break;
    }
    case 'in_progress': {
      job.status = 'in_progress';
      setStatus(kase, 'in_progress', { actor: partner.name });
      message(kase, { channel: 'portal', from: 'centrix', to: tenant.name, text: `${partner.contact_person ?? partner.name} has arrived and started the repair.` });
      break;
    }
    case 'completed': {
      job.status = 'completed';
      job.completion_note = body.note ?? null;
      job.completed_at = now();
      setStatus(kase, 'completed', { actor: partner.name, note: body.note });
      message(kase, { channel: 'portal', from: 'centrix', to: tenant.name, text: `Repair done: ${body.note ?? 'heating is working again'}. How did it go?` });
      break;
    }
    case 'cancelled': {
      job.status = 'cancelled';
      setStatus(kase, 'escalated', { actor: partner.name, note: `Partner cancelled: ${body.reason ?? ''}` });
      break;
    }
    default:
      throw new FlowError(`Unknown status "${status}". Use one of accepted, declined, slots_offered, in_progress, completed, cancelled.`);
  }
  save();
  return { job, case: kase };
}

export function partnerResult(jobId, body) {
  const db = getDb();
  const job = find('jobs', jobId);
  const kase = find('cases', job.case_id);
  const partner = find('partners', job.partner_id);
  if (!['completed', 'in_progress'].includes(job.status)) throw new FlowError('Complete the job before sending the invoice.');
  if (job.status === 'in_progress') partnerStatus(jobId, { status: 'completed', note: body.note });

  const inv = body.invoice ?? {};
  const pm = partner.connector.services[0].price_model;
  const hours = Number(inv.hours ?? pm.typical_hours);
  const lines = [
    { text: 'Call-out fee', qty: 1, unit_eur: pm.callout_fee_eur },
    { text: 'Labour', qty: hours, unit_eur: pm.hourly_rate_eur },
    ...(inv.parts ?? []).filter((p) => Number(p.amount_eur) > 0).map((p) => ({ text: p.text, qty: 1, unit_eur: Number(p.amount_eur) })),
  ];
  const net = Math.round(lines.reduce((s, l) => s + l.qty * l.unit_eur, 0) * 100) / 100;
  const vat = Math.round(net * (pm.vat_rate ?? 0.19) * 100) / 100;
  const owner = db.contacts.find((c) => c.id === db.properties.find((p) => p.id === db.units.find((u) => u.id === kase.unit_id).property_id).owner_contact_id);

  const doc = {
    id: id('doc'),
    case_id: kase.id,
    unit_id: kase.unit_id,
    job_id: job.id,
    type: 'invoice',
    title: `Invoice ${partner.name}`,
    number: `RE-${new Date().getFullYear()}-${String(db.documents.length + 1001)}`,
    issuer: partner.name,
    bill_to: `${owner?.name ?? 'Owner'} c/o reltix Hausverwaltung`,
    lines,
    net_eur: net,
    vat_eur: vat,
    amount_eur: Math.round((net + vat) * 100) / 100,
    note: body.note ?? job.completion_note,
    issued_at: now(),
  };
  doc.url = `/documents/${doc.id}`;
  db.documents.push(doc);

  if (body.note || job.completion_note) {
    db.documents.push({
      id: id('doc'),
      case_id: kase.id,
      unit_id: kase.unit_id,
      job_id: job.id,
      type: 'report',
      title: 'Completion report',
      note: body.note ?? job.completion_note,
      issuer: partner.name,
      issued_at: now(),
      url: null,
    });
  }

  job.status = 'invoiced';
  event('job.result', kase, { documents: ['invoice', 'report'], amount_eur: doc.amount_eur }, partner.name);
  setStatus(kase, 'invoiced', { actor: partner.name, note: `€${doc.amount_eur.toFixed(2)} gross` });
  const overBudget = doc.amount_eur > db.settings.owner_approval_above_eur;
  message(kase, {
    channel: 'email',
    from: 'centrix',
    to: owner?.name ?? 'Owner',
    text: `Heating repair in ${db.units.find((u) => u.id === kase.unit_id).label} done. Invoice ${doc.number}: €${doc.amount_eur.toFixed(2)}.${overBudget ? ' Above €500 – please approve.' : ' Within budget, booked automatically.'}`,
  });
  save();
  return { job, case: kase, document: doc };
}

export { contextFor, estimate };
