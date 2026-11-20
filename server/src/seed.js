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
        address: '12 Sample Street, 52062 Aachen',
        street: '12 Sample Street',
        postcode: '52062',
        city: 'Aachen',
        building_year: 1972,
        heating_type: 'gas',
        heating_label: 'Gas central heating',
        heating_system: {
          make: 'ThermoMax Combi 24',
          installed: 2014,
          location: 'Basement, boiler room',
          last_service: '2025-10-14',
        },
        energy_certificate: { class: 'E', valid_until: '2029-03-31' },
        connectivity: { fibre: true, cable: true, dsl: 100 },
        owner_contact_id: 'c_101',
        caretaker: 'Peters Handyman Services, +49 241 0000000',
        house_info: {
          waste: 'Residual waste Tuesday, organic bin Wednesday, paper every second Thursday, yellow bags Friday. Bins are in the courtyard.',
          caretaker_hours: 'Caretaker Peters Handyman Services, Mon–Fri 8:00–16:00, +49 241 0000000.',
          emergency: 'Out of hours emergencies (water, gas smell, no heating at night): +49 241 0000099. Gas smell: leave the flat and call 112.',
          quiet_hours: 'Quiet hours 22:00–06:00 and all day on Sundays.',
          laundry: 'Laundry room in the basement, washing machines until 21:00.',
          heating_tips: 'Thermostat setting 3 is about 20 °C. A radiator key for bleeding radiators is available from the caretaker. System pressure should be 1.2–2.0 bar.',
          bikes_parking: 'Bike room in the courtyard (key from the caretaker). No private parking spaces.',
          rent: 'Rent is due by the 3rd working day of the month; bank details are in your lease. Questions about the service charge statement go to your property manager.',
          internet: 'The building is connected to fibre (connection box in the basement), cable TV and DSL.',
        },
      },
      {
        id: 'prop_lothringer_40',
        address: '40 Lorraine Street, 52070 Aachen',
        street: '40 Lorraine Street',
        postcode: '52070',
        city: 'Aachen',
        building_year: 1958,
        heating_type: 'district',
        heating_label: 'District heating',
        heating_system: { make: 'District heating transfer station', installed: 2019, location: 'Basement, utility room', last_service: '2025-09-02' },
        energy_certificate: { class: 'D', valid_until: '2031-06-30' },
        connectivity: { fibre: false, cable: true, dsl: 250 },
        owner_contact_id: 'c_102',
        caretaker: 'Peters Handyman Services, +49 241 0000000',
        house_info: {
          waste: 'Residual waste Monday, paper Thursday, yellow bags every second Wednesday.',
          caretaker_hours: 'Caretaker Peters Handyman Services, Mon–Fri 8:00–16:00, +49 241 0000000.',
          emergency: 'Out of hours emergencies: +49 241 0000099. District heating faults are reported to the city utility by us.',
          quiet_hours: 'Quiet hours 22:00–06:00 and Sundays.',
          heating_tips: 'District heating: no boiler in the flat. If all radiators are cold, tell us – the transfer station is in the basement.',
        },
      },
      {
        id: 'prop_venloer_210',
        address: '210 Venlo Road, 50823 Köln',
        street: '210 Venlo Road',
        postcode: '50823',
        city: 'Köln',
        building_year: 1995,
        heating_type: 'gas',
        heating_label: 'Gas central heating',
        heating_system: { make: 'Heatline Condens 172', installed: 2017, location: 'Attic', last_service: '2025-11-03' },
        energy_certificate: { class: 'C', valid_until: '2030-01-31' },
        connectivity: { fibre: false, cable: false, dsl: 250 },
        owner_contact_id: 'c_103',
        caretaker: 'Köln Home Services, +49 221 0000000',
        house_info: {
          waste: 'Köln waste services: residual waste Wednesday, paper every second Monday, yellow bin Friday.',
          caretaker_hours: 'Köln Home Services, Mon–Fri 8:00–17:00, +49 221 0000000.',
          emergency: 'Out of hours emergencies: +49 221 0000099.',
          quiet_hours: 'Quiet hours 22:00–07:00 and Sundays.',
        },
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
        access_notes: 'Ring at "Webb". Basement door code 4711.',
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
        access_notes: 'Ring at "Harper". No lift. Basement door code 4711.',
        furnishings: 'Partly furnished: built-in kitchen, living-room sofa and bedroom wardrobe belong to the landlord.',
      },
      {
        id: 'unit_5c',
        property_id: 'prop_musterstr_12',
        label: '3rd floor left',
        floor: 3,
        size_sqm: 82,
        rooms: 3,
        meters: [{ type: 'electricity', number: '1ESY1160123489' }],
        access_notes: 'Ring at "Dempsey". No lift.',
      },
      { id: 'unit_l1', property_id: 'prop_lothringer_40', label: '1st floor', floor: 1, size_sqm: 74, rooms: 3, meters: [{ type: 'electricity', number: '1ESY1160555101' }], access_notes: 'Ring at "Reed".' },
      { id: 'unit_l2', property_id: 'prop_lothringer_40', label: '2nd floor', floor: 2, size_sqm: 74, rooms: 3, meters: [{ type: 'electricity', number: '1ESY1160555102' }], access_notes: 'Ring at "Ross".' },
      { id: 'unit_v1', property_id: 'prop_venloer_210', label: 'Ground floor', floor: 0, size_sqm: 61, rooms: 2, meters: [{ type: 'electricity', number: '1KOE0021200101' }], access_notes: 'Ring at "Young". Bike room key with caretaker.' },
      { id: 'unit_v2', property_id: 'prop_venloer_210', label: '1st floor', floor: 1, size_sqm: 88, rooms: 4, meters: [{ type: 'electricity', number: '1KOE0021200102' }], access_notes: 'Vacant – keys with caretaker.' },
    ],

    contacts: [
      { id: 'c_101', role: 'owner', name: 'Mary Baker', email: 'mary.baker@example.com', phone: '+49 160 00000001', unit_id: null },
      { id: 'c_102', role: 'owner', name: 'Kingsway Homes Ltd', email: 'office@kingsway-homes.example', phone: '+49 241 0000010', unit_id: null },
      { id: 'c_103', role: 'owner', name: 'Dr. Henry Fowler', email: 'h.fowler@example.com', phone: '+49 170 00000011', unit_id: null },
      { id: 'c_204', role: 'tenant', name: 'Thomas Reed', email: 'tobias@example.com', phone: '+49 151 00000004', unit_id: 'unit_l1', move_in: '2022-03-01' },
      { id: 'c_205', role: 'tenant', name: 'Sophie Ross', email: 'sofia@example.com', phone: '+49 152 00000005', unit_id: 'unit_l2', move_in: '2023-07-15' },
      { id: 'c_206', role: 'tenant', name: 'Michael Young', email: 'mehmet@example.com', phone: '+49 176 00000006', unit_id: 'unit_v1', move_in: '2020-10-01' },
      { id: 'c_201', role: 'tenant', name: 'Jonah Webb', email: 'jonas@example.com', phone: '+49 152 00000002', unit_id: 'unit_1a', move_in: '2021-04-01' },
      { id: 'c_190', role: 'former_tenant', name: 'Paul Taylor', email: 'paul.s@example.com', phone: '+49 151 00000009', unit_id: 'unit_4b', move_in: '2019-05-01', move_out: '2024-11-30' },
      { id: 'c_202', role: 'tenant', name: 'Lena Harper', email: 'lena@example.com', phone: '+49 151 00000000', unit_id: 'unit_4b', move_in: '2024-12-01' },
      { id: 'c_203', role: 'tenant', name: 'Alice Dempsey', email: 'aylin@example.com', phone: '+49 157 00000003', unit_id: 'unit_5c', move_in: '2019-08-15' },
    ],

    contracts: [
      { id: 'ct_0', unit_id: 'unit_4b', type: 'lease', details: { tenant_contact_id: 'c_190', rent_cold_eur: 720, start: '2019-05-01', end: '2024-11-30' } },
      { id: 'ct_1', unit_id: 'unit_1a', type: 'lease', details: { tenant_contact_id: 'c_201', rent_cold_eur: 590, start: '2021-04-01' } },
      { id: 'ct_2', unit_id: 'unit_4b', type: 'lease', details: { tenant_contact_id: 'c_202', rent_cold_eur: 780, start: '2024-12-01' } },
      { id: 'ct_3', unit_id: 'unit_5c', type: 'lease', details: { tenant_contact_id: 'c_203', rent_cold_eur: 910, start: '2019-08-15' } },
      { id: 'ct_4', unit_id: 'unit_l1', type: 'lease', details: { tenant_contact_id: 'c_204', rent_cold_eur: 820, start: '2022-03-01' } },
      { id: 'ct_5', unit_id: 'unit_l2', type: 'lease', details: { tenant_contact_id: 'c_205', rent_cold_eur: 845, start: '2023-07-15' } },
      { id: 'ct_6', unit_id: 'unit_v1', type: 'lease', details: { tenant_contact_id: 'c_206', rent_cold_eur: 760, start: '2020-10-01' } },
      { id: 'ct_10', unit_id: null, property_id: 'prop_musterstr_12', type: 'service', details: { provider: 'Peters Handyman Services', scope: 'Caretaking, stairwell cleaning' } },
    ],

    // Partners plug in through the connector spec (see docs/connector-spec.md).
    // `connector` is the partner's manifest as registered with centrix.
    partners: [
      {
        id: 'p_schmitz',
        name: 'Smith Heating Ltd',
        category: 'craftsman',
        trades: ['heating'],
        heating_types: ['gas', 'oil'],
        postcodes: ['52062', '52064', '52066', '52068'],
        rating: 4.8,
        reviews: 212,
        hourly_rate: 68,
        contact_person: 'Tom Smith',
        working_hours: { weekday: [7, 18], saturday: [8, 13] },
        connector: manifest('p_schmitz', 'Smith Heating Ltd', { callout: 49, hourly: 68 }),
      },
      {
        id: 'p_meyer',
        name: 'Miller Building Services',
        category: 'craftsman',
        trades: ['heating', 'plumbing'],
        heating_types: ['gas', 'oil', 'district'],
        postcodes: ['52062', '52064', '52070'],
        rating: 4.5,
        reviews: 97,
        hourly_rate: 62,
        contact_person: 'Sandra Miller',
        working_hours: { weekday: [7, 18], saturday: [8, 13] },
        connector: manifest('p_meyer', 'Miller Building Services', { callout: 39, hourly: 62 }),
      },
      {
        id: 'p_krueger',
        name: 'Cooper & Sons Heating',
        category: 'craftsman',
        trades: ['heating'],
        heating_types: ['gas'],
        postcodes: ['52062', '52066'],
        rating: 4.9,
        reviews: 341,
        hourly_rate: 74,
        contact_person: 'Ralph Cooper',
        working_hours: { weekday: [7, 18], saturday: [8, 13] },
        connector: manifest('p_krueger', 'Cooper & Sons Heating', { callout: 55, hourly: 74 }),
      },
      {
        id: 'p_eifel',
        name: 'Hillside Heat Pump Service',
        category: 'craftsman',
        trades: ['heating'],
        heating_types: ['heat_pump'],
        postcodes: ['52070', '52072', '52076'],
        rating: 4.7,
        reviews: 58,
        hourly_rate: 79,
        contact_person: 'Ian Lawson',
        working_hours: { weekday: [7, 18], saturday: [8, 13] },
        connector: manifest('p_eifel', 'Hillside Heat Pump Service', { callout: 59, hourly: 79 }),
      },
      // Handymen: everything that isn't a specialist trade (furniture, doors, locks, small fixes)
      {
        id: 'p_peters',
        name: 'Peters Handyman Services',
        category: 'craftsman',
        trades: ['general', 'locksmith'],
        heating_types: [],
        postcodes: ['52062', '52064', '52066', '52068', '52070', '52072'],
        rating: 4.6,
        reviews: 184,
        hourly_rate: 45,
        contact_person: 'Owen Peters',
        working_hours: { weekday: [7, 18], saturday: [8, 13] },
        connector: manifest('p_peters', 'Peters Handyman Services', { callout: 29, hourly: 45 }, 'handyman'),
      },
      {
        id: 'p_koeln',
        name: 'Köln Home Services',
        category: 'craftsman',
        trades: ['general', 'locksmith'],
        heating_types: [],
        postcodes: ['50823', '50825', '50827'],
        rating: 4.4,
        reviews: 76,
        hourly_rate: 48,
        contact_person: 'Selina Adams',
        working_hours: { weekday: [7, 18], saturday: [8, 13] },
        connector: manifest('p_koeln', 'Köln Home Services', { callout: 32, hourly: 48 }, 'handyman'),
      },
    ],

    // Each partner's calendar: what he is already doing (busy). Free time is
    // whatever is left inside his working hours – centrix computes it.
    slots: partnerCalendars(),

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
        to: 'Lena Harper',
        text: 'Reminder: annual heating service took place on 14 Oct. No action needed.',
        timestamp: at(-37, 10),
      },
    ],
    events: [],
  };
  addHistory(db);
  addPartnerHistory(db);
  addGeneratedPortfolio(db, Number(process.env.SEED_BUILDINGS ?? 150));
  addOperationsHistory(db);
  addUnitDocuments(db);
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
    title: 'Invoice Miller Building Services', number: 'INV-2026-0917', issuer: 'Miller Building Services',
    bill_to: 'Mary Baker c/o reltix Property Management',
    lines: [{ text: 'Call-out fee', qty: 1, unit_eur: 39 }, { text: 'Labour', qty: 0.5, unit_eur: 62 }, { text: 'Tap cartridge', qty: 1, unit_eur: 24.5 }],
    net_eur: 94.5, vat_eur: 17.96, amount_eur: 112.46, note: 'Replaced tap cartridge', issued_at: closed, url: '/documents/doc_hist_inv',
  });
  const msgs = [
    [opened, 'portal', 'Lena Harper', 'centrix', 'The kitchen tap keeps dripping even when it is fully closed.'],
    [opened, 'portal', 'centrix', 'Lena Harper', "Thanks Lena, we've got it. We're booking a plumbing specialist now – you'll pick an appointment right here, no calls needed."],
    [at(-73, 9), 'portal', 'centrix', 'Lena Harper', 'Miller Building Services can come: Thu 10:00–12:00 · Fri 14:00–16:00. Tap the one that suits you.'],
    [at(-73, 9, 20), 'portal', 'Lena Harper', 'centrix', 'Booked Fri 14:00–16:00'],
    [closed, 'portal', 'centrix', 'Lena Harper', 'Repair done: replaced tap cartridge. How did it go?'],
    [closed, 'email', 'centrix', 'Mary Baker', 'Tap repair in 2nd floor right done. Invoice INV-2026-0917: €112.46. Within budget, booked automatically.'],
  ];
  msgs.forEach(([timestamp, channel, from, to, text], i) => db.messages.push({ id: `m_hist_${i}`, unit_id: 'unit_4b', case_id: id, channel, from, to, text, timestamp }));
  [
    [opened, 'case.created', { text: 'The kitchen tap keeps dripping even when it is fully closed.' }, 'Lena Harper'],
    [opened, 'case.status_changed', { to: 'awaiting_pm_approval', label: 'Awaiting approval' }, 'centrix'],
    [at(-74, 9), 'case.approved', { by: 'PM', estimate: { gross_eur: 157.08 } }, 'PM'],
    [at(-73, 9, 20), 'job.scheduled', { slot: 'Fri 14:00–16:00' }, 'Lena Harper'],
    [closed, 'job.result', { amount_eur: 112.46 }, 'Miller Building Services'],
    [closed, 'case.status_changed', { to: 'closed', label: 'Closed', note: '5★' }, 'Lena Harper'],
  ].forEach(([timestamp, type, data, actor], i) => db.events.push({ id: `ev_hist_${i}`, type, case_id: id, unit_id: 'unit_4b', actor, timestamp, data }));
}

