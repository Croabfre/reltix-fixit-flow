import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { API, api, eur, fmtDay, fmtSlot, fmtWhen, usePoll } from '../lib/api';
import { Button, Card, Divider, ErrorNote, H2, H3, KV, Label, Muted, P, Pill, Row, Screen, Small, StatusChip, Timeline, Toggle, useWide } from '../lib/ui';
import { colors, fonts, radius, space, statusTone } from '../lib/theme';

const FIELD_LABELS: Record<string, string> = {
  'property.address': 'Address', 'unit.floor': 'Floor', 'unit.access_notes': 'Access notes', 'property.heating_system': 'Heating system',
  'property.building_year': 'Building year', 'case.summary': 'Problem', 'case.urgency': 'Urgency', 'case.photos': 'Photos',
  'tenant.first_name': 'Tenant first name', 'tenant.phone': 'Tenant phone',
};
const OPEN = (c: any) => c.status !== 'closed';

export default function Centrix() {
  const wide = useWide(980);
  const units = usePoll<any[]>('/units');
  const settings = usePoll<any>('/settings', 10000);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const unit = usePoll<any>(unitId ? `/units/${unitId}` : null);

  // Start on the unit with the newest open case.
  useEffect(() => {
    if (!units.data || unitId) return;
    const active = units.data.find((u) => u.latest_case && u.latest_case.status !== 'closed');
    setUnitId(active?.id ?? 'unit_4b');
  }, [units.data, unitId]);

  const selectUnit = (id: string) => {
    setUnitId(id);
    setCaseId(null);
  };

  const right = (
    <Button
      title="Reset demo"
      size="sm"
      variant="ghost"
      onPress={async () => {
        await api('/demo/reset', 'POST');
        setCaseId(null);
        units.refresh();
        unit.refresh();
      }}
    />
  );

  return (
    <Screen title="Workspace" subtitle="Your portfolio, cases and partners in one record." right={right} maxWidth={1280}>
      <ErrorNote error={units.error} />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space(10), alignItems: 'flex-start' }}>
        <View style={{ width: wide ? 300 : '100%', gap: space(8) }}>
          <Portfolio units={units.data ?? []} selected={unitId} onSelect={selectUnit} />
          {settings.data && (
            <View style={{ gap: space(4) }}>
              <Label>Rules</Label>
              <Small>Every job is approved by a property manager before it goes to a partner. Owner approval above €{settings.data.owner_approval_above_eur}.</Small>
              <Toggle
                value={!!settings.data.ai_triage}
                onChange={async (v) => {
                  await api('/settings', 'PATCH', { ai_triage: v });
                  settings.refresh();
                }}
                label="AI triage"
                sub={
                  settings.data.ai_available
                    ? `${settings.data.ai_provider === 'openai' ? 'OpenAI' : 'Anthropic'} reads reports; keyword rules as fallback.`
                    : 'No API key in server/.env – keyword rules are used.'
                }
              />
            </View>
          )}
        </View>

        <View style={{ flex: 1, gap: space(8), width: wide ? undefined : '100%' }}>
          {!unit.data ? (
            <Muted>Loading…</Muted>
          ) : caseId && unit.data.cases.some((c: any) => c.id === caseId) ? (
            <CaseDetail kase={unit.data.cases.find((c: any) => c.id === caseId)} unit={unit.data} refresh={unit.refresh} back={() => setCaseId(null)} wide={wide} />
          ) : (
            <UnitRecord unit={unit.data} openCase={setCaseId} wide={wide} />
          )}
        </View>
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------- portfolio: city → building → unit

