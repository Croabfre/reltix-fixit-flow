// Seed data for the demo. Slots are generated relative to "now" so the demo
// always looks realistic, whatever day it is run on.

const HOUR = 3600 * 1000;

function at(dayOffset, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function slot(id, partner_id, dayOffset, startHour, durationH = 2) {
  const start = at(dayOffset, startHour);
  const end = new Date(new Date(start).getTime() + durationH * HOUR).toISOString();
  return { id, partner_id, start, end, status: 'free' };
}

export function buildSeed() {
  const db = {
    settings: {
      // Above this amount the owner has to approve the cost
      owner_approval_above_eur: 500,
      ai_triage: Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
    },

    properties: [
      {
        id: 'prop_musterstr_12',
        address: 'Musterstraße 12, 52062 Aachen',
        street: 'Musterstraße 12',
        postcode: '52062',
        city: 'Aachen',
        building_year: 1972,
        heating_type: 'gas',
        heating_label: 'Gas central heating',
        heating_system: {
          make: 'Vaillant ecoTEC plus VC 206/5-5',
          installed: 2014,
          location: 'Basement, boiler room',
          last_service: '2025-10-14',
        },
        energy_certificate: { class: 'E', valid_until: '2029-03-31' },
        owner_contact_id: 'c_101',
        caretaker: 'Hausmeisterservice Peters, +49 241 0000000',
      },
      {
        id: 'prop_lothringer_40',
        address: 'Lothringerstraße 40, 52070 Aachen',
        street: 'Lothringerstraße 40',
        postcode: '52070',
        city: 'Aachen',
        building_year: 1958,
        heating_type: 'district',
        heating_label: 'District heating',
        heating_system: { make: 'STAWAG district heating transfer station', installed: 2019, location: 'Basement, utility room', last_service: '2025-09-02' },
        energy_certificate: { class: 'D', valid_until: '2031-06-30' },
        owner_contact_id: 'c_102',
        caretaker: 'Hausmeisterservice Peters, +49 241 0000000',
      },
      {
        id: 'prop_venloer_210',
        address: 'Venloer Straße 210, 50823 Köln',
        street: 'Venloer Straße 210',
        postcode: '50823',
        city: 'Köln',
        building_year: 1995,
        heating_type: 'gas',
        heating_label: 'Gas central heating',
        heating_system: { make: 'Buderus Logamax plus GB172', installed: 2017, location: 'Attic', last_service: '2025-11-03' },
        energy_certificate: { class: 'C', valid_until: '2030-01-31' },
        owner_contact_id: 'c_103',
        caretaker: 'Köln Haus Service, +49 221 0000000',
      },
    ],

    units: [
      {
        id: 'unit_1a',
        property_id: 'prop_musterstr_12',
        label: 'Ground floor left',
        floor: 0,
        size_sqm: 54,
        rooms: 2,
        meters: [{ type: 'electricity', number: '1ESY1160123401' }],
        access_notes: 'Ring at "Weber". Basement door code 4711.',
      },
      {
        id: 'unit_4b',
        property_id: 'prop_musterstr_12',
        label: '2nd floor right',
        floor: 2,
        size_sqm: 68,
        rooms: 3,
        meters: [
          { type: 'electricity', number: '1ESY1160123456' },
          { type: 'heat', number: 'WMZ-0042-4B' },
        ],
        access_notes: 'Ring at "Hoffmann". No lift. Basement door code 4711.',
      },
      {
        id: 'unit_5c',
        property_id: 'prop_musterstr_12',
        label: '3rd floor left',
        floor: 3,
        size_sqm: 82,
        rooms: 3,
        meters: [{ type: 'electricity', number: '1ESY1160123489' }],
        access_notes: 'Ring at "Demir". No lift.',
      },
      { id: 'unit_l1', property_id: 'prop_lothringer_40', label: '1st floor', floor: 1, size_sqm: 74, rooms: 3, meters: [{ type: 'electricity', number: '1ESY1160555101' }], access_notes: 'Ring at "Krämer".' },
      { id: 'unit_l2', property_id: 'prop_lothringer_40', label: '2nd floor', floor: 2, size_sqm: 74, rooms: 3, meters: [{ type: 'electricity', number: '1ESY1160555102' }], access_notes: 'Ring at "Rossi".' },
      { id: 'unit_v1', property_id: 'prop_venloer_210', label: 'Ground floor', floor: 0, size_sqm: 61, rooms: 2, meters: [{ type: 'electricity', number: '1KOE0021200101' }], access_notes: 'Ring at "Yılmaz". Bike room key with caretaker.' },
      { id: 'unit_v2', property_id: 'prop_venloer_210', label: '1st floor', floor: 1, size_sqm: 88, rooms: 4, meters: [{ type: 'electricity', number: '1KOE0021200102' }], access_notes: 'Vacant – keys with caretaker.' },
    ],

    contacts: [
      { id: 'c_101', role: 'owner', name: 'Maria Becker', email: 'maria.becker@example.com', phone: '+49 160 00000001', unit_id: null },
      { id: 'c_102', role: 'owner', name: 'Kaiser Wohnbau GmbH', email: 'verwaltung@kaiser-wohnbau.example', phone: '+49 241 0000010', unit_id: null },
      { id: 'c_103', role: 'owner', name: 'Dr. Henrik Vogel', email: 'h.vogel@example.com', phone: '+49 170 00000011', unit_id: null },
      { id: 'c_204', role: 'tenant', name: 'Tobias Krämer', email: 'tobias@example.com', phone: '+49 151 00000004', unit_id: 'unit_l1', move_in: '2022-03-01' },
      { id: 'c_205', role: 'tenant', name: 'Sofia Rossi', email: 'sofia@example.com', phone: '+49 152 00000005', unit_id: 'unit_l2', move_in: '2023-07-15' },
      { id: 'c_206', role: 'tenant', name: 'Mehmet Yılmaz', email: 'mehmet@example.com', phone: '+49 176 00000006', unit_id: 'unit_v1', move_in: '2020-10-01' },
      { id: 'c_201', role: 'tenant', name: 'Jonas Weber', email: 'jonas@example.com', phone: '+49 152 00000002', unit_id: 'unit_1a', move_in: '2021-04-01' },
      { id: 'c_202', role: 'tenant', name: 'Lena Hoffmann', email: 'lena@example.com', phone: '+49 151 00000000', unit_id: 'unit_4b', move_in: '2024-12-01' },
      { id: 'c_203', role: 'tenant', name: 'Aylin Demir', email: 'aylin@example.com', phone: '+49 157 00000003', unit_id: 'unit_5c', move_in: '2019-08-15' },
    ],

    contracts: [
      { id: 'ct_1', unit_id: 'unit_1a', type: 'lease', details: { tenant_contact_id: 'c_201', rent_cold_eur: 590, start: '2021-04-01' } },
      { id: 'ct_2', unit_id: 'unit_4b', type: 'lease', details: { tenant_contact_id: 'c_202', rent_cold_eur: 780, start: '2024-12-01' } },
      { id: 'ct_3', unit_id: 'unit_5c', type: 'lease', details: { tenant_contact_id: 'c_203', rent_cold_eur: 910, start: '2019-08-15' } },
      { id: 'ct_4', unit_id: 'unit_l1', type: 'lease', details: { tenant_contact_id: 'c_204', rent_cold_eur: 820, start: '2022-03-01' } },
      { id: 'ct_5', unit_id: 'unit_l2', type: 'lease', details: { tenant_contact_id: 'c_205', rent_cold_eur: 845, start: '2023-07-15' } },
      { id: 'ct_6', unit_id: 'unit_v1', type: 'lease', details: { tenant_contact_id: 'c_206', rent_cold_eur: 760, start: '2020-10-01' } },
      { id: 'ct_10', unit_id: null, property_id: 'prop_musterstr_12', type: 'service', details: { provider: 'Hausmeisterservice Peters', scope: 'Caretaking, stairwell cleaning' } },
    ],

    // Partners plug in through the connector spec (see docs/connector-spec.md).
    // `connector` is the partner's manifest as registered with centrix.
    partners: [
      {
        id: 'p_schmitz',
        name: 'Wärmetechnik Schmitz GmbH',
        category: 'craftsman',
        trades: ['heating'],
        heating_types: ['gas', 'oil'],
        postcodes: ['52062', '52064', '52066', '52068'],
        rating: 4.8,
        reviews: 212,
        hourly_rate: 68,
        contact_person: 'Thomas Schmitz',
        connector: manifest('p_schmitz', 'Wärmetechnik Schmitz GmbH', { callout: 49, hourly: 68 }),
      },
      {
        id: 'p_meyer',
        name: 'Haustechnik Meyer',
        category: 'craftsman',
        trades: ['heating', 'plumbing'],
        heating_types: ['gas', 'oil', 'district'],
        postcodes: ['52062', '52064', '52070'],
        rating: 4.5,
        reviews: 97,
        hourly_rate: 62,
        contact_person: 'Sandra Meyer',
        connector: manifest('p_meyer', 'Haustechnik Meyer', { callout: 39, hourly: 62 }),
      },
      {
        id: 'p_krueger',
        name: 'Heizung Krüger & Sohn',
        category: 'craftsman',
        trades: ['heating'],
        heating_types: ['gas'],
        postcodes: ['52062', '52066'],
        rating: 4.9,
        reviews: 341,
        hourly_rate: 74,
        contact_person: 'Ralf Krüger',
        connector: manifest('p_krueger', 'Heizung Krüger & Sohn', { callout: 55, hourly: 74 }),
      },
      {
        id: 'p_eifel',
        name: 'Eifel Wärmepumpen-Service',
        category: 'craftsman',
        trades: ['heating'],
        heating_types: ['heat_pump'],
        postcodes: ['52070', '52072', '52076'],
        rating: 4.7,
        reviews: 58,
        hourly_rate: 79,
        contact_person: 'Jan Lenzen',
        connector: manifest('p_eifel', 'Eifel Wärmepumpen-Service', { callout: 59, hourly: 79 }),
      },
    ],

    slots: [
      // Schmitz: free tomorrow and the day after
      slot('s_sch_1', 'p_schmitz', 1, 8),
      slot('s_sch_2', 'p_schmitz', 1, 13),
      slot('s_sch_3', 'p_schmitz', 2, 9),
      slot('s_sch_4', 'p_schmitz', 2, 15),
      slot('s_sch_5', 'p_schmitz', 3, 10),
      // Meyer: also within 48h (backup if Schmitz declines)
      slot('s_mey_1', 'p_meyer', 1, 10),
      slot('s_mey_2', 'p_meyer', 2, 14),
      slot('s_mey_3', 'p_meyer', 2, 16),
      // Krüger: best rating, but fully booked until next week
      slot('s_kru_1', 'p_krueger', 6, 9),
      slot('s_kru_2', 'p_krueger', 7, 13),
      // Eifel: would be available, but does not cover the postcode / gas heating
      slot('s_eif_1', 'p_eifel', 1, 9),
    ],

    cases: [],
    jobs: [],
    consents: [],
    documents: [],
    messages: [
      {
        id: 'm_seed_1',
        unit_id: 'unit_4b',
        case_id: null,
        channel: 'email',
        from: 'centrix',
        to: 'Lena Hoffmann',
        text: 'Reminder: annual heating service took place on 14 Oct. No action needed.',
        timestamp: at(-37, 10),
      },
    ],
    events: [],
  };
  addHistory(db);
  return db;
}

// One resolved case from earlier this year, so the tenant portal and centrix
// show a real history (closed cases stay in the history; see docs/assumptions.md).
function addHistory(db) {
  const opened = at(-74, 8, 12);
  const closed = at(-71, 16, 40);
  const id = 'case_hist_tap';
  db.cases.push({
    id, unit_id: 'unit_4b', reporter_contact_id: 'c_202',
    title: 'Dripping kitchen tap',
    text: 'The kitchen tap keeps dripping even when it is fully closed.',
    photos: [], trade: 'plumbing', urgency: 'normal',
    summary: 'Kitchen tap drips when closed – cartridge probably worn.',
    triage: { source: 'rules', trade: 'plumbing', urgency: 'normal', reasons: [] },
    status: 'closed', partner_id: 'p_meyer', slot_id: null, job_id: 'job_hist_tap',
    declined_partner_ids: [], match: null, estimate: { service: 'heating.repair', net_eur: 132, gross_eur: 157.08 },
    rating: { stars: 5, comment: null, at: closed },
    created_at: opened, updated_at: closed, resolved_at: closed,
  });
  db.jobs.push({
    id: 'job_hist_tap', case_id: id, partner_id: 'p_meyer', status: 'invoiced',
    payload: { job_ref: id, service: 'plumbing.repair', case: { trade: 'plumbing', urgency: 'normal' }, fields: {}, withheld: [] },
    payload_history: [], offered_slot_ids: [], slot_id: null,
    estimate: { gross_eur: 157.08 }, completion_note: 'Replaced tap cartridge', created_at: opened,
  });
  db.documents.push({
    id: 'doc_hist_inv', case_id: id, unit_id: 'unit_4b', job_id: 'job_hist_tap', type: 'invoice',
    title: 'Invoice Haustechnik Meyer', number: 'RE-2026-0917', issuer: 'Haustechnik Meyer',
    bill_to: 'Maria Becker c/o reltix Hausverwaltung',
    lines: [{ text: 'Call-out fee', qty: 1, unit_eur: 39 }, { text: 'Labour', qty: 0.5, unit_eur: 62 }, { text: 'Tap cartridge', qty: 1, unit_eur: 24.5 }],
    net_eur: 94.5, vat_eur: 17.96, amount_eur: 112.46, note: 'Replaced tap cartridge', issued_at: closed, url: '/documents/doc_hist_inv',
  });
  const msgs = [
    [opened, 'portal', 'Lena Hoffmann', 'centrix', 'The kitchen tap keeps dripping even when it is fully closed.'],
    [opened, 'portal', 'centrix', 'Lena Hoffmann', "Thanks Lena, we've got it. We're booking a plumbing specialist now – you'll pick an appointment right here, no calls needed."],
    [at(-73, 9), 'portal', 'centrix', 'Lena Hoffmann', 'Haustechnik Meyer can come: Thu 10:00–12:00 · Fri 14:00–16:00. Tap the one that suits you.'],
    [at(-73, 9, 20), 'portal', 'Lena Hoffmann', 'centrix', 'Booked Fri 14:00–16:00'],
    [closed, 'portal', 'centrix', 'Lena Hoffmann', 'Repair done: replaced tap cartridge. How did it go?'],
    [closed, 'email', 'centrix', 'Maria Becker', 'Tap repair in 2nd floor right done. Invoice RE-2026-0917: €112.46. Within budget, booked automatically.'],
  ];
  msgs.forEach(([timestamp, channel, from, to, text], i) => db.messages.push({ id: `m_hist_${i}`, unit_id: 'unit_4b', case_id: id, channel, from, to, text, timestamp }));
  [
    [opened, 'case.created', { text: 'The kitchen tap keeps dripping even when it is fully closed.' }, 'Lena Hoffmann'],
    [opened, 'case.status_changed', { to: 'awaiting_pm_approval', label: 'Awaiting approval' }, 'centrix'],
    [at(-74, 9), 'case.approved', { by: 'PM', estimate: { gross_eur: 157.08 } }, 'PM'],
    [at(-73, 9, 20), 'job.scheduled', { slot: 'Fri 14:00–16:00' }, 'Lena Hoffmann'],
    [closed, 'job.result', { amount_eur: 112.46 }, 'Haustechnik Meyer'],
    [closed, 'case.status_changed', { to: 'closed', label: 'Closed', note: '5★' }, 'Lena Hoffmann'],
  ].forEach(([timestamp, type, data, actor], i) => db.events.push({ id: `ev_hist_${i}`, type, case_id: id, unit_id: 'unit_4b', actor, timestamp, data }));
}

function manifest(partnerId, name, price) {
  return {
    spec_version: '1.0',
    partner_id: partnerId,
    name,
    category: 'craftsman',
    services: [
      {
        code: 'heating.repair',
        name: 'Heating fault repair',
        price_model: {
          type: 'time_and_material',
          callout_fee_eur: price.callout,
          hourly_rate_eur: price.hourly,
          typical_hours: 1.5,
          vat_rate: 0.19,
        },
      },
      {
        code: 'heating.service',
        name: 'Annual heating service',
        price_model: { type: 'fixed', price_eur: 129, vat_rate: 0.19 },
      },
    ],
    eligibility: {
      lead_time_hours: { high: 48, normal: 120, low: 336 },
    },
    // Fields the partner needs. centrix fills these from the unit record;
    // `consent: true` fields are only shared after the tenant agrees.
    required_data: [
      { field: 'property.address', purpose: 'Get to the building' },
      { field: 'unit.floor', purpose: 'Find the flat' },
      { field: 'property.heating_system', purpose: 'Bring the right parts' },
      { field: 'property.building_year', purpose: 'Assess the installation' },
      { field: 'case.summary', purpose: 'Understand the fault' },
      { field: 'case.urgency', purpose: 'Plan the visit' },
      { field: 'case.photos', purpose: 'Diagnose before arrival' },
      { field: 'tenant.phone', purpose: 'Call to be let in and before arrival', consent: true },
    ],
    endpoints: {
      availability: `/connector/partners/${partnerId}/availability`,
      jobs: `/connector/partners/${partnerId}/jobs`,
    },
    webhooks: {
      status: '/centrix/jobs/{job_id}/status',
      result: '/centrix/jobs/{job_id}/result',
    },
  };
}
