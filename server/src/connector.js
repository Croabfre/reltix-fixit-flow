// Generic connector layer. Nothing in here is heating-specific: a partner's
// manifest says which centrix fields it needs, and centrix resolves them from
// the record. Fields marked `consent: true` are withheld until consent exists.

export const FIELD_LABELS = {
  'property.address': 'Address',
  'property.heating_system': 'Heating system',
  'property.building_year': 'Building year',
  'unit.floor': 'Floor',
  'unit.access_notes': 'Access notes',
  'unit.meters': 'Meters',
  'unit.move_in': 'Move-in date',
  'case.summary': 'Problem',
  'case.urgency': 'Urgency',
  'case.photos': 'Photos',
  'tenant.first_name': 'Tenant first name',
  'tenant.name': 'Tenant name',
  'tenant.phone': 'Tenant phone',
  'tenant.email': 'Tenant email',
};

export function resolveField(field, ctx) {
  const { property, unit, tenant, kase } = ctx;
  switch (field) {
    case 'property.address': return property.address;
    case 'property.heating_system': return { type: property.heating_label, ...property.heating_system };
    case 'property.building_year': return property.building_year;
    case 'unit.floor': return `${unit.label} (floor ${unit.floor})`;
    case 'unit.access_notes': return unit.access_notes;
    case 'unit.meters': return unit.meters;
    case 'unit.move_in': return tenant?.move_in;
    case 'case.summary': return kase.summary;
    case 'case.urgency': return kase.urgency;
    case 'case.photos': return kase.photos ?? [];
    case 'tenant.first_name': return tenant?.name.split(' ')[0];
    case 'tenant.name': return tenant?.name;
    case 'tenant.phone': return tenant?.phone;
    case 'tenant.email': return tenant?.email;
    default: return undefined;
  }
}

export function contextFor(db, kase) {
  const unit = db.units.find((u) => u.id === kase.unit_id);
  const property = db.properties.find((p) => p.id === unit.property_id);
  const tenant = db.contacts.find((c) => c.id === kase.reporter_contact_id);
  return { unit, property, tenant, kase };
}

export function hasConsent(db, contactId, partnerId, field) {
  return db.consents.some(
    (c) => c.contact_id === contactId && c.partner_id === partnerId && !c.revoked_at && c.data_shared.includes(field),
  );
}

/** Build the minimal job payload from the partner's `required_data`. */
export function buildPayload(db, partner, kase) {
  const ctx = contextFor(db, kase);
  const fields = {};
  const withheld = [];
  for (const req of partner.connector.required_data) {
    if (req.consent && !hasConsent(db, ctx.tenant.id, partner.id, req.field)) {
      withheld.push({ field: req.field, label: FIELD_LABELS[req.field] ?? req.field, reason: 'awaiting tenant consent' });
      continue;
    }
    fields[req.field] = resolveField(req.field, ctx);
  }
  return {
    job_ref: kase.id,
    service: 'heating.repair',
    case: { trade: kase.trade, urgency: kase.urgency, reported_at: kase.created_at },
    fields,
    withheld,
  };
}

export function consentFields(partner) {
  return partner.connector.required_data.filter((r) => r.consent).map((r) => r.field);
}

// Standard partner → centrix job states (spec §6) and how they move the case.
export const PARTNER_STATES = ['accepted', 'declined', 'scheduled', 'in_progress', 'completed', 'cancelled'];
