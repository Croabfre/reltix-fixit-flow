// Runs the whole flow against a running server: node scripts/smoke.js
const API = process.env.API ?? 'http://localhost:4000';
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(`${method} ${path}: ${j.error}`);
  return j;
};
const step = (s, c) => console.log(s.padEnd(28), '→', c.status ?? c.case?.status);

await call('POST', '/demo/reset');
let c = await call('POST', '/cases', { unit_id: 'unit_4b', contact_id: 'c_202', text: 'No heating since yesterday, radiators are cold' });
step('tenant reports', c);
console.log('  match:', c.match.chosen.name, '|', c.match.reason);

// Decline path: first partner declines, centrix re-matches
c = await call('POST', `/cases/${c.id}/approve`);
step('PM approves', c);
let job = (await call('GET', `/cases/${c.id}`)).job;
let r = await call('POST', `/centrix/jobs/${job.id}/status`, { status: 'declined', reason: 'Fully booked this week' });
step('partner declines', r);
console.log('  rematched:', r.case.match.chosen.name);
await call('POST', `/demo/reset`);

// Happy path
c = await call('POST', '/cases', { unit_id: 'unit_4b', contact_id: 'c_202', text: 'No heating since yesterday' });
c = await call('POST', `/cases/${c.id}/approve`);
job = (await call('GET', `/cases/${c.id}`)).job;
console.log('  payload fields:', Object.keys(job.payload.fields).join(', '), '| withheld:', job.payload.withheld.map((w) => w.field).join(','));
const avail = await call('GET', `/connector/partners/${job.partner_id}/availability`);
r = await call('POST', `/centrix/jobs/${job.id}/status`, { status: 'accepted', slot_ids: avail.filter((s) => s.status === 'free').slice(0, 3).map((s) => s.id) });
step('partner accepts + slots', r);
c = await call('GET', `/cases/${c.id}`);
c = await call('POST', `/cases/${c.id}/confirm-slot`, { slot_id: c.offered_slots[0].id, share_phone: true });
step('tenant picks slot', c);
job = (await call('GET', `/cases/${c.id}`)).job;
console.log('  phone now shared:', job.payload.fields['tenant.phone']);
step('arrived', (await call('POST', `/centrix/jobs/${job.id}/status`, { status: 'in_progress' })));
step('completed', (await call('POST', `/centrix/jobs/${job.id}/status`, { status: 'completed', note: 'Replaced ignition electrode, bled system' })));
r = await call('POST', `/centrix/jobs/${job.id}/result`, { invoice: { hours: 1.5, parts: [{ text: 'Ignition electrode', amount_eur: 38.9 }] } });
step('invoice', r);
console.log('  invoice:', r.document.number, '€' + r.document.amount_eur);
step('tenant rates', await call('POST', `/cases/${c.id}/rate`, { rating: 5 }));
const unit = await call('GET', '/units/unit_4b');
console.log('  on unit:', unit.documents.map((d) => d.type).join(', '), '| consents:', unit.consents.length, '| messages:', unit.messages.length);
