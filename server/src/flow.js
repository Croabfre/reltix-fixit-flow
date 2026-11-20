// The case lifecycle. One source of truth: every status change is logged as an
// event (timeline) and, where a person is told something, as a message.
import { getDb, save, id, now } from './store.js';
import { triage, llm, aiProvider } from './triage.js';
import { matchPartners, estimate, overlapsBusy } from './matching.js';
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

function message(kase, { channel, from, to, text, author }) {
  getDb().messages.push({ id: id('m'), unit_id: kase.unit_id, case_id: kase.id, channel, from, to, text, timestamp: now(), ...(author ? { author } : {}) });
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
  // Windows the partner proposed but the tenant didn't take go back to being free time.
  db.slots = db.slots.filter((s) => !(s.proposed && s.status === 'free'));
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
  db.slots = db.slots.filter((s) => !(s.proposed && s.status === 'free'));
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

/** Free-text chat on a case: tenant ↔ property manager, with an AI assistant answering the tenant first. */
export async function postMessage(caseId, { text, from = 'tenant' }) {
  const db = getDb();
  const kase = find('cases', caseId);
  if (!text?.trim()) throw new FlowError('Message is empty.');
  const tenant = find('contacts', kase.reporter_contact_id);
  const fromTenant = from === 'tenant';
  message(kase, {
    channel: 'portal',
    from: fromTenant ? tenant.name : 'centrix',
    to: fromTenant ? 'centrix' : tenant.name,
    text: text.trim(),
    ...(fromTenant ? {} : { author: 'pm' }),
  });
  event('case.message', kase, { from: fromTenant ? 'tenant' : 'pm' }, fromTenant ? tenant.name : 'Property manager');
  save();

  if (fromTenant) {
    const answer = await assistantReply(kase, tenant);
    message(kase, { channel: 'portal', from: 'centrix', to: tenant.name, text: answer.text, author: answer.ai ? 'assistant' : 'system' });
    if (answer.handover) {
      kase.needs_pm_reply = true;
      event('case.handover', kase, { reason: answer.handover }, 'reltix assistant');
    }
    save();
  } else {
    kase.needs_pm_reply = false;
    save();
  }
  return kase;
}

/** Everything the assistant may use to answer – and nothing else (no other tenants, no owner data, no rent figures). */
function assistantContext(kase, tenant) {
  const db = getDb();
  const unit = db.units.find((u) => u.id === kase.unit_id);
  const property = db.properties.find((p) => p.id === unit.property_id);
  const partner = db.partners.find((p) => p.id === kase.partner_id);
  const slot = db.slots.find((s) => s.id === kase.slot_id);
  const job = db.jobs.find((j) => j.id === kase.job_id);
  const offered = job ? db.slots.filter((s) => job.offered_slot_ids.includes(s.id)).map(fmtSlot) : [];
  const shown = !['reported', 'triaged', 'partner_matched', 'awaiting_pm_approval', 'partner_declined', 'escalated'].includes(kase.status);
  return {
    today: new Date().toDateString(),
    tenant_first_name: tenant.name.split(' ')[0],
    flat: `${property.address}, ${unit.label}`,
    furnishings: unit.furnishings ?? 'Unfurnished: furniture belongs to the tenant, the landlord only repairs the flat and building.',
    request: { title: kase.title, problem: kase.summary, urgency: kase.urgency, status: STATUS_LABELS[kase.status] },
    craftsman: shown && partner ? { company: partner.name, contact: partner.contact_person } : 'not booked yet – waiting for the property manager to approve',
    appointment: slot ? fmtSlot(slot) : offered.length ? `options offered: ${offered.join('; ')} (tenant picks one in the chat)` : 'none yet',
    cost_for_tenant: 'Repairs to the flat and building are paid by the landlord. The tenant pays nothing, unless the damage was caused by the tenant – the property manager decides that, never the assistant.',
    building: { heating: property.heating_label, heating_system: property.heating_system?.make, ...(property.house_info ?? {}) },
  };
}

async function assistantReply(kase, tenant) {
  const db = getDb();
  const fallback = {
    text: 'Thanks – I have passed this on to your property manager, who will answer here.',
    ai: false,
    handover: 'no AI available',
  };
  if (!aiProvider() || !db.settings.ai_triage) return fallback;
  const history = db.messages
    .filter((m) => m.case_id === kase.id && m.channel === 'portal')
    .slice(-12)
    .map((m) => ({ role: m.from === 'centrix' ? 'assistant' : 'user', content: m.text }));
  const system =
    'You are the reltix assistant in a German property manager\'s tenant portal. You answer the tenant inside the chat of one repair request. ' +
    'Answer in English by default, even if the tenant writes in another language; switch only if the tenant explicitly asks for another language. Be warm and brief (max 3 sentences). Use ONLY the facts in CONTEXT and do not offer help you cannot give. ' +
    'Never invent dates, prices, names or promises. Never discuss other tenants, the owner, rent amounts or legal disputes. ' +
    'If the question needs a human (complaints, money, rent reduction, damage blame, anything not in CONTEXT), say the property manager will reply here, ' +
    'and set handover. For danger (gas smell, flooding, fire) tell them the emergency steps from CONTEXT first. ' +
    'Reply as JSON: {"reply":"...","handover":null or "short reason"}.\n\nCONTEXT:\n' +
    JSON.stringify(assistantContext(kase, tenant), null, 1);
  try {
    const raw = await llm(system, history, { json: true, maxTokens: 350 });
    const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    if (!parsed.reply?.trim()) throw new Error('empty reply');
    return { text: parsed.reply.trim(), ai: true, handover: parsed.handover || null };
  } catch (err) {
    console.warn('[assistant] failed:', err.message);
    return fallback;
  }
}

/** PM picks a partner by hand (e.g. after escalation) – counts as approval. */
export function assign(caseId, { partner_id, by = 'Property manager' }) {
  const kase = find('cases', caseId);
  const partner = find('partners', partner_id);
  if (kase.job_id) throw new FlowError('This case already has a job.');
  kase.partner_id = partner.id;
  kase.estimate = estimate(partner, `${kase.trade}.repair`);
  setStatus(kase, 'awaiting_pm_approval', { actor: by, note: `Picked by hand: ${partner.name}` });
  return approve(caseId, { by });
}

/** A tenant moves out and a new one moves in. History stays on the unit; the old tenant's data access ends. */
export function changeTenant(unitId, { name, email, phone, move_in }) {
  const db = getDb();
  const unit = find('units', unitId);
  if (!name?.trim() || !move_in) throw new FlowError('Name and move-in date are needed.');
  const moveIn = new Date(move_in);
  if (Number.isNaN(moveIn.getTime())) throw new FlowError('Move-in date is not valid.');
  const lastDay = new Date(moveIn.getTime() - 864e5).toISOString().slice(0, 10);

  const old = db.contacts.find((c) => c.unit_id === unit.id && c.role === 'tenant');
  const oldLease = db.contracts.find((c) => c.type === 'lease' && c.unit_id === unit.id && !c.details.end);
  if (old) {
    old.role = 'former_tenant';
    old.move_out = lastDay;
    // Consents end with the tenancy; partners lose access to the phone number.
    db.consents.filter((c) => c.contact_id === old.id && !c.revoked_at && !c.expired_at).forEach((c) => (c.revoked_at = now()));
    db.messages.push({ id: id('m'), unit_id: unit.id, case_id: null, channel: 'email', from: 'centrix', to: old.name, text: `Your tenancy ends on ${lastDay}. Your portal stays readable for 6 months, then your requests are archived.`, timestamp: now() });
  }
  // The doorbell name in the access notes follows the tenant.
  if (old && unit.access_notes) {
    const oldLast = old.name.split(' ').pop();
    unit.access_notes = unit.access_notes.replaceAll(oldLast, name.trim().split(' ').pop());
  }
  if (oldLease) {
    oldLease.details.end = lastDay;
    db.documents.filter((d) => d.contract_id === oldLease.id).forEach((d) => (d.status = 'ended'));
  }

  const tenant = { id: id('c'), role: 'tenant', name: name.trim(), email: email?.trim() || null, phone: phone?.trim() || null, unit_id: unit.id, move_in: moveIn.toISOString().slice(0, 10) };
  db.contacts.push(tenant);
  const lease = { id: id('ct'), unit_id: unit.id, type: 'lease', details: { tenant_contact_id: tenant.id, rent_cold_eur: oldLease?.details.rent_cold_eur ?? null, start: tenant.move_in } };
  db.contracts.push(lease);
  db.documents.push({
    id: id('doc'), unit_id: unit.id, case_id: null, contract_id: lease.id, type: 'lease', title: `Lease agreement – ${tenant.name}`,
    issuer: 'reltix Hausverwaltung', issued_at: now(), status: 'active', fields: [['Tenant', tenant.name], ['Start', tenant.move_in], ['Cold rent', lease.details.rent_cold_eur ? `€${lease.details.rent_cold_eur}` : '—']],
  });
  db.documents[db.documents.length - 1].url = `/documents/${db.documents[db.documents.length - 1].id}`;
  db.messages.push({ id: id('m'), unit_id: unit.id, case_id: null, channel: 'email', from: 'centrix', to: tenant.name, text: `Welcome to ${unit.label}! Your tenant portal is ready – report anything that needs fixing in one sentence.`, timestamp: now() });
  db.events.push({ id: id('ev'), type: 'tenancy.changed', case_id: null, unit_id: unit.id, actor: 'Property manager', timestamp: now(), data: { from: old?.name ?? null, to: tenant.name, move_in: tenant.move_in } });
  save();
  return tenant;
}

// ---------------------------------------------------------------- centrix / PM

function runMatch(kase) {
  const db = getDb();
  const m = matchPartners(db, kase, { exclude: kase.declined_partner_ids });
  kase.match = { ...m, at: now() };
  if (!m.chosen) {
    setStatus(kase, 'escalated', { note: 'No eligible partner – needs a human' });
    const tenant = getDb().contacts.find((c) => c.id === kase.reporter_contact_id);
    message(kase, { channel: 'portal', from: 'centrix', to: tenant.name, text: 'Your property manager is looking at this personally and will get back to you here shortly.' });
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
      // The partner proposes time windows from his own calendar (or, for older
      // clients, ids of free slots). Each window must be free and in the future.
      let slots = [];
      if (Array.isArray(body.windows) && body.windows.length) {
        for (const w of body.windows.slice(0, 5)) {
          const a = new Date(w.start);
          const b = new Date(w.end);
          if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) throw new FlowError('A time window is not valid.');
          if (a.getTime() < Date.now()) throw new FlowError('A time window is in the past.');
          if (overlapsBusy(getDb(), partner.id, a.toISOString(), b.toISOString()) || slots.some((x) => a < new Date(x.end) && b > new Date(x.start)))
            throw new FlowError(`${fmtSlot({ start: a.toISOString(), end: b.toISOString() })} overlaps something in your calendar.`);
          const slot = { id: id('s'), partner_id: partner.id, start: a.toISOString(), end: b.toISOString(), status: 'offered', proposed: true, job_id: job.id };
          getDb().slots.push(slot);
          slots.push(slot);
        }
      } else {
        slots = (body.slot_ids ?? []).map((sid) => find('slots', sid)).filter((s) => s.partner_id === partner.id && s.status === 'free');
        slots.forEach((s) => (s.status = 'offered'));
      }
      if (!slots.length) throw new FlowError('Pick at least one time window to offer.');
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
