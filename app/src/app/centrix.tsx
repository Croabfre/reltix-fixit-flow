import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API, api, eur, fmtDay, fmtSlot, fmtWhen, usePoll } from '../lib/api';
import { Button, Card, Display, Divider, ErrorNote, H2, H3, KV, Label, Muted, P, Pill, Row, Small, StatusChip, Timeline, Toggle, useWide, VersionFooter } from '../lib/ui';
import { colors, fonts, layout, radius, shadow, space, statusTone } from '../lib/theme';
import Insights from '../lib/insights';

const FIELD_LABELS: Record<string, string> = {
  'property.address': 'Address', 'unit.floor': 'Floor', 'unit.access_notes': 'Access notes', 'property.heating_system': 'Heating system',
  'property.building_year': 'Building year', 'case.summary': 'Problem', 'case.urgency': 'Urgency', 'case.photos': 'Photos',
  'tenant.first_name': 'Tenant first name', 'tenant.phone': 'Tenant phone',
};
const OPEN = (c: any) => c.status !== 'closed';

type Route = { name: 'search' } | { name: 'unit'; unitId: string; caseId?: string | null } | { name: 'settings' } | { name: 'insights' };

export default function Centrix() {
  const wide = useWide(980);
  const [route, setRoute] = useState<Route>({ name: 'search' });
  // Search state lives here, so going back from a unit returns to the same results.
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ type: 'all', city: 'all', status: 'all' });
  const openUnit = (unitId: string, caseId?: string | null) => setRoute({ name: 'unit', unitId, caseId: caseId ?? null });

  return (
    <SafeAreaView style={s.page} edges={['top', 'left', 'right']}>
      <View style={s.nav}>
        <View style={s.navInner}>
          <Pressable onPress={() => setRoute({ name: 'search' })} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={s.brand}>centrix</Text>
            <Text style={s.brandSub}>Workspace · demo</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <NavBtn label="Search" on={route.name === 'search' || route.name === 'unit'} onPress={() => setRoute({ name: 'search' })} />
            <NavBtn label="Insights" on={route.name === 'insights'} onPress={() => setRoute({ name: 'insights' })} />
            <NavBtn label="Settings" on={route.name === 'settings'} onPress={() => setRoute({ name: 'settings' })} />
            <Button
              title="Reset demo"
              size="sm"
              variant="ghost"
              onPress={async () => {
                await api('/demo/reset', 'POST');
                setRoute({ name: 'search' });
              }}
            />
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: space(24) }} keyboardShouldPersistTaps="handled">
        {route.name === 'search' && <SearchHome query={query} setQuery={setQuery} filters={filters} setFilters={setFilters} openUnit={openUnit} />}
        {route.name === 'settings' && <Settings />}
        {route.name === 'insights' && <Insights openUnit={(unitId) => openUnit(unitId, null)} />}
        {route.name === 'unit' && (
          <View style={[s.column, { maxWidth: 1240, paddingTop: space(8), gap: space(8) }]}>
            <UnitPage
              unitId={route.unitId}
              caseId={route.caseId ?? null}
              setCase={(caseId) => setRoute({ name: 'unit', unitId: route.unitId, caseId })}
              back={() => setRoute({ name: 'search' })}
              wide={wide}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NavBtn({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }: any) => [s.navBtn, (on || hovered) && { backgroundColor: colors.sunken }]}>
      <Text style={s.navBtnText}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------- search: the start page

const TYPE_OPTIONS = [
  ['all', 'Everything'],
  ['units', 'Units'],
  ['buildings', 'Buildings'],
  ['people', 'People'],
  ['cases', 'Cases'],
];
const STATUS_OPTIONS = [
  ['all', 'Any'],
  ['open', 'Open case'],
  ['none', 'No open case'],
];

function SearchHome({
  query, setQuery, filters, setFilters, openUnit,
}: {
  query: string;
  setQuery: (q: string) => void;
  filters: { type: string; city: string; status: string };
  setFilters: (f: { type: string; city: string; status: string }) => void;
  openUnit: (unitId: string, caseId?: string | null) => void;
}) {
  const wide = useWide(720);
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);
  const qs = new URLSearchParams({ q: debounced, ...filters }).toString();
  const { data, error, refresh } = usePoll<any>(`/search?${qs}`, 4000);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<any>(null);
  const cityOptions = [['all', 'All cities'], ...((data?.cities ?? []) as string[]).map((c) => [c, c])];

  // Plain matches waiting on a yes/no – the repetitive case at scale. Escalations,
  // service leads and tenant replies always need a person to read them first.
  const routine = (c: any) => c.status === 'awaiting_pm_approval' && !c.needs_reply && !c.reason;
  const quickApprove = async (id: string) => {
    setBusy(id);
    try {
      await api(`/cases/${id}/approve`, 'POST', {});
      refresh();
    } finally {
      setBusy(null);
    }
  };
  const approveAll = async () => {
    const ids = (data?.needs_approval ?? []).filter(routine).map((c: any) => c.id);
    setBusy('all');
    try {
      for (const id of ids) await api(`/cases/${id}/approve`, 'POST', {});
      refresh();
    } finally {
      setBusy(null);
    }
  };
  const routineCount = (data?.needs_approval ?? []).filter(routine).length;

  const sections = data
    ? [
        data.units && { key: 'units', title: 'Units', total: data.units.total, rows: data.units.items.map((u: any) => ({ id: u.id, title: `${u.label} · ${u.street}`, sub: u.tenant ?? 'Vacant', right: u.city, chip: u.open_case, onPress: () => openUnit(u.id, null) })) },
        data.buildings && { key: 'buildings', title: 'Buildings', total: data.buildings.total, rows: data.buildings.items.map((b: any) => ({ id: b.id, title: `${b.street}, ${b.postcode} ${b.city}`, sub: `${b.owner} · ${b.units} units`, right: b.city, onPress: () => openUnit(b.first_unit, null) })) },
        data.people && { key: 'people', title: 'People', total: data.people.total, rows: data.people.items.map((c: any) => ({ id: c.id, title: c.name, sub: `${c.role === 'former_tenant' ? `Former tenant (until ${c.move_out})` : c.role === 'owner' ? 'Owner' : 'Tenant'} · ${c.where}`, right: c.city, onPress: () => c.unit_id && openUnit(c.unit_id, null) })) },
        data.cases && { key: 'cases', title: 'Cases', total: data.cases.total, rows: data.cases.items.map((k: any) => ({ id: k.id, title: k.title ?? 'Repair request', sub: `${k.where} · ${fmtDay(k.created_at)}`, right: k.city, chip: { status: k.status, status_label: k.status_label }, onPress: () => openUnit(k.unit_id, k.id) })) },
      ].filter((x: any) => x && (x.total > 0 || query))
    : [];

  return (
    <View style={[s.column, { maxWidth: 860, paddingTop: wide ? space(20) : space(10), gap: space(8) }]}>
      <Display>What are you looking for?</Display>

      {data?.needs_approval?.length > 0 && (
        <View style={{ gap: space(2) }}>
          {routineCount > 1 && (
            <Row style={{ justifyContent: 'space-between', paddingHorizontal: space(1) }}>
              <Small>{routineCount} routine matches are just waiting on a yes.</Small>
              <Button title={`Approve all ${routineCount}`} size="sm" variant="secondary" disabled={busy === 'all'} onPress={approveAll} />
            </Row>
          )}
          {data.needs_approval.map((c: any) => (
            <View key={c.id} style={[s.notice, { paddingVertical: space(3) }]}>
              <Pressable onPress={() => openUnit(c.unit_id, c.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
                <View style={[s.dot, { backgroundColor: colors.accent }]} />
                <Text style={s.noticeText}>
                  {c.reason?.startsWith('Service lead') ? c.reason : c.needs_reply ? 'Tenant is waiting for your reply' : c.status === 'escalated' ? 'Needs a partner picked by hand' : 'Needs your approval'}: <Text style={{ fontFamily: fonts.semibold }}>{c.title ?? 'Repair request'}</Text>
                </Text>
              </Pressable>
              {routine(c) && <Button title="Approve" size="sm" disabled={busy === c.id} onPress={() => quickApprove(c.id)} />}
              <Pressable onPress={() => openUnit(c.unit_id, c.id)} hitSlop={8}>
                <Text style={s.chev}>›</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={s.searchCard}>
        <View style={s.searchRow}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            ref={input}
            value={query}
            onChangeText={setQuery}
            placeholder="Type a street, tenant, owner or problem…"
            placeholderTextColor={colors.subtle}
            style={s.searchInput}
            autoFocus
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Text style={s.clear}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={s.filterRow}>
          <Dropdown label="Show" value={filters.type} options={TYPE_OPTIONS} open={menu === 'type'} toggle={() => setMenu(menu === 'type' ? null : 'type')} onPick={(v) => { setFilters({ ...filters, type: v }); setMenu(null); }} />
          <Dropdown label="City" value={filters.city} options={cityOptions} open={menu === 'city'} toggle={() => setMenu(menu === 'city' ? null : 'city')} onPick={(v) => { setFilters({ ...filters, city: v }); setMenu(null); }} />
          <Dropdown label="Cases" value={filters.status} options={STATUS_OPTIONS} open={menu === 'status'} toggle={() => setMenu(menu === 'status' ? null : 'status')} onPick={(v) => { setFilters({ ...filters, status: v }); setMenu(null); }} />
        </View>
        <View style={{ paddingVertical: space(3) }}>
          <ErrorNote error={error} />
          {data && sections.length === 0 && <Muted style={{ paddingHorizontal: space(6), paddingVertical: space(4) }}>Nothing found for “{query}”.</Muted>}
          {sections.map((sec: any) => (
            <View key={sec.key} style={{ paddingTop: space(3) }}>
              <Label style={{ paddingHorizontal: space(6), paddingBottom: space(2) }}>
                {sec.title} · {sec.total}
              </Label>
              {sec.rows.length === 0 && <Small style={{ paddingHorizontal: space(6) }}>No matches.</Small>}
              {sec.rows.map((r: any) => (
                <Pressable key={r.id} onPress={r.onPress} style={({ hovered }: any) => [s.result, hovered && { backgroundColor: colors.section }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.resultTitle} numberOfLines={1}>{r.title}</Text>
                    <Small numberOfLines={1}>{r.sub}</Small>
                  </View>
                  {r.chip ? <StatusChip status={r.chip.status} label={r.chip.status_label} /> : <Small>{r.right}</Small>}
                </Pressable>
              ))}
              {sec.total > sec.rows.length && <Small style={{ paddingHorizontal: space(6), paddingTop: space(2) }}>+ {sec.total - sec.rows.length} more – refine the search</Small>}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Dropdown({ label, value, options, open, toggle, onPick }: { label: string; value: string; options: string[][]; open: boolean; toggle: () => void; onPick: (v: string) => void }) {
  const current = options.find(([v]) => v === value)?.[1];
  const active = value !== 'all';
  return (
    <View style={{ position: 'relative', zIndex: open ? 20 : 1 }}>
      <Pressable onPress={toggle} style={({ hovered }: any) => [s.chipBtn, (active || hovered) && { borderColor: colors.ink }, active && { backgroundColor: colors.primarySoft }]}>
        <Text style={s.chipBtnText}>
          {label}
          {active ? `: ${current}` : ''} ▾
        </Text>
      </Pressable>
      {open && (
        <View style={s.menu}>
          {options.map(([v, l]) => (
            <Pressable key={v} onPress={() => onPick(v)} style={({ hovered }: any) => [s.menuItem, (hovered || v === value) && { backgroundColor: colors.sunken }]}>
              <Text style={[s.menuText, v === value && { fontFamily: fonts.semibold }]}>{l}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- settings

function Settings() {
  const settings = usePoll<any>('/settings', 10000);
  return (
    <View style={[s.column, { maxWidth: 760, paddingTop: space(14), gap: space(8) }]}>
      <Display>Settings</Display>
      {settings.data && (
        <Card>
          <Label>Rules</Label>
          <P>By default every job is approved by a property manager before it goes to a partner. Owner sign-off is always needed above €{settings.data.owner_approval_above_eur}, whatever else is set.</P>
          <Toggle
            value={!!settings.data.ai_triage}
            onChange={async (v) => {
              await api('/settings', 'PATCH', { ai_triage: v });
              settings.refresh();
            }}
            label="AI triage and tenant assistant"
            sub={
              settings.data.ai_available
                ? `${settings.data.ai_provider === 'openai' ? 'OpenAI' : 'Anthropic'} classifies reports and answers tenant questions; rules as fallback.`
                : 'No API key in server/.env – keyword rules are used and questions go to the property manager.'
            }
          />
          <Divider />
          <Toggle
            value={settings.data.auto_approve_below_eur != null}
            onChange={async (v) => {
              await api('/settings', 'PATCH', { auto_approve_below_eur: v ? 150 : null });
              settings.refresh();
            }}
            label="Auto-approve routine jobs under €150"
            sub="Off by default. Only non-emergency jobs with a correctly matched partner go straight out – nothing above the owner's budget line, and every one is still logged with 'Auto-approved' in the timeline so it can be reviewed afterwards."
          />
        </Card>
      )}
      <VersionFooter label="centrix Workspace" />
    </View>
  );
}

// ---------------------------------------------------------------- unit page

function UnitPage({ unitId, caseId, setCase, back, wide }: { unitId: string; caseId: string | null; setCase: (id: string | null) => void; back: () => void; wide: boolean }) {
  const unit = usePoll<any>(`/units/${unitId}`);
  if (!unit.data) return <Muted>Loading…</Muted>;
  const kase = caseId ? unit.data.cases.find((c: any) => c.id === caseId) : null;
  if (kase) return <CaseDetail kase={kase} unit={unit.data} refresh={unit.refresh} back={() => setCase(null)} wide={wide} />;
  return <UnitRecord unit={unit.data} openCase={setCase} refresh={unit.refresh} back={back} wide={wide} />;
}

const DOC_ORDER: Record<string, number> = { lease: 0, handover: 1, energy_certificate: 2 };

function UnitRecord({ unit, openCase, refresh, back, wide }: { unit: any; openCase: (id: string) => void; refresh: () => void; back: () => void; wide: boolean }) {
  const [moving, setMoving] = useState(false);
  const docs = unit.documents.slice().sort((a: any, b: any) => (a.status === 'ended' ? 1 : 0) - (b.status === 'ended' ? 1 : 0) || (DOC_ORDER[a.type] ?? 9) - (DOC_ORDER[b.type] ?? 9));
  const current = docs.filter((d: any) => d.status !== 'ended');
  const ended = docs.filter((d: any) => d.status === 'ended');
  const open = unit.cases.filter(OPEN);
  const done = unit.cases.filter((c: any) => !OPEN(c));

  return (
    <>
      <Pressable onPress={back}>
        <Text style={s.link}>← Search</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space(4), flexWrap: 'wrap' }}>
        <View style={{ gap: space(2) }}>
          <Display>{unit.label}</Display>
          <Muted style={{ fontSize: 17 }}>
            {unit.property.address} · owner {unit.owner?.name}
          </Muted>
        </View>
        <Row gap={10}>
          <Pill>{unit.id}</Pill>
          <Button title={unit.tenant ? 'Change tenant' : 'Add tenant'} variant="secondary" size="sm" onPress={() => setMoving(!moving)} />
        </Row>
      </View>

      {moving && <ChangeTenant unit={unit} done={() => { setMoving(false); refresh(); }} />}

      {/* the unit's file comes first: contracts and papers */}
      <View style={{ gap: space(3) }}>
        <Label>Unit file</Label>
        <Card compact style={{ gap: 0, paddingVertical: space(1) }}>
          {current.map((d: any, i: number) => <DocRow key={d.id} d={d} first={i === 0} />)}
          {current.length === 0 && <Small style={{ paddingVertical: space(3) }}>No documents yet.</Small>}
        </Card>
        {ended.length > 0 && (
          <Collapsible title={`Earlier tenancies · ${ended.length} documents`}>
            <Card compact style={{ gap: 0, paddingVertical: space(1), opacity: 0.75 }}>
              {ended.map((d: any, i: number) => <DocRow key={d.id} d={d} first={i === 0} />)}
            </Card>
          </Collapsible>
        )}
      </View>

      <Card>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? space(8) : 0 }}>
          <View style={{ flex: 1 }}>
            <KV k="Tenant" v={unit.tenant ? `${unit.tenant.name} · since ${fmtDay(unit.tenant.move_in)}` : 'Vacant'} />
            <KV k="Contact" v={(unit.tenant && [unit.tenant.phone, unit.tenant.email].filter(Boolean).join(' · ')) || '—'} />
            <KV k="Lease" v={unit.contracts.filter((c: any) => c.type === 'lease' && !c.details.end).map((c: any) => (c.details.rent_cold_eur ? `€${c.details.rent_cold_eur} cold` : 'active')).join(', ') || '—'} />
            <KV k="Before" v={unit.tenancies.filter((t: any) => t.role === 'former_tenant').map((t: any) => `${t.name} (${t.move_in?.slice(0, 4)}–${t.move_out?.slice(0, 4)})`).join(', ') || '—'} />
          </View>
          <View style={{ flex: 1 }}>
            <KV k="Size" v={`${unit.size_sqm} m² · ${unit.rooms} rooms · floor ${unit.floor}`} />
            <KV k="Heating" v={`${unit.property.heating_label} · ${unit.property.heating_system.make}`} />
            <KV k="Access" v={unit.access_notes} />
            <KV k="Meters" v={unit.meters.map((m: any) => `${m.type} ${m.number}`).join(', ')} />
          </View>
        </View>
      </Card>

      {/* history: cases, each with its invoice */}
      <View style={{ gap: space(3) }}>
        <Label>Cases and history</Label>
        {unit.cases.length === 0 && <Muted>No cases on this unit yet. Reports from the tenant portal appear here within seconds.</Muted>}
        {[...open, ...done].map((c: any) => {
          const inv = c.documents.find((d: any) => d.type === 'invoice');
          const reporter = unit.tenancies.find((t: any) => t.id === c.reporter_contact_id);
          return (
            <Pressable key={c.id} onPress={() => openCase(c.id)} style={({ hovered }: any) => [s.caseRow, hovered && { borderColor: colors.borderStrong }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.caseTitle}>{c.title ?? 'Repair request'}</Text>
                <Small>
                  {fmtDay(c.created_at)} · {c.trade}
                  {c.partner ? ` · ${c.partner.name}` : ''}
                  {inv ? ` · invoice ${inv.number} ${eur(inv.amount_eur)}` : ''}
                  {reporter && reporter.role === 'former_tenant' ? ` · reported by ${reporter.name} (former tenant)` : ''}
                </Small>
              </View>
              {c.needs_pm_reply ? (
                <StatusChip status="slot_offered" label="Reply needed" />
              ) : c.status === 'awaiting_pm_approval' ? (
                <StatusChip status="slot_offered" label="Needs your approval" />
              ) : (
                <StatusChip status={c.status} label={c.status_label} />
              )}
              <Text style={s.chev}>›</Text>
            </Pressable>
          );
        })}
      </View>

      <CommunicationLog unit={unit} />
    </>
  );
}

function DocRow({ d, first }: { d: any; first: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: space(3), borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
      <View style={{ flex: 1 }}>
        <P style={{ fontFamily: fonts.medium }}>{d.title}</P>
        <Small>
          {d.type === 'lease' ? 'Lease' : d.type === 'handover' ? 'Handover protocol' : d.type === 'energy_certificate' ? 'Building' : d.type} · {fmtDay(d.issued_at)}
          {d.status === 'ended' ? ' · ended' : ''}
        </Small>
      </View>
      {d.url ? <Button title="Open" size="sm" variant="secondary" onPress={() => Linking.openURL(API + d.url)} /> : null}
    </Row>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space(2) }}>
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[s.chev, { transform: [{ rotate: open ? '90deg' : '0deg' }] }]}>›</Text>
        <Small style={{ fontFamily: fonts.medium, color: colors.ink }}>{title}</Small>
      </Pressable>
      {open && children}
    </View>
  );
}

function nextFirstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 12).toISOString().slice(0, 10);
}

/** Move-out / move-in. What centrix does is spelled out, so the PM knows nothing gets lost. */
function ChangeTenant({ unit, done }: { unit: any; done: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', move_in: nextFirstOfMonth() });
  const [err, setErr] = useState<string | null>(null);
  const field = (k: keyof typeof form, placeholder: string) => (
    <TextInput value={form[k]} onChangeText={(v) => setForm({ ...form, [k]: v })} placeholder={placeholder} placeholderTextColor={colors.subtle} style={s.input} />
  );
  return (
    <Card tone="accent">
      <Label>{unit.tenant ? `Change tenant · ${unit.tenant.name} moves out` : 'New tenant'}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        <View style={{ flexBasis: 240, flexGrow: 1 }}>{field('name', 'New tenant name')}</View>
        <View style={{ flexBasis: 160, flexGrow: 1 }}>{field('move_in', 'Move-in YYYY-MM-DD')}</View>
        <View style={{ flexBasis: 240, flexGrow: 1 }}>{field('email', 'Email')}</View>
        <View style={{ flexBasis: 160, flexGrow: 1 }}>{field('phone', 'Phone')}</View>
      </View>
      <Small>
        centrix ends the current lease the day before, revokes everything the old tenant shared with partners, files a new lease and sends the new
        tenant a portal invite. Cases, invoices and documents stay on the unit; the old tenant keeps read access to their own requests for 6 months.
      </Small>
      <Row gap={12}>
        <Button
          title="Confirm tenant change"
          onPress={async () => {
            try {
              await api(`/units/${unit.id}/tenancy`, 'POST', form);
              done();
            } catch (e: any) {
              setErr(e.message);
            }
          }}
        />
      </Row>
      <ErrorNote error={err} />
    </Card>
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
        <Text style={s.link}>← {unit.label} · unit file</Text>
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

          {(kase.status === 'escalated' || (kase.status === 'awaiting_pm_approval' && !chosen)) && !kase.job && (
            <AssignByHand kase={kase} run={run} />
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
              <Row style={{ justifyContent: 'space-between' }}>
                <Label>Message the tenant</Label>
                {kase.needs_pm_reply ? <StatusChip status="slot_offered" label={kase.handover_reason ? `Handed over: ${kase.handover_reason}` : 'Assistant handed over – reply needed'} /> : null}
              </Row>
              {kase.status === 'service_request' && (
                <Small>
                  Service request ({kase.service_category ?? 'other'}) – the assistant answered with partner offers. Close it once the offer is sent or the question is answered.
                </Small>
              )}
              <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'flex-end' }}>
                <TextInput
                  value={reply}
                  onChangeText={setReply}
                  placeholder={`Reply to ${unit.tenant?.name?.split(' ')[0] ?? 'the tenant'} in the portal…`}
                  placeholderTextColor={colors.subtle}
                  multiline
                  style={s.replyInput}
                />
                {kase.status === 'service_request' && (
                  <Button title="Mark done" variant="secondary" onPress={run(() => api(`/cases/${kase.id}/close`, 'POST', {}))} />
                )}
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

function AssignByHand({ kase, run }: { kase: any; run: (fn: () => Promise<unknown>) => () => Promise<void> }) {
  const partners = usePoll<any[]>('/partners', 30000);
  return (
    <Card tone="accent">
      <Label>No partner matched automatically</Label>
      <P>Pick one by hand – this approves the job and sends it straight away.</P>
      {(partners.data ?? []).map((p) => {
        const fits = p.trades.includes(kase.trade);
        return (
          <Row key={p.id} style={{ justifyContent: 'space-between', paddingVertical: space(2), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <P style={{ fontFamily: fonts.medium }}>{p.name}</P>
              <Small>
                {p.trades.join(', ')} · ★ {p.rating} · {p.postcodes.slice(0, 3).join(', ')}
                {p.postcodes.length > 3 ? '…' : ''}
              </Small>
            </View>
            <Button title={fits ? 'Send job' : 'Send anyway'} size="sm" variant={fits ? 'primary' : 'secondary'} onPress={run(() => api(`/cases/${kase.id}/assign`, 'POST', { partner_id: p.id, by: 'PM (you)' }))} />
          </Row>
        );
      })}
    </Card>
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
    case 'case.approved': return e.data.by === 'Auto-approval rule' ? 'Auto-approved (under the rule)' : 'Approved by PM';
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
  page: { flex: 1, backgroundColor: colors.background },
  column: { width: '100%', alignSelf: 'center', paddingHorizontal: layout.gutter },
  nav: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong, backgroundColor: colors.background, zIndex: 10 },
  navInner: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: layout.gutter, height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, letterSpacing: -0.8 },
  brandSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  navBtn: { height: 38, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center' },
  navBtnText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  searchCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow, shadowOpacity: 0.07 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(6), height: 72, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  searchIcon: { fontSize: 22, color: colors.ink, marginTop: -2 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 18, color: colors.text, outlineStyle: 'none' } as any,
  clear: { fontSize: 16, color: colors.ink, fontFamily: fonts.medium },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), paddingHorizontal: space(5), paddingVertical: space(3), backgroundColor: colors.section, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, zIndex: 5 },
  chipBtn: { height: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card, justifyContent: 'center' },
  chipBtnText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  menu: { position: 'absolute', top: 44, left: 0, minWidth: 180, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, ...shadow, shadowOpacity: 0.12 },
  menuItem: { paddingHorizontal: 14, paddingVertical: 9 },
  menuText: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  result: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(6), paddingVertical: space(3) },
  resultTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(5), paddingVertical: space(4), borderRadius: radius.md, borderWidth: 1, borderColor: colors.accentLine, backgroundColor: colors.accentSoft },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  input: { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 15, color: colors.text, backgroundColor: colors.card, outlineStyle: 'none' } as any,
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
