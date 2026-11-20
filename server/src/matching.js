// Pick the best partner for a case. Every candidate gets a list of checks,
// so centrix can explain "chosen because…" and "excluded because…".

const HOUR = 3600 * 1000;

export function leadTimeHours(partner, urgency) {
  const lt = partner.connector?.eligibility?.lead_time_hours ?? {};
  if (urgency === 'emergency') return 6;
  return lt[urgency] ?? lt.normal ?? 120;
}

const BLOCKING = new Set(['busy', 'booked', 'offered']);

/**
 * Free windows in a partner's calendar: inside his working hours, not
 * overlapping anything he already has (busy, booked, or offered to a tenant).
 */
export function freeWindows(db, partner, { from = new Date(), until, hours = 2, max = 50 } = {}) {
  const end = until ?? new Date(from.getTime() + 14 * 24 * HOUR);
  const blocks = db.slots
    .filter((s) => s.partner_id === partner.id && BLOCKING.has(s.status))
    .map((s) => [new Date(s.start).getTime(), new Date(s.end).getTime()]);
  const wh = partner.working_hours ?? { weekday: [7, 18], saturday: [8, 13] };
  const earliest = from.getTime() + 2 * HOUR; // nobody can be there in under two hours
  const out = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  for (; day.getTime() < end.getTime() && out.length < max; day.setDate(day.getDate() + 1)) {
    const dow = day.getDay();
    const span = dow === 0 ? null : dow === 6 ? wh.saturday : wh.weekday;
    if (!span) continue;
    for (let h = span[0]; h + hours <= span[1]; h += 1) {
      const s = new Date(day);
      s.setHours(h, 0, 0, 0);
      const a = s.getTime();
      const b = a + hours * HOUR;
      if (a < earliest || a > end.getTime()) continue;
      if (blocks.some(([x, y]) => a < y && b > x)) continue;
      out.push({ start: new Date(a).toISOString(), end: new Date(b).toISOString() });
      if (out.length >= max) break;
    }
  }
  return out;
}

export function overlapsBusy(db, partnerId, startIso, endIso) {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  return db.slots.some((s) => s.partner_id === partnerId && BLOCKING.has(s.status) && a < new Date(s.end).getTime() && b > new Date(s.start).getTime());
}

export function freeSlotsInWindow(db, partner, urgency, from = new Date()) {
  const until = new Date(from.getTime() + leadTimeHours(partner, urgency) * HOUR);
  return freeWindows(db, partner, { from, until, max: 5 });
}

export function estimate(partner, serviceCode = 'heating.repair') {
  const svc = partner.connector.services.find((s) => s.code === serviceCode) ?? partner.connector.services[0];
  const pm = svc.price_model;
  const net = pm.type === 'fixed' ? pm.price_eur : pm.callout_fee_eur + pm.hourly_rate_eur * pm.typical_hours;
  return { service: svc.code, net_eur: round(net), gross_eur: round(net * (1 + (pm.vat_rate ?? 0.19))) };
}

const round = (n) => Math.round(n * 100) / 100;

export function matchPartners(db, kase, { exclude = [] } = {}) {
  const unit = db.units.find((u) => u.id === kase.unit_id);
  const property = db.properties.find((p) => p.id === unit.property_id);

  const candidates = db.partners.map((p) => {
    const slots = freeSlotsInWindow(db, p, kase.urgency);
    const checks = [
      { label: `Trade: ${kase.trade}`, ok: p.trades.includes(kase.trade) },
      { label: `Covers ${property.postcode}`, ok: p.postcodes.includes(property.postcode) },
      { label: `Handles ${property.heating_label.toLowerCase()}`, ok: kase.trade !== 'heating' || p.heating_types.includes(property.heating_type) },
      { label: `Free time within ${leadTimeHours(p, kase.urgency)}h`, ok: slots.length > 0 },
      { label: 'Not declined this case', ok: !exclude.includes(p.id) },
    ];
    const eligible = checks.every((c) => c.ok);
    return {
      partner_id: p.id,
      name: p.name,
      rating: p.rating,
      reviews: p.reviews,
      eligible,
      checks,
      first_slot: slots[0]?.start ?? null,
      estimate: estimate(p),
    };
  });

  // Rank eligible partners: rating first, then earliest slot.
  const ranked = candidates
    .filter((c) => c.eligible)
    .sort((a, b) => b.rating - a.rating || (a.first_slot ?? '').localeCompare(b.first_slot ?? ''));

  const chosen = ranked[0] ?? null;
  let reason = null;
  if (chosen) {
    const fmt = new Date(chosen.first_slot).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    const what = kase.trade === 'heating' ? `Heating specialist for ${property.heating_label.toLowerCase()}` : `${cap(kase.trade)} specialist`;
    reason = `${what} in ${property.postcode}, rated ${chosen.rating}★ across ${chosen.reviews} jobs, free ${fmt}.`;
    // Mention the best-rated partner we skipped – but only if it does this trade at all.
    const skipped = candidates
      .filter((c) => !c.eligible && c.rating > chosen.rating && c.checks[0].ok)
      .sort((a, b) => b.rating - a.rating)[0];
    if (skipped) {
      reason += ` ${skipped.name} (${skipped.rating}★) was skipped: ${skipped.checks.find((c) => !c.ok).label.toLowerCase()} – no.`;
    }
  }
  return { chosen, reason, candidates: [...ranked, ...candidates.filter((c) => !c.eligible)] };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
