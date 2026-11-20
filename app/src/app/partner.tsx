import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { API, api, eur, fmtDay, fmtSlot, fmtTime, fmtWhen, usePoll } from '../lib/api';
import { Button, Card, Choice, Display, ErrorNote, H2, H3, KV, Label, Muted, P, Row, Small, StatusChip, useWide } from '../lib/ui';
import { colors, fonts, layout, radius, space } from '../lib/theme';

type Route = { name: 'jobs' } | { name: 'schedule' } | { name: 'history' } | { name: 'profile' } | { name: 'job'; id: string; from: Tab };
type Tab = 'jobs' | 'schedule' | 'history' | 'profile';

// One place for every job state, so nothing needs checking twice.
const needsYou = (j: any) => j.status === 'sent' || j.case_status === 'no_slot_fits' || j.status === 'in_progress' || j.status === 'completed';
const waiting = (j: any) => j.status === 'accepted' && j.case_status === 'slot_offered';
const upcoming = (j: any) => j.status === 'scheduled';
const finished = (j: any) => j.status === 'invoiced';
const declined = (j: any) => j.status === 'declined';

export default function PartnerApp() {
  const partners = usePoll<any[]>('/partners', 15000);
  const [partnerId, setPartnerId] = useState('p_schmitz');
  const jobs = usePoll<any[]>(`/connector/partners/${partnerId}/jobs`);
  const [route, setRoute] = useState<Route>({ name: 'jobs' });
  const partner = partners.data?.find((p) => p.id === partnerId);
  const all = jobs.data ?? [];
  const tab: Tab = route.name === 'job' ? route.from : route.name;
  const open = (id: string) => setRoute({ name: 'job', id, from: tab });
  const narrow = !useWide(560);

  return (
    <SafeAreaView style={st.page} edges={['top', 'left', 'right']}>
      <View style={st.nav}>
        <View style={[st.navInner, narrow && { paddingHorizontal: 12 }]}>
          <Pressable onPress={() => setRoute({ name: 'jobs' })} onLongPress={() => router.replace('/')} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={[st.brand, narrow && { fontSize: 20 }]}>centrix</Text>
            {!narrow && <Text style={st.brandSub}>Partner</Text>}
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: narrow ? 0 : 4 }}>
            <NavBtn label="Jobs" on={tab === 'jobs'} badge={all.filter(needsYou).length} onPress={() => setRoute({ name: 'jobs' })} />
            <NavBtn label="Schedule" on={tab === 'schedule'} onPress={() => setRoute({ name: 'schedule' })} />
            <NavBtn label="History" on={tab === 'history'} onPress={() => setRoute({ name: 'history' })} />
            <Pressable onPress={() => setRoute({ name: 'profile' })} style={[st.avatar, tab === 'profile' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <Text style={[st.avatarText, tab === 'profile' && { color: '#fff' }]}>{initials(partner?.contact_person ?? partner?.name ?? '··')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: space(24) }} keyboardShouldPersistTaps="handled">
        <View style={[st.column, { paddingTop: space(10), gap: space(8) }]}>
          <ErrorNote error={jobs.error} />
          {jobs.data && route.name === 'jobs' && <Jobs jobs={all} partner={partner} open={open} />}
          {jobs.data && route.name === 'schedule' && <Schedule partnerId={partnerId} jobs={all} open={open} />}
          {jobs.data && route.name === 'history' && <History jobs={all} open={open} />}
          {route.name === 'profile' && (
            <Profile partner={partner} partners={partners.data ?? []} onSwitch={(id) => { setPartnerId(id); setRoute({ name: 'jobs' }); }} />
          )}
          {jobs.data && route.name === 'job' && (
            <JobDetail job={all.find((j) => j.id === route.id)} refresh={jobs.refresh} back={() => setRoute({ name: route.from } as Route)} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('');

function NavBtn({ label, on, badge, onPress }: { label: string; on: boolean; badge?: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }: any) => [st.navBtn, (on || hovered) && st.navBtnOn]}>
      <Text style={st.navBtnText}>{label}</Text>
      {badge ? (
        <View style={st.badge}>
          <Text style={st.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------- lists

function JobRow({ j, onPress }: { j: any; onPress: () => void }) {
  const f = j.payload.fields;
  const invoice = j.documents?.find((d: any) => d.type === 'invoice');
  let sub = `${f['property.address']}`;
  if (declined(j)) sub = `Declined ${fmtDay(j.declined_at ?? j.created_at)} · ${j.decline_reason}`;
  else if (finished(j)) sub = `Done ${fmtDay(j.completed_at ?? j.created_at)}${invoice ? ` · ${eur(invoice.amount_eur)}` : ''}${j.rating ? ` · ${'★'.repeat(j.rating.stars)}` : ''}`;
  else if (j.slot) sub = `${fmtSlot(j.slot)} · ${f['property.address']}`;
  return (
    <Pressable onPress={onPress} style={({ hovered }: any) => [st.row, hovered && { borderColor: colors.borderStrong }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={st.rowTitle}>{j.title}</Text>
        <Small numberOfLines={1}>{sub}</Small>
      </View>
      <StatusChip status={declined(j) ? 'declined' : j.case_status === 'no_slot_fits' ? 'no_slot_fits' : j.status} label={partnerLabel(j)} />
      <Text style={st.chev}>›</Text>
    </Pressable>
  );
}

function Section({ title, jobs, open, empty }: { title: string; jobs: any[]; open: (id: string) => void; empty?: string }) {
  if (!jobs.length && !empty) return null;
  return (
    <View style={{ gap: space(3) }}>
      <Label>
        {title} · {jobs.length}
      </Label>
      {jobs.length ? jobs.map((j) => <JobRow key={j.id} j={j} onPress={() => open(j.id)} />) : <Muted>{empty}</Muted>}
    </View>
  );
}

function Jobs({ jobs, partner, open }: { jobs: any[]; partner: any; open: (id: string) => void }) {
  const next = jobs.filter(upcoming).sort((a, b) => a.slot.start.localeCompare(b.slot.start))[0];
  return (
    <>
      <View style={{ gap: space(3) }}>
        <Display>Hello{partner?.contact_person ? `, ${partner.contact_person.split(' ')[0]}` : ''}</Display>
        <Muted style={{ fontSize: 17 }}>
          {next ? `Next visit ${fmtSlot(next.slot)} · ${next.payload.fields['property.address']}` : 'No visits booked yet.'}
        </Muted>
      </View>
      <Section title="Needs you" jobs={jobs.filter(needsYou)} open={open} empty="Nothing to do right now. New jobs from centrix appear here automatically." />
      <Section title="Waiting for the tenant" jobs={jobs.filter(waiting)} open={open} />
      <Section title="Upcoming visits" jobs={jobs.filter(upcoming)} open={open} />
    </>
  );
}

function History({ jobs, open }: { jobs: any[]; open: (id: string) => void }) {
  return (
    <>
      <View style={{ gap: space(3) }}>
        <Display>History</Display>
        <Muted>Everything you finished or turned down, with the job data you had.</Muted>
      </View>
      <Section title="Completed" jobs={jobs.filter(finished)} open={open} empty="No completed jobs yet." />
      <Section title="Declined" jobs={jobs.filter(declined)} open={open} empty="You haven't declined any jobs." />
    </>
  );
}

// ---------------------------------------------------------------- schedule + Google Calendar

const gStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function googleCalendarLink(j: any) {
  const f = j.payload.fields;
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${j.title} – ${f['unit.floor'] ?? ''}`,
    dates: `${gStamp(j.slot.start)}/${gStamp(j.slot.end)}`,
    location: f['property.address'] ?? '',
    details: `${f['case.summary'] ?? ''}\n\nJob ${j.id} via centrix`,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

function Schedule({ partnerId, jobs, open }: { partnerId: string; jobs: any[]; open: (id: string) => void }) {
  const slots = usePoll<any[]>(`/connector/partners/${partnerId}/availability`, 5000);
  const feed = `${API}/connector/partners/${partnerId}/calendar.ics`;
  const days = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of slots.data ?? []) {
      const k = new Date(s.start).toDateString();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return [...map.entries()];
  }, [slots.data]);
  const jobFor = (slotId: string) => jobs.find((j) => j.slot_id === slotId && !declined(j)) ?? jobs.find((j) => j.offered_slot_ids?.includes(slotId) && waiting(j));

  return (
    <>
      <View style={{ gap: space(3) }}>
        <Display>Schedule</Display>
        <Muted>Your next two weeks. Booked visits come from centrix; free slots are what tenants can pick from.</Muted>
      </View>
      <Card tone="accent">
        <Label>Google Calendar</Label>
        <P>Keep visits in your own calendar: subscribe once and new bookings appear by themselves, or add single visits below.</P>
        <Row gap={12}>
          <Button title="Subscribe in Google Calendar" onPress={() => Linking.openURL(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feed.replace(/^https?:/, 'webcal:'))}`)} />
          <Button title="Download .ics" variant="secondary" onPress={() => Linking.openURL(feed)} />
        </Row>
        <Small>Subscribing needs the centrix server on a public address; on a laptop demo use "Download .ics" and import it in Google Calendar.</Small>
      </Card>
      {days.map(([day, list]) => (
        <View key={day} style={{ gap: space(2) }}>
          <Label>{fmtDay(list[0].start)}</Label>
          <Card compact style={{ gap: 0, paddingVertical: space(1) }}>
            {list.map((s, i) => {
              const j = s.status !== 'free' ? jobFor(s.id) : null;
              return (
                <View key={s.id} style={[st.slotRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <Text style={st.slotTime}>
                    {fmtTime(s.start)}–{fmtTime(s.end)}
                  </Text>
                  {s.status === 'booked' && j ? (
                    <View style={{ flex: 1, gap: space(2) }}>
                      <Pressable onPress={() => open(j.id)}>
                        <P style={{ fontFamily: fonts.medium }}>{j.title}</P>
                        <Small>{j.payload.fields['property.address']}</Small>
                      </Pressable>
                      <Button title="Add to Google Calendar" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => Linking.openURL(googleCalendarLink({ ...j, slot: s }))} />
                    </View>
                  ) : s.status === 'offered' ? (
                    <Pressable onPress={() => j && open(j.id)} style={{ flex: 1 }}>
                      <P style={{ color: colors.warning }}>Offered to tenant</P>
                      {j ? <Small numberOfLines={1}>{j.title}</Small> : null}
                    </Pressable>
                  ) : (
                    <Muted style={{ flex: 1 }}>Free</Muted>
                  )}
                </View>
              );
            })}
          </Card>
        </View>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- profile (and demo switch)

function Profile({ partner, partners, onSwitch }: { partner: any; partners: any[]; onSwitch: (id: string) => void }) {
  if (!partner) return <Muted>Loading…</Muted>;
  return (
    <>
      <Display>{partner.name}</Display>
      <Card>
        <Label>Your company in centrix</Label>
        <View>
          <KV k="Contact" v={partner.contact_person} />
          <KV k="Rating" v={`★ ${partner.rating} from ${partner.reviews} jobs`} />
          <KV k="Trades" v={partner.trades.join(', ')} />
          <KV k="Heating types" v={partner.heating_types.join(', ')} />
          <KV k="Postcodes" v={partner.postcodes.join(', ')} />
          <KV k="Hourly rate" v={eur(partner.hourly_rate)} />
        </View>
      </Card>
      <View style={{ gap: space(3) }}>
        <Label>Demo: view as another partner</Label>
        <Row gap={8}>
          {partners.map((p) => (
            <Choice key={p.id} label={p.name} selected={p.id === partner.id} onPress={() => onSwitch(p.id)} />
          ))}
        </Row>
      </View>
    </>
  );
}

// ---------------------------------------------------------------- one job

function JobDetail({ job, refresh, back }: { job: any; refresh: () => void; back: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  if (!job) return <Muted>Loading…</Muted>;
  const f = job.payload.fields;
  const run = (fn: () => Promise<unknown>) => async () => {
    try {
      setErr(null);
      await fn();
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const status = (body: object) => api(`/centrix/jobs/${job.id}/status`, 'POST', body);
  const needsSlots = job.status === 'sent' || job.case_status === 'no_slot_fits';
  const heating = f['property.heating_system'];
  const invoice = job.documents?.find((d: any) => d.type === 'invoice');

  return (
    <>
      <Pressable onPress={back}>
        <Text style={st.link}>← Back</Text>
      </Pressable>
      <View style={{ gap: space(3) }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>{job.title}</H2>
          <StatusChip status={declined(job) ? 'declined' : job.status} label={partnerLabel(job)} />
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space(6), rowGap: space(1) }}>
          <Fact k="Received" v={fmtDay(job.created_at)} />
          {job.slot ? <Fact k="Visit" v={fmtSlot(job.slot)} /> : null}
          {f['case.urgency'] ? <Fact k="Urgency" v={f['case.urgency']} /> : null}
          {finished(job) && job.completed_at ? <Fact k="Done" v={fmtDay(job.completed_at)} /> : null}
        </View>
      </View>

      {/* actions first: whatever the craftsman has to do next */}
      {needsSlots && (
        <Card tone="accent">
          <OfferSlots job={job} onDone={refresh} />
        </Card>
      )}
      {waiting(job) && (
        <Card tone="sunken">
          <P style={{ fontFamily: fonts.medium }}>Waiting for the tenant to pick a time…</P>
          <Muted>{job.offered_slots.map(fmtSlot).join('  ·  ')}</Muted>
        </Card>
      )}
      {upcoming(job) && job.slot && (
        <Card tone="accent">
          <Label>Booked</Label>
          <H2>{fmtSlot(job.slot)}</H2>
          <Muted>{f['tenant.phone'] ? 'Call the tenant shortly before arriving to be let in.' : 'Tenant prefers no calls – ring the bell.'}</Muted>
          <Row gap={12}>
            <Button title="I've arrived – start repair" size="lg" onPress={run(() => status({ status: 'in_progress' }))} />
            <Button title="Add to Google Calendar" variant="secondary" size="lg" onPress={() => Linking.openURL(googleCalendarLink(job))} />
          </Row>
        </Card>
      )}
      {job.status === 'in_progress' && (
        <Card tone="accent">
          <Complete job={job} onDone={refresh} />
        </Card>
      )}
      {job.status === 'completed' && (
        <Button title="Send invoice" size="lg" onPress={run(() => api(`/centrix/jobs/${job.id}/result`, 'POST', { note: job.completion_note }))} />
      )}
      {declined(job) && (
        <Card tone="sunken">
          <Label>Declined</Label>
          <P>
            {fmtWhen(job.declined_at ?? job.created_at)} · “{job.decline_reason}”
          </P>
          <Small>centrix passed the job to another partner. You no longer receive updates on it.</Small>
        </Card>
      )}

      {finished(job) && (
        <Card>
          <Label>Result</Label>
          {job.completion_note ? <KV k="Work done" v={job.completion_note} /> : null}
          {invoice && (
            <View style={{ gap: space(1), marginTop: space(2) }}>
              {invoice.lines.map((l: any, i: number) => (
                <Row key={i} style={{ justifyContent: 'space-between' }}>
                  <Small>
                    {l.text}
                    {l.qty !== 1 ? ` · ${l.qty} × ${eur(l.unit_eur)}` : ''}
                  </Small>
                  <Small>{eur(l.qty * l.unit_eur)}</Small>
                </Row>
              ))}
              <Row style={{ justifyContent: 'space-between', marginTop: space(2) }}>
                <P style={{ fontFamily: fonts.medium }}>
                  {invoice.number} · incl. VAT
                </P>
                <H3>{eur(invoice.amount_eur)}</H3>
              </Row>
              <Button title="Open invoice" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => Linking.openURL(API + invoice.url)} />
            </View>
          )}
          {job.rating ? <KV k="Tenant rating" v={'★'.repeat(job.rating.stars)} /> : null}
        </Card>
      )}

      <Card>
        <Label>Job data from centrix</Label>
        <P>{f['case.summary']}</P>
        <View>
          <KV k="Address" v={f['property.address']} />
          <KV k="Floor" v={f['unit.floor']} />
          {heating && <KV k="Heating" v={`${heating.make} (${heating.installed}) · ${heating.location} · last service ${heating.last_service}`} />}
          <KV k="Built" v={String(f['property.building_year'])} />
          {f['tenant.phone'] ? (
            <KV k="Tenant phone" v={<Text onPress={() => Linking.openURL(`tel:${f['tenant.phone'].replace(/\s/g, '')}`)} style={{ color: colors.primary }}>{f['tenant.phone']}</Text>} />
          ) : null}
          {job.payload.withheld.map((w: any) => (
            <KV key={w.field} k={w.label} v="Shared once the tenant agrees" locked />
          ))}
          {job.payload.expired?.includes('tenant.phone') ? <KV k="Tenant phone" v="Removed – consent ended when the job closed" locked /> : null}
          <KV k="Estimate" v={`${eur(job.estimate.gross_eur)} incl. VAT · billed to the owner via reltix`} />
        </View>
        {f['case.photos']?.length > 0 && (
          <Row>
            {f['case.photos'].map((p: string, i: number) => (
              <Image key={i} source={{ uri: p }} style={{ width: 96, height: 96, borderRadius: 8 }} />
            ))}
          </Row>
        )}
      </Card>
      <ErrorNote error={err} />
    </>
  );
}

const Fact = ({ k, v }: { k: string; v: string }) => (
  <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>
    {k} <Text style={{ fontFamily: fonts.medium, color: colors.text }}>{v}</Text>
  </Text>
);

function OfferSlots({ job, onDone }: { job: any; onDone: () => void }) {
  const avail = usePoll<any[]>(`/connector/partners/${job.partner_id}/availability`, 5000);
  const free = useMemo(
    () => (avail.data ?? []).filter((s) => s.status === 'free' && !(job.rejected_slot_ids ?? []).includes(s.id)),
    [avail.data, job.rejected_slot_ids],
  );
  const [picked, setPicked] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (picked === null && free.length) setPicked(free.slice(0, 3).map((s) => s.id));
  }, [free, picked]);
  const sel = picked ?? [];
  const reschedule = job.case_status === 'no_slot_fits';

  const send = (body: object) => async () => {
    try {
      await api(`/centrix/jobs/${job.id}/status`, 'POST', body);
      onDone();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Label>{reschedule ? 'Tenant needs other times' : 'Your free slots'}</Label>
      {reschedule && job.tenant_note ? <P>“{job.tenant_note}”</P> : null}
      <Row gap={6}>
        {free.map((s) => (
          <Choice
            key={s.id}
            label={fmtSlot(s)}
            selected={sel.includes(s.id)}
            onPress={() => setPicked(sel.includes(s.id) ? sel.filter((x) => x !== s.id) : [...sel, s.id])}
          />
        ))}
        {avail.data && free.length === 0 && <Muted>No free slots in your calendar.</Muted>}
      </Row>
      <Button
        title={reschedule ? `Offer ${sel.length} new time${sel.length === 1 ? '' : 's'}` : `Accept & offer ${sel.length} slot${sel.length === 1 ? '' : 's'}`}
        size="lg"
        disabled={!sel.length}
        onPress={send({ status: reschedule ? 'slots_offered' : 'accepted', slot_ids: sel })}
      />
      {!reschedule && (
        <Row gap={6}>
          <Muted style={{ fontSize: 13 }}>Can't take it?</Muted>
          {['Fully booked', 'Not my area', 'Needs a specialist'].map((r) => (
            <Button key={r} title={r} size="sm" variant="danger" onPress={send({ status: 'declined', reason: r })} />
          ))}
        </Row>
      )}
      <ErrorNote error={err} />
    </View>
  );
}

const NOTES = ['Replaced ignition electrode', 'Bled radiators', 'Topped up system pressure to 1.5 bar', 'Replaced circulation pump'];

type Item = { text: string; amount: string };
const toNum = (v: string) => Number(v.replace(',', '.')) || 0;

function Complete({ job, onDone }: { job: any; onDone: () => void }) {
  const [notes, setNotes] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [hours, setHours] = useState(1.5);
  // Parts and extra items are typed by the craftsman – no preset prices.
  const [items, setItems] = useState<Item[]>([{ text: '', amount: '' }]);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (v: string) => setNotes(notes.includes(v) ? notes.filter((x) => x !== v) : [...notes, v]);
  const setItem = (i: number, patch: Partial<Item>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  // Call-out fee and hourly rate are the craftsman's own, from his connector manifest.
  const pm = { callout: job.price_model?.callout_fee_eur ?? 0, rate: job.price_model?.hourly_rate_eur ?? 0 };
  const filled = items.filter((it) => it.text.trim() && toNum(it.amount) > 0);
  const net = pm.callout + hours * pm.rate + filled.reduce((s, it) => s + toNum(it.amount), 0);
  const note = [...notes, extra.trim()].filter(Boolean).join('. ');
  const half = items.some((it) => (it.text.trim() && !toNum(it.amount)) || (!it.text.trim() && toNum(it.amount)));

  const finish = async () => {
    try {
      if (!note) throw new Error('Add a short note on what you did.');
      if (half) throw new Error('Each item needs a name and an amount.');
      await api(`/centrix/jobs/${job.id}/status`, 'POST', { status: 'completed', note });
      await api(`/centrix/jobs/${job.id}/result`, 'POST', {
        note,
        invoice: { hours, parts: filled.map((it) => ({ text: it.text.trim(), amount_eur: toNum(it.amount) })) },
      });
      onDone();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const input = { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, height: 44, fontFamily: fonts.body, fontSize: 15, color: colors.text, backgroundColor: colors.card } as const;

  return (
    <View style={{ gap: 20 }}>
      <Label>What did you do?</Label>
      <Row gap={8}>
        {NOTES.map((n) => <Choice key={n} label={n} selected={notes.includes(n)} onPress={() => toggle(n)} />)}
      </Row>
      <TextInput value={extra} onChangeText={setExtra} placeholder="Anything else? (optional)" placeholderTextColor={colors.subtle} style={input} />

      <Label>Parts and other items</Label>
      <View style={{ gap: 10 }}>
        {items.map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={it.text} onChangeText={(v) => setItem(i, { text: v })} placeholder="e.g. Ignition electrode" placeholderTextColor={colors.subtle} style={[input, { flex: 1 }]} />
            <TextInput value={it.amount} onChangeText={(v) => setItem(i, { amount: v.replace(/[^0-9.,]/g, '') })} placeholder="€ net" placeholderTextColor={colors.subtle} keyboardType="decimal-pad" style={[input, { width: 96, textAlign: 'right' }]} />
            {items.length > 1 ? <Button title="✕" size="sm" variant="ghost" onPress={() => setItems(items.filter((_, j) => j !== i))} /> : null}
          </View>
        ))}
        <Button title="+ Add item" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => setItems([...items, { text: '', amount: '' }])} />
      </View>

      <Row style={{ justifyContent: 'space-between' }}>
        <Label>Labour</Label>
        <Row gap={8}>
          <Button title="−" size="sm" variant="secondary" onPress={() => setHours(Math.max(0.5, hours - 0.5))} />
          <P style={{ fontFamily: fonts.medium, minWidth: 48, textAlign: 'center' }}>{hours} h</P>
          <Button title="+" size="sm" variant="secondary" onPress={() => setHours(hours + 0.5)} />
        </Row>
      </Row>
      <View style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Muted style={{ fontSize: 13 }}>Call-out {eur(pm.callout)} · labour {hours} h × {eur(pm.rate)} · items {eur(filled.reduce((s, it) => s + toNum(it.amount), 0))}</Muted>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Muted>Invoice total incl. 19% VAT</Muted>
          <H3>{eur(Math.round(net * 1.19 * 100) / 100)}</H3>
        </Row>
      </View>
      <Button title="Done – send report & invoice" size="lg" onPress={finish} />
      <ErrorNote error={err} />
    </View>
  );
}

function partnerLabel(job: any) {
  if (job.status !== 'declined' && job.case_status === 'no_slot_fits') return 'New times needed';
  return ({ sent: 'New job', accepted: 'Awaiting tenant', scheduled: 'Booked', in_progress: 'On site', completed: 'Send invoice', invoiced: 'Done', declined: 'Declined' } as Record<string, string>)[job.status] ?? job.status;
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: layout.gutter },
  nav: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong, backgroundColor: colors.background },
  navInner: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: layout.gutter, height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, letterSpacing: -0.8 },
  brandSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 9, borderRadius: 12 },
  navBtnOn: { backgroundColor: colors.sunken },
  navBtnText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, color: '#fff' },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  avatarText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  link: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(4), padding: space(5), borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  rowTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, letterSpacing: -0.6 },
  chev: { fontFamily: fonts.body, fontSize: 22, color: colors.subtle },
  slotRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(4), paddingVertical: space(3) },
  slotTime: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 24, color: colors.ink, width: 92 },
});