function manifest(partnerId, name, price, kind = 'heating') {
  if (kind === 'handyman') {
    return {
      spec_version: '1.0',
      partner_id: partnerId,
      name,
      category: 'craftsman',
      services: [
        {
          code: 'general.repair',
          name: 'Small repairs and handyman work',
          price_model: { type: 'time_and_material', callout_fee_eur: price.callout, hourly_rate_eur: price.hourly, typical_hours: 1, vat_rate: 0.19 },
        },
      ],
      eligibility: { lead_time_hours: { high: 48, normal: 120, low: 336 } },
      required_data: [
        { field: 'property.address', purpose: 'Get to the building' },
        { field: 'unit.floor', purpose: 'Find the flat' },
        { field: 'case.summary', purpose: 'Understand the job' },
        { field: 'case.urgency', purpose: 'Plan the visit' },
        { field: 'case.photos', purpose: 'Bring the right tools' },
        { field: 'tenant.phone', purpose: 'Call to be let in', consent: true },
      ],
      endpoints: { availability: `/connector/partners/${partnerId}/availability`, jobs: `/connector/partners/${partnerId}/jobs` },
      webhooks: { status: '/centrix/jobs/{job_id}/status', result: '/centrix/jobs/{job_id}/result' },
    };
  }
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

// Earlier jobs for Smith Heating: one completed, one declined, so the
// partner app has a real history.
function addPartnerHistory(db) {
  const prop = db.properties[0];
  const fields = (unit, summary) => ({
    'property.address': prop.address,
    'unit.floor': `${unit.label} (floor ${unit.floor})`,
    'property.heating_system': { type: prop.heating_label, ...prop.heating_system },
    'property.building_year': prop.building_year,
    'case.summary': summary,
    'case.urgency': 'normal',
    'case.photos': [],
  });

  // 1. Completed: radiator in ground floor left, 5 weeks ago
  const u1 = db.units.find((u) => u.id === 'unit_1a');
  const start = at(-35, 10);
  const end = at(-35, 12);
  db.slots.push({ id: 's_sch_hist', partner_id: 'p_schmitz', start, end, status: 'booked' });
  db.cases.push({
    id: 'case_hist_rad', unit_id: 'unit_1a', reporter_contact_id: 'c_201', title: 'Radiator stays cold',
    text: 'The radiator in the living room stays cold, the others work.', photos: [], trade: 'heating', urgency: 'normal',
    summary: 'One radiator in the living room stays cold, others are fine – likely air or a stuck valve.',
    triage: { source: 'rules', trade: 'heating', urgency: 'normal', reasons: [] }, status: 'closed', partner_id: 'p_schmitz',
    slot_id: 's_sch_hist', job_id: 'job_hist_rad', declined_partner_ids: [], match: null,
    estimate: { service: 'heating.repair', net_eur: 151, gross_eur: 179.69 }, rating: { stars: 4, comment: null, at: end },
    created_at: at(-37, 9), updated_at: end, resolved_at: end,
  });
  db.jobs.push({
    id: 'job_hist_rad', case_id: 'case_hist_rad', partner_id: 'p_schmitz', status: 'invoiced',
    payload: { job_ref: 'case_hist_rad', service: 'heating.repair', case: { trade: 'heating', urgency: 'normal' }, fields: fields(u1, 'One radiator in the living room stays cold, others are fine – likely air or a stuck valve.'), withheld: [] },
    payload_history: [], offered_slot_ids: [], slot_id: 's_sch_hist', estimate: { gross_eur: 179.69 },
    price_model: db.partners[0].connector.services[0].price_model,
    completion_note: 'Freed stuck thermostatic valve pin. Bled radiators', created_at: at(-37, 9), completed_at: end,
  });
  db.documents.push({
    id: 'doc_hist_rad', case_id: 'case_hist_rad', unit_id: 'unit_1a', job_id: 'job_hist_rad', type: 'invoice',
    title: 'Invoice Smith Heating Ltd', number: 'INV-2026-0988', issuer: 'Smith Heating Ltd',
    bill_to: 'Mary Baker c/o reltix Property Management',
    lines: [{ text: 'Call-out fee', qty: 1, unit_eur: 49 }, { text: 'Labour', qty: 1, unit_eur: 68 }, { text: 'Thermostatic valve head', qty: 1, unit_eur: 21.4 }],
    net_eur: 138.4, vat_eur: 26.3, amount_eur: 164.7, note: 'Freed stuck thermostatic valve pin. Bled radiators', issued_at: end, url: '/documents/doc_hist_rad',
  });

  // 2. Declined: boiler pressure in 3rd floor left, 3 weeks ago – went to Miller Building Services instead
  const u3 = db.units.find((u) => u.id === 'unit_5c');
  db.cases.push({
    id: 'case_hist_pressure', unit_id: 'unit_5c', reporter_contact_id: 'c_203', title: 'Heating pressure keeps dropping',
    text: 'Heating pressure drops every few days, I keep refilling it.', photos: [], trade: 'heating', urgency: 'normal',
    summary: 'System pressure drops every few days – possible leak or faulty expansion vessel.',
    triage: { source: 'rules', trade: 'heating', urgency: 'normal', reasons: [] }, status: 'closed', partner_id: 'p_meyer',
    slot_id: null, job_id: null, declined_partner_ids: ['p_schmitz'], match: null, rating: { stars: 5, comment: null, at: at(-19, 15) },
    created_at: at(-22, 8), updated_at: at(-19, 15), resolved_at: at(-19, 15),
  });
  db.jobs.push({
    id: 'job_hist_pressure', case_id: 'case_hist_pressure', partner_id: 'p_schmitz', status: 'declined',
    decline_reason: 'Fully booked', declined_at: at(-22, 10),
    payload: { job_ref: 'case_hist_pressure', service: 'heating.repair', case: { trade: 'heating', urgency: 'normal' }, fields: fields(u3, 'System pressure drops every few days – possible leak or faulty expansion vessel.'), withheld: [{ field: 'tenant.phone', label: 'Tenant phone', reason: 'awaiting tenant consent' }] },
    payload_history: [], offered_slot_ids: [], slot_id: null, estimate: { gross_eur: 179.69 }, created_at: at(-22, 9),
  });
}

// The documents a property manager keeps in a unit's file: leases, handover
// protocols, and building-wide papers (energy certificate, house rules).
// Invoices are not here – they belong to the case that caused them.
function addUnitDocuments(db) {
  for (const ct of db.contracts.filter((c) => c.type === 'lease')) {
    const tenant = db.contacts.find((c) => c.id === ct.details.tenant_contact_id);
    const unit = db.units.find((u) => u.id === ct.unit_id);
    const ended = Boolean(ct.details.end);
    db.documents.push({
      id: `doc_lease_${ct.id}`, unit_id: ct.unit_id, case_id: null, contract_id: ct.id, type: 'lease',
      title: `Lease agreement – ${tenant.name}`, issuer: 'reltix Property Management', issued_at: new Date(ct.details.start).toISOString(),
      status: ended ? 'ended' : 'active',
      fields: [
        ['Tenant', tenant.name], ['Flat', `${unit.label}, ${unit.size_sqm} m², ${unit.rooms} rooms`], ['Start', ct.details.start],
        ['End', ct.details.end ?? 'open-ended'], ['Cold rent', `€${ct.details.rent_cold_eur}`], ['Deposit', `€${ct.details.rent_cold_eur * 3}`],
      ],
      url: `/documents/doc_lease_${ct.id}`,
    });
    db.documents.push({
      id: `doc_handover_${ct.id}`, unit_id: ct.unit_id, case_id: null, contract_id: ct.id, type: 'handover',
      title: `Handover protocol (move-in) – ${tenant.name}`, issuer: 'reltix Property Management', issued_at: new Date(ct.details.start).toISOString(),
      status: ended ? 'ended' : 'active',
      fields: [['Keys handed over', '2 flat, 2 front door, 1 basement, 1 letterbox'], ['Meter readings', unit.meters.map((m) => `${m.type} ${m.number}`).join(', ')], ['Condition', 'Freshly painted, no defects noted']],
      url: `/documents/doc_handover_${ct.id}`,
    });
  }
  for (const p of db.properties) {
    for (const unit of db.units.filter((u) => u.property_id === p.id)) {
      db.documents.push({
        id: `doc_epc_${unit.id}`, unit_id: unit.id, property_id: p.id, case_id: null, type: 'energy_certificate',
        title: `Energy certificate – class ${p.energy_certificate.class}`, issuer: 'Building', issued_at: new Date('2019-04-01').toISOString(),
        status: 'active', fields: [['Class', p.energy_certificate.class], ['Valid until', p.energy_certificate.valid_until], ['Heating', p.heating_label]],
        url: `/documents/doc_epc_${unit.id}`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// A large, made-up portfolio to test scale: ~150 buildings, ~900 units in six
// cities, owned by companies, owners' associations (WEG) and private landlords.
// Deterministic (fixed random seed), so every reset produces the same data.
// All names, companies and numbers are fictional.
function addGeneratedPortfolio(db, buildingCount) {
  if (!buildingCount) return;
  let seed = 20261120;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  const cities = [
    { city: 'Aachen', share: 0.2, postcodes: ['52062', '52064', '52066', '52068', '52070', '52072'], rent: [9.5, 13.5], area: '241', streets: ['Jacob Street', 'Bridge Street', 'Theatre Street', 'Elm Avenue', 'Victoria Avenue', 'Moat Lane', 'Liège Road', 'Roermond Road', 'Krefeld Road', 'Abbey Way'] },
    { city: 'Köln', share: 0.22, postcodes: ['50667', '50672', '50674', '50676', '50823', '50825', '50827', '51063'], rent: [12, 17], area: '221', streets: ['Aachen Road', 'Willow Street', 'Neuss Road', 'Severin Street', 'College Road', 'Church Road', 'Station Road', 'Harbour Street', 'Ring Road', 'Bonn Road'] },
    { city: 'Düsseldorf', share: 0.18, postcodes: ['40210', '40211', '40215', '40219', '40223', '40227', '40476'], rent: [12, 18], area: '211', streets: ['Cologne Road', 'Park Avenue', 'Loretto Street', 'North Street', 'Kaiser Road', 'Fountain Street', 'Field Street', 'Brook Street'] },
    { city: 'Essen', share: 0.14, postcodes: ['45127', '45128', '45130', '45131', '45136', '45138', '45147'], rent: [7.5, 11], area: '201', streets: ['Garden Street', 'Alfred Street', 'Steele Road', 'Meadow Lane', 'Huysen Avenue', 'Chapel Street', 'Market Street'] },
    { city: 'Frankfurt am Main', share: 0.16, postcodes: ['60311', '60316', '60318', '60322', '60385', '60389', '60594'], rent: [15, 21], area: '69', streets: ['Hill Street', 'Swiss Street', 'Leipzig Road', 'Highland Road', 'Oak Way', 'Mainz Road', 'Good Lane'] },
    { city: 'Berlin', share: 0.1, postcodes: ['10115', '10245', '10405', '10437', '10961', '12043', '12047'], rent: [13, 19], area: '30', streets: ['Chestnut Avenue', 'Forest Street', 'Sun Avenue', 'Orange Street', 'Bellevue Avenue', 'Weser Street', 'Mountain Street'] },
  ];
  const companies = [
    'Rhine View Property Ltd', 'Linden Court Homes plc', 'Maas & Partners Estates LLP', 'Cathedral City Living Ltd', 'Westpark Residential Ltd',
    'Ruhr Stone Homes Ltd', 'Riverside Asset Management Ltd', 'Spree Quarter Property Ltd', 'Northwest Hanse Holdings Ltd', 'Oster Family Office',
    'Old Town Heirs Partnership', 'Crane Real Estate Fund I', 'Linden Housing Co-op', 'Bruckner & Sons Estates',
  ];
  const first = ['Anna', 'Luke', 'Mia', 'Jonah', 'Emma', 'Leo', 'Sophie', 'Finn', 'Lea', 'Paul', 'Hannah', 'Ben', 'Lily', 'Elias', 'Marie', 'Noah', 'Clara', 'David', 'Ella', 'Tim', 'Sarah', 'Matt', 'Ellie', 'Cal', 'Olivia', 'Peter', 'Fiona', 'Joseph', 'Chloe', 'Mark', 'Nina', 'Felix', 'Laura', 'Jack', 'Amy', 'Theo', 'Grace', 'Kevin', 'Ivy', 'Max'];
  const last = ['Miller', 'Smith', 'Taylor', 'Fisher', 'Webb', 'Mayer', 'Walker', 'Baker', 'Shaw', 'Harper', 'Cook', 'Rich', 'Little', 'Wolfe', 'Newman', 'Black', 'Carpenter', 'Brown', 'Cooper', 'Hart', 'Long', 'Warner', 'Crane', 'Lee', 'Collins', 'Turner', 'Kay', 'Nolan', 'Kowal', 'Ross', 'Ivers', 'Hadley', 'Nguyen', 'Bauer', 'Vaughan', 'Archer'];
  const heating = [
    ['gas', 'Gas central heating', ['ThermoMax Combi 24', 'Heatline Condens 172', 'Northstar 200 Wall', 'Brightflame CGB-2']],
    ['district', 'District heating', ['District heating transfer station']],
    ['heat_pump', 'Heat pump', ['AirSource 250', 'Greenair WPL 25']],
    ['oil', 'Oil central heating', ['OilPro 195']],
  ];
  const floorName = (f) => (f === 0 ? 'Ground floor' : f === 1 ? '1st floor' : f === 2 ? '2nd floor' : f === 3 ? '3rd floor' : `${f}th floor`);
  const used = new Set(db.properties.map((p) => p.street));
  let contactN = 1000;
  const person = () => `${pick(first)} ${pick(last)}`;
  const companyOwners = companies.map((name, i) => ({ id: `c_co_${i}`, role: 'owner', name, email: `verwaltung@${name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}.example`, phone: `+49 ${int(200, 699)} 000${int(1000, 9999)}`, unit_id: null, owner_type: 'company' }));
  db.contacts.push(...companyOwners);

  for (let b = 0; b < buildingCount; b++) {
    // pick a city by share
    let r = rnd(), c = cities[0];
    for (const x of cities) { if ((r -= x.share) <= 0) { c = x; break; } c = x; }
    let street;
    do street = `${int(1, 180)} ${pick(c.streets)}`; while (used.has(street));
    used.add(street);
    const postcode = pick(c.postcodes);
    const [hType, hLabel, makes] = pick(heating);

    // owner: company 45%, owners' association 15%, private landlord 40%
    const ro = rnd();
    let owner;
    if (ro < 0.45) owner = pick(companyOwners);
    else {
      owner = ro < 0.6
        ? { id: `c_${contactN++}`, role: 'owner', name: `Owners' Association, ${street}`, email: `weg-${contactN}@example.com`, phone: null, unit_id: null, owner_type: 'weg' }
        : { id: `c_${contactN++}`, role: 'owner', name: person(), email: `owner${contactN}@example.com`, phone: `+49 1${int(50, 79)} 0000${int(1000, 9999)}`, unit_id: null, owner_type: 'private' };
      db.contacts.push(owner);
    }
    const year = pick([1898, 1905, 1912, 1928, 1954, 1958, 1962, 1968, 1972, 1979, 1985, 1994, 1999, 2004, 2012, 2019]);
    const pid = `prop_g${b}`;
    db.properties.push({
      id: pid, address: `${street}, ${postcode} ${c.city}`, street, postcode, city: c.city, building_year: year,
      heating_type: hType, heating_label: hLabel,
      heating_system: { make: pick(makes), installed: Math.max(year, int(2005, 2023)), location: hType === 'district' ? 'Basement, utility room' : 'Basement, boiler room', last_service: `2026-${String(int(1, 9)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}` },
      energy_certificate: { class: pick(['B', 'C', 'C', 'D', 'D', 'E', 'F', 'G']), valid_until: `20${int(27, 34)}-0${int(1, 9)}-30` },
      owner_contact_id: owner.id,
      connectivity: { fibre: rnd() < 0.45, cable: rnd() < 0.7, dsl: pick([50, 100, 250]) },
      caretaker: `${c.city} Caretakers, +49 ${c.area} 0000000`,
    });

    const floors = int(1, 5);
    const perFloor = int(1, 3);
    const sides = perFloor === 1 ? [''] : perFloor === 2 ? [' left', ' right'] : [' left', ' middle', ' right'];
    for (let f = 0; f <= floors; f++) {
      for (const side of sides) {
        const uid = `u_g${b}_${f}${side.trim().charAt(0) || 'x'}`;
        const size = int(32, 118);
        const rooms = size < 45 ? 1 : size < 65 ? 2 : size < 90 ? 3 : 4;
        db.units.push({
          id: uid, property_id: pid, label: `${floorName(f)}${side}`, floor: f, size_sqm: size, rooms,
          meters: [{ type: 'electricity', number: `1ESY${int(10000000, 99999999)}` }],
          access_notes: 'Ring at the name plate.',
        });
        if (rnd() < 0.08) continue; // vacant
        const moveIn = `${int(2008, 2025)}-${String(int(1, 12)).padStart(2, '0')}-01`;
        const name = person();
        const tid = `c_${contactN++}`;
        db.contacts.push({ id: tid, role: 'tenant', name, email: `${name.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').replace(' ', '.')}${contactN}@example.com`, phone: `+49 1${int(50, 79)} 0000${int(1000, 9999)}`, unit_id: uid, move_in: moveIn });
        const perSqm = c.rent[0] + rnd() * (c.rent[1] - c.rent[0]);
        db.contracts.push({ id: `ct_${tid}`, unit_id: uid, type: 'lease', details: { tenant_contact_id: tid, rent_cold_eur: Math.round(size * perSqm), start: moveIn } });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// A year of operations for the statistics dashboard: past cases (more heating
// in winter), a handful open right now, partner changes (joins, declines,
// rating moves), and contract deadlines (leases ending, service contracts,
// energy certificates, heating service). Fictional and deterministic.
function addOperationsHistory(db) {
  let seed = 4242;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const DAY = 864e5;
  const nowMs = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const date = (ms) => iso(ms).slice(0, 10);

  // partners joined at different times (onboarding = a "partner change")
  const joined = { p_schmitz: 400, p_meyer: 330, p_krueger: 300, p_eifel: 150, p_peters: 120, p_koeln: 21 };
  for (const p of db.partners) {
    p.joined_at = iso(nowMs - (joined[p.id] ?? 200) * DAY);
    p.rating_history = [{ at: iso(nowMs - 90 * DAY), rating: Math.round((p.rating - 0.2 + rnd() * 0.3) * 10) / 10 }, { at: iso(nowMs), rating: p.rating }];
  }

  const units = db.units.filter((u) => u.id.startsWith('u_g'));
  const tenantOf = (uid) => db.contacts.find((c) => c.unit_id === uid && c.role === 'tenant');
  const problems = {
    heating: ['Heating not working', 'Radiator stays cold', 'No hot water', 'Noisy heating', 'Heating pressure drops'],
    plumbing: ['Dripping tap', 'Blocked drain', 'Water leak under sink', 'Toilet keeps running'],
    electrical: ['Socket not working', 'Fuse keeps tripping', 'Stairwell light out'],
    general: ['Door does not close', 'Window handle broken', 'Mould in bathroom', 'Broken blind'],
    locksmith: ['Lock jammed', 'Letterbox lock broken'],
  };
  const partnerFor = { heating: ['p_schmitz', 'p_meyer', 'p_krueger'], plumbing: ['p_meyer'], electrical: ['p_peters'], general: ['p_peters', 'p_koeln'], locksmith: ['p_peters', 'p_koeln'] };
  const OPEN = ['job_sent', 'slot_offered', 'slot_confirmed', 'slot_confirmed', 'in_progress', 'invoiced'];

  const make = (createdMs, open) => {
    const month = new Date(createdMs).getMonth();
    const winter = month >= 9 || month <= 2;
    const trade = rnd() < (winter ? 0.5 : 0.22) ? 'heating' : pick(['plumbing', 'plumbing', 'electrical', 'general', 'general', 'locksmith']);
    const urgency = trade === 'heating' && winter ? (rnd() < 0.7 ? 'high' : 'normal') : rnd() < 0.08 ? 'emergency' : rnd() < 0.25 ? 'high' : rnd() < 0.8 ? 'normal' : 'low';
    const unit = pick(units);
    const tenant = tenantOf(unit.id);
    if (!tenant) return;
    const partners = partnerFor[trade];
    const partner = pick(partners);
    const declined = rnd() < 0.09 && partners.length > 1 ? [partners.find((x) => x !== partner)] : [];
    const days = urgency === 'emergency' ? 0.3 + rnd() : urgency === 'high' ? 1 + rnd() * 3 : 3 + rnd() * 12;
    const resolvedMs = createdMs + days * DAY;
    const isOpen = open || resolvedMs > nowMs;
    const id = `case_h${db.cases.length}`;
    const title = pick(problems[trade]);
    const status = isOpen ? pick(OPEN) : 'closed';
    db.cases.push({
      id, unit_id: unit.id, reporter_contact_id: tenant.id, title, text: title, photos: [], trade, urgency,
      summary: title, triage: { source: 'rules', trade, urgency, reasons: [] }, status, partner_id: partner,
      slot_id: null, job_id: null, declined_partner_ids: declined, match: null, generated: true,
      estimate: { gross_eur: Math.round(90 + rnd() * 400) },
      rating: isOpen ? null : { stars: rnd() < 0.75 ? 5 : rnd() < 0.7 ? 4 : 3, at: iso(resolvedMs) },
      cost_eur: isOpen ? null : Math.round((80 + rnd() * (trade === 'heating' ? 520 : 300)) * 100) / 100,
      created_at: iso(createdMs), updated_at: iso(isOpen ? createdMs : resolvedMs), resolved_at: isOpen ? null : iso(resolvedMs),
    });
    db.events.push({ id: `ev_${id}_c`, type: 'case.created', case_id: id, unit_id: unit.id, actor: tenant.name, timestamp: iso(createdMs), data: { text: title } });
    if (declined.length) {
      const pName = db.partners.find((x) => x.id === declined[0])?.name;
      db.events.push({ id: `ev_${id}_d`, type: 'case.status_changed', case_id: id, unit_id: unit.id, actor: pName, timestamp: iso(createdMs + 0.2 * DAY), data: { from: 'job_sent', to: 'partner_declined', label: 'Partner declined', note: pick(['Fully booked', 'Not my area', 'Needs a specialist']), partner_id: declined[0] } });
    }
    if (!isOpen) db.events.push({ id: `ev_${id}_x`, type: 'case.status_changed', case_id: id, unit_id: unit.id, actor: 'centrix', timestamp: iso(resolvedMs), data: { to: 'closed', label: 'Closed' } });
  };

  // ~52 weeks of history; more reports in the cold months
  for (let d = 364; d >= 1; d--) {
    const ms = nowMs - d * DAY + rnd() * DAY * 0.8;
    const m = new Date(ms).getMonth();
    const perDay = m >= 10 || m <= 1 ? 3.1 : m === 9 || m === 2 ? 2.3 : 1.5;
    const n = Math.floor(perDay + rnd());
    for (let i = 0; i < n; i++) make(ms, false);
  }
  // open right now
  for (let i = 0; i < 8; i++) make(nowMs - rnd() * 12 * DAY, true);

  // contract deadlines
  const leases = db.contracts.filter((c) => c.type === 'lease' && c.unit_id?.startsWith('u_g') && !c.details.end);
  for (const ct of leases) {
    if (rnd() < 0.035) {
      ct.details.end = date(nowMs + (5 + rnd() * 110) * DAY);
      ct.details.end_reason = rnd() < 0.7 ? 'Notice given by tenant' : 'Fixed-term lease ends';
    }
  }
  const services = [
    ['Caretaking', 'City Caretakers', 90],
    ['Building insurance', 'Rhineland Insurance', 30],
    ['Lift maintenance', 'West Lift Services', 90],
    ['Chimney sweep inspection', 'District chimney sweep', 0],
    ['Stairwell cleaning', 'Sparkle & Co Cleaning', 30],
  ];
  for (const p of db.properties.filter((x) => x.id.startsWith('prop_g') || x.id === 'prop_musterstr_12')) {
    for (const [kind, provider, notice] of [pick(services), pick(services)]) {
      if (db.contracts.some((c) => c.property_id === p.id && c.details.service === kind)) continue;
      db.contracts.push({
        id: `ct_svc_${p.id}_${kind.replace(/\W+/g, '').toLowerCase()}`, unit_id: null, property_id: p.id, type: 'service',
        details: { service: kind, provider, renews_on: date(nowMs + (3 + rnd() * 360) * DAY), notice_days: notice, annual_eur: Math.round(300 + rnd() * 4000) },
      });
    }
    if (rnd() < 0.12) p.energy_certificate.valid_until = date(nowMs + (10 + rnd() * 100) * DAY);
    if (p.heating_system?.last_service && rnd() < 0.15) p.heating_system.last_service = date(nowMs - (260 + rnd() * 100) * DAY);
  }
}

// Busy blocks for the next two weeks – other customers, quotes, paperwork.
// Cooper & Sons is fully booked for five days, so matching visibly skips him.
function partnerCalendars() {
  let seed = 777;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const labels = {
    heating: ['Boiler service – private customer', 'Quote visit', 'Heating replacement', 'Gas safety check', 'Office / paperwork'],
    general: ['Kitchen fitting', 'Door adjustment – other client', 'Stairwell repairs', 'Quote visit', 'Office / paperwork'],
  };
  const out = [];
  const add = (pid, day, startH, hours, label) => {
    const s0 = at(day, Math.floor(startH), Math.round((startH % 1) * 60));
    out.push({ id: `s_${pid}_${day}_${startH}`, partner_id: pid, start: s0, end: new Date(new Date(s0).getTime() + hours * HOUR).toISOString(), status: 'busy', label });
  };
  const partners = { p_schmitz: 'heating', p_meyer: 'heating', p_krueger: 'heating', p_eifel: 'heating', p_peters: 'general', p_koeln: 'general' };
  for (const [pid, kind] of Object.entries(partners)) {
    for (let day = 0; day < 15; day++) {
      const dow = new Date(at(day, 12)).getDay();
      if (dow === 0) continue; // Sunday off
      if (pid === 'p_krueger' && day <= 5) {
        add(pid, day, 7, dow === 6 ? 6 : 11, 'Heating replacement project');
        continue;
      }
      const starts = dow === 6 ? [8, 10] : [7, 9.5, 13, 15.5];
      const n = dow === 6 ? (rnd() < 0.5 ? 1 : 0) : 1 + Math.floor(rnd() * 2.2);
      const chosen = starts.filter(() => rnd() < 0.6).slice(0, n);
      for (const h of chosen) add(pid, day, h, rnd() < 0.5 ? 1.5 : 2, labels[kind][Math.floor(rnd() * labels[kind].length)]);
    }
  }
  return out;
}