function Portfolio({ units, selected, onSelect }: { units: any[]; selected: string | null; onSelect: (id: string) => void }) {
  const groups = useMemo(() => {
    const byCity = new Map<string, Map<string, { property: any; owner: any; units: any[] }>>();
    for (const u of units) {
      const city = u.property.city;
      if (!byCity.has(city)) byCity.set(city, new Map());
      const props = byCity.get(city)!;
      if (!props.has(u.property.id)) props.set(u.property.id, { property: u.property, owner: u.owner, units: [] });
      props.get(u.property.id)!.units.push(u);
    }
    return [...byCity.entries()].map(([city, props]) => ({ city, buildings: [...props.values()] }));
  }, [units]);

  return (
    <View style={{ gap: space(8) }}>
      {groups.map((g) => (
        <View key={g.city} style={{ gap: space(4) }}>
          <Label>
            {g.city} · {g.buildings.reduce((n, b) => n + b.units.length, 0)} units
          </Label>
          {g.buildings.map((b) => (
            <View key={b.property.id} style={s.building}>
              <View style={{ gap: 2, paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(2) }}>
                <Text style={s.buildingName}>{b.property.street}</Text>
                <Small>
                  {b.owner?.name} · built {b.property.building_year}
                </Small>
              </View>
              {b.units.map((u: any) => {
                const on = u.id === selected;
                const open = u.latest_case && u.latest_case.status !== 'closed';
                return (
                  <Pressable key={u.id} onPress={() => onSelect(u.id)} style={({ hovered }: any) => [s.unitRow, on && s.unitRowOn, hovered && !on && { backgroundColor: colors.sunken }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.unitName, on && { color: '#fff' }]}>{u.label}</Text>
                      <Text style={[s.unitSub, on && { color: 'rgba(255,255,255,0.75)' }]}>{u.tenant?.name ?? 'Vacant'}</Text>
                    </View>
                    {open && <View style={[s.dot, { backgroundColor: on ? '#fff' : (statusTone[u.latest_case.status] ?? statusTone.reported).fg }]} />}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- unit record: facts, case history, documents, log

function UnitRecord({ unit, openCase, wide }: { unit: any; openCase: (id: string) => void; wide: boolean }) {
  const open = unit.cases.filter(OPEN);
  const done = unit.cases.filter((c: any) => !OPEN(c));
  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ gap: 4 }}>
            <H2>{unit.label}</H2>
            <Small>{unit.property.address}</Small>
          </View>
          <Pill>{unit.id}</Pill>
        </Row>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? space(8) : 0 }}>
          <View style={{ flex: 1 }}>
            <KV k="Tenant" v={unit.tenant ? `${unit.tenant.name} · since ${fmtDay(unit.tenant.move_in)}` : 'Vacant'} />
            <KV k="Contact" v={unit.tenant ? `${unit.tenant.phone} · ${unit.tenant.email}` : '—'} />
            <KV k="Owner" v={unit.owner?.name} />
            <KV k="Lease" v={unit.contracts.filter((c: any) => c.type === 'lease').map((c: any) => `€${c.details.rent_cold_eur} cold`).join(', ') || '—'} />
          </View>
          <View style={{ flex: 1 }}>
            <KV k="Size" v={`${unit.size_sqm} m² · ${unit.rooms} rooms · floor ${unit.floor}`} />
            <KV k="Heating" v={`${unit.property.heating_label} · ${unit.property.heating_system.make}`} />
            <KV k="Access" v={unit.access_notes} />
            <KV k="Meters" v={unit.meters.map((m: any) => `${m.type} ${m.number}`).join(', ')} />
          </View>
        </View>
      </Card>

      <View style={{ gap: space(4) }}>
        <Label>Cases</Label>
        {unit.cases.length === 0 && <Muted>No cases on this unit yet. Reports from the tenant portal appear here within seconds.</Muted>}
        {[...open, ...done].map((c: any) => (
          <Pressable key={c.id} onPress={() => openCase(c.id)} style={({ hovered }: any) => [s.caseRow, hovered && { borderColor: colors.borderStrong }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.caseTitle}>{c.title ?? 'Repair request'}</Text>
              <Small>
                {fmtDay(c.created_at)} · {c.trade}
                {c.partner ? ` · ${c.partner.name}` : ''}
                {c.status === 'closed' && c.documents.find((d: any) => d.type === 'invoice') ? ` · ${eur(c.documents.find((d: any) => d.type === 'invoice').amount_eur)}` : ''}
              </Small>
            </View>
            {c.status === 'awaiting_pm_approval' ? <StatusChip status="slot_offered" label="Needs your approval" /> : <StatusChip status={c.status} label={c.status_label} />}
            <Text style={s.chev}>›</Text>
          </Pressable>
        ))}
      </View>

      {unit.documents.length > 0 && (
        <View style={{ gap: space(4) }}>
          <Label>Documents</Label>
          <Card compact style={{ gap: 0 }}>
            {unit.documents.map((d: any, i: number) => (
              <Row key={d.id} style={{ justifyContent: 'space-between', paddingVertical: space(3), borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <P style={{ fontFamily: fonts.medium }}>{d.type === 'invoice' ? `${d.title} · ${d.number}` : d.title}</P>
                  <Small>{d.type === 'invoice' ? `${eur(d.amount_eur)} gross · ${fmtDay(d.issued_at)}` : `${d.note} · ${fmtDay(d.issued_at)}`}</Small>
                </View>
                {d.url ? <Button title="Open" size="sm" variant="secondary" onPress={() => Linking.openURL(API + d.url)} /> : null}
              </Row>
            ))}
          </Card>
        </View>
      )}

      <CommunicationLog unit={unit} />
    </>
  );
}

/** One line per case; press it to see the messages that belong to it. */
function CommunicationLog({ unit }: { unit: any }) {
  const [open, setOpen] = useState<string | null>(null);
  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of unit.messages) {
      const k = m.case_id ?? 'general';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return [...map.entries()].map(([k, msgs]) => {
      const kase = unit.cases.find((c: any) => c.id === k);
      const sorted = msgs.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return { key: k, title: kase?.title ?? 'General', last: sorted[sorted.length - 1], msgs: sorted };
    });
  }, [unit.messages, unit.cases]);

  return (
    <View style={{ gap: space(4) }}>
      <Label>Communication log</Label>
      <Card compact style={{ gap: 0, paddingVertical: space(1) }}>
        {groups.map((g, i) => {
          const isOpen = open === g.key;
          return (
            <View key={g.key} style={{ borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border }}>
              <Pressable onPress={() => setOpen(isOpen ? null : g.key)} style={s.logRow}>
                <Text style={[s.chev, { transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }]}>›</Text>
                <View style={{ flex: 1 }}>
                  <P style={{ fontFamily: fonts.medium }} numberOfLines={1}>{g.title}</P>
                  {!isOpen && <Small numberOfLines={1}>{g.last.text}</Small>}
                </View>
                <Small>{g.msgs.length} · {fmtWhen(g.last.timestamp)}</Small>
              </Pressable>
              {isOpen && (
                <View style={{ paddingLeft: space(8), paddingBottom: space(4), gap: space(3) }}>
                  {g.msgs.map((m: any) => (
                    <View key={m.id} style={{ gap: 2 }}>
                      <Small style={{ fontSize: 12 }}>
                        {m.channel} · {m.from} → {m.to} · {fmtWhen(m.timestamp)}
                      </Small>
                      <P style={{ fontSize: 14 }}>{m.text}</P>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------- one case, opened

function CaseDetail({ kase, unit, refresh, back, wide }: { kase: any; unit: any; refresh: () => void; back: () => void; wide: boolean }) {
  const [err, setErr] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const run = (fn: () => Promise<unknown>) => async () => {
    try {
      setErr(null);
      await fn();
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const chosen = kase.match?.chosen;
  const timeline = kase.timeline
    .filter((e: any) => !e.type.startsWith('job.') || ['job.placed', 'job.scheduled', 'job.result'].includes(e.type))
    .map((e: any) => ({ id: e.id, at: e.timestamp, actor: e.actor, status: e.data?.to, title: eventTitle(e), sub: eventSub(e) }))
    .reverse();
  const invoice = kase.documents.find((d: any) => d.type === 'invoice');

  return (
    <>
      <Pressable onPress={back}>
        <Text style={s.link}>← {unit.label} · all cases</Text>
      </Pressable>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space(8), alignItems: 'flex-start' }}>
        <View style={{ flex: 3, gap: space(8), width: wide ? undefined : '100%' }}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <H2>{kase.title ?? 'Repair request'}</H2>
              <StatusChip status={kase.status} label={kase.status_label} />
            </Row>
            <P style={{ fontSize: 17 }}>“{kase.text}”</P>
            <Row gap={8}>
              {kase.trade && <StatusChip status="triaged" label={kase.trade} />}
              {kase.urgency && <StatusChip status={kase.urgency} label={`${kase.urgency} urgency`} />}
              <Small>
                {fmtWhen(kase.created_at)} · {unit.tenant?.name} · classified by{' '}
                {kase.triage?.source === 'ai' ? `AI (${kase.triage.provider})` : kase.triage?.ai_error ? 'rules (AI call failed)' : 'rules'}
              </Small>
            </Row>
            {kase.triage?.reasons?.length ? <Small>{kase.triage.reasons.join(' · ')}</Small> : null}
            {kase.photos?.length > 0 && (
              <Row>
                {kase.photos.map((p: string, i: number) => (
                  <Image key={i} source={{ uri: p }} style={{ width: 88, height: 88, borderRadius: 10 }} />
                ))}
              </Row>
            )}
          </Card>

          {kase.status === 'awaiting_pm_approval' && chosen && (
            <Card tone="accent">
              <Label style={{ color: colors.accentHover }}>Suggested next step</Label>
              <H2>Book {chosen.name}</H2>
              <P>{kase.match.reason}</P>
              <Row gap={20}>
                <Muted>Estimate {eur(chosen.estimate.gross_eur)} incl. VAT</Muted>
                <Muted>{chosen.estimate.gross_eur > 500 ? 'Owner approval needed' : 'Within owner budget (€500)'}</Muted>
              </Row>
              <Row gap={12}>
                <Button title="Approve & send job" size="lg" onPress={run(() => api(`/cases/${kase.id}/approve`, 'POST', { by: 'PM (you)' }))} />
                <Button title="Handle manually" variant="secondary" size="lg" onPress={run(() => api(`/cases/${kase.id}/escalate`, 'POST', { note: 'PM takes over' }))} />
              </Row>
              <Divider />
              <Small>
                Shared on approval: address, floor, heating system, building year, problem, urgency, photos. The tenant's phone number only after
                the tenant agrees when booking. Never: name, access codes, rent, other tenants.
              </Small>
            </Card>
          )}

          {kase.match && <Candidates match={kase.match} />}

          {kase.job && (
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Label>Job · {kase.partner?.name}</Label>
                <StatusChip status={kase.job.status} />
              </Row>
              <View>
                {kase.slot && <KV k="Appointment" v={fmtSlot(kase.slot)} />}
                {kase.status === 'slot_offered' && kase.offered_slots.length > 0 && <KV k="Offered" v={kase.offered_slots.map(fmtSlot).join('  ·  ')} />}
                <KV k="Shared" v={Object.keys(kase.job.payload.fields).map((f) => FIELD_LABELS[f] ?? f).join(', ')} />
                {kase.job.payload.withheld.length > 0 && <KV k="Withheld" v={kase.job.payload.withheld.map((w: any) => `${w.label} (${w.reason})`).join(', ')} />}
                {kase.job.completion_note && <KV k="Work done" v={kase.job.completion_note} />}
                {invoice && <KV k="Invoice" v={`${invoice.number} · ${eur(invoice.amount_eur)} gross`} />}
                {kase.rating && <KV k="Tenant rating" v={'★'.repeat(kase.rating.stars)} />}
              </View>
              {invoice?.url ? <Button title="Open invoice" variant="secondary" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => Linking.openURL(API + invoice.url)} /> : null}
            </Card>
          )}

          {kase.consents.length > 0 && (
            <Card>
              <Label>Consent</Label>
              {kase.consents.map((c: any) => (
                <View key={c.id} style={{ gap: 2 }}>
                  <P style={{ fontFamily: fonts.medium }}>{c.data_labels.join(', ')} → {c.partner_name}</P>
                  <Small>{c.purpose} · via {c.channel} · {fmtWhen(c.given_at)} · {c.expired_at ? 'expired when the case closed' : 'active until the case closes'}</Small>
                  <Small style={{ fontSize: 12 }}>{c.legal_basis}</Small>
                </View>
              ))}
            </Card>
          )}

          {kase.status !== 'closed' && (
            <Card>
              <Label>Message the tenant</Label>
              <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'flex-end' }}>
                <TextInput
                  value={reply}
                  onChangeText={setReply}
                  placeholder={`Reply to ${unit.tenant?.name?.split(' ')[0] ?? 'the tenant'} in the portal…`}
                  placeholderTextColor={colors.subtle}
                  multiline
                  style={s.replyInput}
                />
                <Button
                  title="Send"
                  disabled={!reply.trim()}
                  onPress={run(async () => {
                    await api(`/cases/${kase.id}/messages`, 'POST', { text: reply, from: 'pm' });
                    setReply('');
                  })}
                />
              </View>
            </Card>
          )}
          <ErrorNote error={err} />
        </View>

        <View style={{ flex: 2, width: wide ? undefined : '100%' }}>
          <Card>
            <Label>Timeline</Label>
            <Timeline items={timeline} />
          </Card>
        </View>
      </View>
    </>
  );
}

function Candidates({ match }: { match: any }) {
  const [open, setOpen] = useState(false);
  return (
    <Card compact>
      <Pressable onPress={() => setOpen(!open)}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>
            Partner matching · {match.candidates.filter((c: any) => c.eligible).length} of {match.candidates.length} eligible
          </Label>
          <Text style={s.link}>{open ? 'Hide' : 'Show why'}</Text>
        </Row>
      </Pressable>
      {open &&
        match.candidates.map((c: any) => (
          <View key={c.partner_id} style={{ gap: 6, opacity: c.eligible ? 1 : 0.65 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <P style={{ fontFamily: fonts.medium }}>
                {match.chosen?.partner_id === c.partner_id ? '→ ' : ''}
                {c.name}
              </P>
              <Small>
                ★ {c.rating} · {eur(c.estimate.gross_eur)}
              </Small>
            </Row>
            <Row gap={6}>
              {c.checks.map((ch: any) => (
                <View key={ch.label} style={{ backgroundColor: ch.ok ? colors.successSoft : colors.dangerSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: ch.ok ? colors.success : colors.danger }}>
                    {ch.ok ? '✓' : '✗'} {ch.label}
                  </Text>
                </View>
              ))}
            </Row>
          </View>
        ))}
    </Card>
  );
}

function eventTitle(e: any): string {
  switch (e.type) {
    case 'case.created': return 'Tenant reported via portal';
    case 'case.status_changed': return e.data.label;
    case 'case.approved': return 'Approved by PM';
    case 'case.message': return e.data.from === 'pm' ? 'PM messaged tenant' : 'Tenant sent a message';
    case 'job.placed': return `Job placed with ${e.data.partner}`;
    case 'consent.given': return `Consent given to ${e.data.partner}`;
    case 'job.scheduled': return 'Appointment booked';
    case 'job.result': return 'Invoice & report received';
    case 'case.rated': return `Tenant rated ${'★'.repeat(e.data.stars)}`;
    default: return e.type;
  }
}

function eventSub(e: any): string | null {
  switch (e.type) {
    case 'case.created': return `“${e.data.text}”`;
    case 'case.status_changed': return e.data.note ?? null;
    case 'job.placed': return `${e.data.fields.length} fields shared${e.data.withheld.length ? `, ${e.data.withheld.length} withheld` : ''}`;
    case 'consent.given': return e.data.fields.join(', ');
    case 'job.scheduled': return e.data.slot;
    case 'job.result': return `${eur(e.data.amount_eur)} gross`;
    case 'case.approved': return e.data.estimate ? `Estimate ${eur(e.data.estimate.gross_eur)}` : null;
    default: return null;
  }
}

const s = StyleSheet.create({
  building: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingBottom: space(2), overflow: 'hidden' },
  buildingName: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, letterSpacing: -0.5 },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginHorizontal: space(2), paddingHorizontal: space(2), paddingVertical: space(2), borderRadius: 10 },
  unitRowOn: { backgroundColor: colors.primary },
  unitName: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  unitSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  dot: { width: 8, height: 8, borderRadius: 4 },
  caseRow: {
    flexDirection: 'row', alignItems: 'center', gap: space(4), padding: space(5), borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  caseTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, letterSpacing: -0.6 },
  chev: { fontFamily: fonts.body, fontSize: 22, color: colors.subtle, width: 14, textAlign: 'center' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  link: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },
  replyInput: {
    flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: fonts.body, fontSize: 15, color: colors.text, outlineStyle: 'none',
  } as any,
});
