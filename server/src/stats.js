// Numbers for the centrix Insights dashboard. Everything is computed from the
// live records on each request, so the page is real time by polling.
import { STATUS_LABELS } from './flow.js';

const DAY = 864e5;
const localDate = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const URGENT = new Set(['emergency', 'high']);

export function buildStats(db, { city = 'all', weeks = 26 } = {}) {
  const now = Date.now();
  const unitCity = new Map();
  for (const u of db.units) unitCity.set(u.id, db.properties.find((p) => p.id === u.property_id)?.city);
  const inScope = (c) => city === 'all' || unitCity.get(c.unit_id) === city;
  const cases = db.cases.filter(inScope);
  const open = cases.filter((c) => c.status !== 'closed');
  const resolved = cases.filter((c) => c.resolved_at);
  const t = (iso) => new Date(iso).getTime();

  // ---- headline numbers
  const last7 = now - 7 * DAY;
  const prev7 = now - 14 * DAY;
  const days90 = resolved.filter((c) => t(c.resolved_at) > now - 90 * DAY).map((c) => (t(c.resolved_at) - t(c.created_at)) / DAY).sort((a, b) => a - b);
  const median = days90.length ? days90[Math.floor(days90.length / 2)] : null;
  const kpis = {
    open: open.length,
    urgent_open: open.filter((c) => URGENT.has(c.urgency)).length,
    awaiting_pm: open.filter((c) => c.status === 'awaiting_pm_approval' || c.status === 'escalated' || c.needs_pm_reply).length,
    new_7d: cases.filter((c) => t(c.created_at) > last7).length,
    new_prev_7d: cases.filter((c) => t(c.created_at) > prev7 && t(c.created_at) <= last7).length,
    resolved_7d: resolved.filter((c) => t(c.resolved_at) > last7).length,
    median_days_to_resolve: median != null ? Math.round(median * 10) / 10 : null,
  };

  // ---- weekly history: open at week end, new and resolved per week
  const weekStart = (() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
    return d.getTime();
  })();
  const series = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = weekStart - i * 7 * DAY;
    const to = Math.min(from + 7 * DAY, now);
    series.push({
      week: localDate(from), // Monday, in local time (toISOString would shift it to Sunday)
      open: cases.filter((c) => t(c.created_at) <= to && (!c.resolved_at || t(c.resolved_at) > to)).length,
      new: cases.filter((c) => t(c.created_at) >= from && t(c.created_at) < to).length,
      resolved: resolved.filter((c) => t(c.resolved_at) >= from && t(c.resolved_at) < to).length,
    });
  }

  // ---- by city (always all cities, so the comparison stays visible)
  const cities = [...new Set(db.properties.map((p) => p.city))];
  const byCity = cities
    .map((name) => {
      const cc = db.cases.filter((c) => unitCity.get(c.unit_id) === name);
      const oo = cc.filter((c) => c.status !== 'closed');
      return {
        city: name,
        units: db.units.filter((u) => unitCity.get(u.id) === name).length,
        open: oo.length,
        urgent: oo.filter((c) => URGENT.has(c.urgency)).length,
        routine: oo.filter((c) => !URGENT.has(c.urgency)).length,
        last_90d: cc.filter((c) => t(c.created_at) > now - 90 * DAY).length,
      };
    })
    .sort((a, b) => b.open - a.open || b.last_90d - a.last_90d);

  const byUrgency = ['emergency', 'high', 'normal', 'low'].map((u) => ({ urgency: u, open: open.filter((c) => c.urgency === u).length }));
  const byTrade = [...new Set(cases.map((c) => c.trade))].map((tr) => ({ trade: tr, open: open.filter((c) => c.trade === tr).length, last_90d: cases.filter((c) => c.trade === tr && t(c.created_at) > now - 90 * DAY).length })).sort((a, b) => b.last_90d - a.last_90d);
  const byStatus = Object.entries(open.reduce((m, c) => ((m[c.status] = (m[c.status] ?? 0) + 1), m), {})).map(([status, n]) => ({ status, label: STATUS_LABELS[status], open: n })).sort((a, b) => b.open - a.open);

  // ---- partners: workload and changes
  const partners = db.partners.map((p) => {
    const mine = cases.filter((c) => c.partner_id === p.id);
    const recent = mine.filter((c) => t(c.created_at) > now - 90 * DAY);
    const declines = db.events.filter((e) => e.type === 'case.status_changed' && e.data?.to === 'partner_declined' && (e.data.partner_id === p.id || e.actor === p.name) && t(e.timestamp) > now - 90 * DAY).length
      + db.jobs.filter((j) => j.partner_id === p.id && j.status === 'declined' && j.declined_at && t(j.declined_at) > now - 90 * DAY && !db.events.some((e) => e.case_id === j.case_id && e.data?.to === 'partner_declined')).length;
    const done = recent.filter((c) => c.resolved_at);
    const avg = done.length ? done.reduce((s, c) => s + (t(c.resolved_at) - t(c.created_at)) / DAY, 0) / done.length : null;
    const before = p.rating_history?.[0]?.rating ?? p.rating;
    return {
      id: p.id, name: p.name, trades: p.trades, joined_at: p.joined_at,
      jobs_90d: recent.length, open: mine.filter((c) => c.status !== 'closed').length, declined_90d: declines,
      avg_days: avg != null ? Math.round(avg * 10) / 10 : null,
      rating: p.rating, rating_change_90d: Math.round((p.rating - before) * 10) / 10,
    };
  }).sort((a, b) => b.jobs_90d - a.jobs_90d);

  const changes = [];
  for (const p of db.partners) {
    if (p.joined_at && t(p.joined_at) > now - 180 * DAY) changes.push({ at: p.joined_at, kind: 'joined', text: `${p.name} joined the network`, partner: p.name });
  }
  for (const e of db.events) {
    if (e.type === 'case.status_changed' && e.data?.to === 'partner_declined' && t(e.timestamp) > now - 60 * DAY) {
      const kase = db.cases.find((c) => c.id === e.case_id);
      if (!kase || !inScope(kase)) continue;
      const next = db.partners.find((p) => p.id === kase.partner_id);
      changes.push({ at: e.timestamp, kind: 'reassigned', text: `${e.actor} declined “${kase.title}” (${e.data.note ?? 'no reason'})${next ? ` → ${next.name}` : ''}`, partner: e.actor, case_id: kase.id, unit_id: kase.unit_id });
    }
  }
  for (const p of partners) if (Math.abs(p.rating_change_90d) >= 0.1) changes.push({ at: new Date(now).toISOString(), kind: p.rating_change_90d > 0 ? 'rating_up' : 'rating_down', text: `${p.name} rating ${p.rating_change_90d > 0 ? 'up' : 'down'} ${Math.abs(p.rating_change_90d)} to ${p.rating}★ (90 days)`, partner: p.name });
  changes.sort((a, b) => b.at.localeCompare(a.at));

  // ---- upcoming deadlines (next 120 days)
  const horizon = now + 120 * DAY;
  const deadlines = [];
  const propOk = (p) => city === 'all' || p.city === city;
  const addD = (d) => {
    const ms = t(d.due);
    if (ms >= now - DAY && ms <= horizon) deadlines.push({ ...d, days_left: Math.ceil((ms - now) / DAY) });
  };
  for (const ct of db.contracts) {
    if (ct.type === 'lease' && ct.details.end && t(ct.details.end) >= now - DAY) {
      const unit = db.units.find((u) => u.id === ct.unit_id);
      const p = db.properties.find((x) => x.id === unit?.property_id);
      if (!p || !propOk(p)) continue;
      const tenant = db.contacts.find((c) => c.id === ct.details.tenant_contact_id);
      addD({ kind: 'lease_end', label: 'Lease ends', title: `${tenant?.name ?? 'Tenant'} moves out`, where: `${unit.label} · ${p.street}`, city: p.city, due: ct.details.end, note: ct.details.end_reason ?? 'Plan handover and re-letting', unit_id: unit.id });
    }
    if (ct.type === 'service' && ct.details.renews_on) {
      const p = db.properties.find((x) => x.id === ct.property_id);
      if (!p || !propOk(p)) continue;
      const noticeBy = new Date(t(ct.details.renews_on) - (ct.details.notice_days ?? 0) * DAY).toISOString().slice(0, 10);
      addD({ kind: 'service_contract', label: ct.details.notice_days ? 'Notice deadline' : 'Renews', title: `${ct.details.service} – ${ct.details.provider}`, where: p.street, city: p.city, due: ct.details.notice_days ? noticeBy : ct.details.renews_on, note: ct.details.notice_days ? `Renews ${ct.details.renews_on} unless cancelled · €${ct.details.annual_eur}/year` : `€${ct.details.annual_eur}/year`, unit_id: db.units.find((u) => u.property_id === p.id)?.id });
    }
  }
  for (const p of db.properties.filter(propOk)) {
    if (p.energy_certificate?.valid_until) addD({ kind: 'certificate', label: 'Certificate expires', title: `Energy certificate (class ${p.energy_certificate.class})`, where: p.street, city: p.city, due: p.energy_certificate.valid_until, note: 'Order a new one before re-letting', unit_id: db.units.find((u) => u.property_id === p.id)?.id });
    if (p.heating_system?.last_service) {
      const due = new Date(t(p.heating_system.last_service) + 365 * DAY).toISOString().slice(0, 10);
      addD({ kind: 'maintenance', label: 'Heating service due', title: `Annual heating service – ${p.heating_system.make}`, where: p.street, city: p.city, due, note: `Last service ${p.heating_system.last_service}`, unit_id: db.units.find((u) => u.property_id === p.id)?.id });
    }
  }
  deadlines.sort((a, b) => a.due.localeCompare(b.due));

  return {
    generated_at: new Date(now).toISOString(),
    scope: { city, weeks },
    cities,
    kpis,
    series,
    by_city: byCity,
    by_urgency: byUrgency,
    by_trade: byTrade,
    by_status: byStatus,
    partners,
    partner_changes: changes.slice(0, 7),
    deadlines: { total: deadlines.length, next_30d: deadlines.filter((d) => d.days_left <= 30).length, items: deadlines.slice(0, 40) },
  };
}
