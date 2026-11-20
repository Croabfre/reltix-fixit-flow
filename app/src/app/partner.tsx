import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Text, TextInput, View } from 'react-native';
import { API, api, eur, fmtSlot, fmtWhen, usePoll } from '../lib/api';
import { Button, Card, Choice, ErrorNote, H2, H3, KV, Label, Muted, P, Row, Screen, StatusChip } from '../lib/ui';
import { colors, fonts, radius } from '../lib/theme';

const FIELD_LABELS: Record<string, string> = {
  'property.address': 'Address',
  'unit.floor': 'Floor',
  'unit.access_notes': 'Access',
  'property.heating_system': 'Heating',
  'property.building_year': 'Built',
  'case.summary': 'Problem',
  'case.urgency': 'Urgency',
  'case.photos': 'Photos',
  'tenant.first_name': 'Tenant',
  'tenant.phone': 'Phone',
};

export default function PartnerApp() {
  const partners = usePoll<any[]>('/partners', 15000);
  const [partnerId, setPartnerId] = useState('p_schmitz');
  const jobs = usePoll<any[]>(`/connector/partners/${partnerId}/jobs`);
  const partner = partners.data?.find((p) => p.id === partnerId);
  const open = (jobs.data ?? []).filter((j) => !['declined', 'invoiced', 'cancelled'].includes(j.status));
  const done = (jobs.data ?? []).filter((j) => ['declined', 'invoiced', 'cancelled'].includes(j.status));

  return (
    <Screen title={partner?.name ?? 'Partner app'} subtitle={partner ? `${partner.contact_person} · ★ ${partner.rating} (${partner.reviews})` : 'Jobs from centrix'}>
      <Row gap={6}>
        {(partners.data ?? []).map((p) => (
          <Choice key={p.id} label={p.name.split(' ')[0]} selected={p.id === partnerId} onPress={() => setPartnerId(p.id)} />
        ))}
      </Row>
      <ErrorNote error={jobs.error} />
      {jobs.data && open.length === 0 && (
        <Card tone="sunken">
          <H3>No open jobs</H3>
          <Muted>New jobs from centrix land here automatically, with everything you need to know.</Muted>
        </Card>
      )}
      {open.map((j) => (
        <JobCard key={j.id} job={j} refresh={jobs.refresh} />
      ))}
      {done.length > 0 && <Label style={{ marginTop: 8 }}>Finished</Label>}
      {done.map((j) => (
        <Card key={j.id} tone="sunken">
          <Row style={{ justifyContent: 'space-between' }}>
            <P style={{ fontFamily: fonts.medium }}>{j.payload.fields['property.address']}</P>
            <StatusChip status={j.status} />
          </Row>
          {j.decline_reason ? <Muted>Declined: {j.decline_reason}</Muted> : null}
          {j.documents?.filter((d: any) => d.type === 'invoice').map((d: any) => (
            <Muted key={d.id}>
              {d.number} · {eur(d.amount_eur)}
              {j.rating ? ` · tenant rated ${'★'.repeat(j.rating.stars)}` : ''}
            </Muted>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

function JobCard({ job, refresh }: { job: any; refresh: () => void }) {
  const f = job.payload.fields;
  const [err, setErr] = useState<string | null>(null);
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

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Label>Job {job.payload.job_ref.slice(-6)} · from centrix</Label>
        <Row gap={6}>
          <StatusChip status={f['case.urgency']} label={`${f['case.urgency']} urgency`} />
          <StatusChip status={job.status} label={partnerLabel(job)} />
        </Row>
      </Row>
      <H2>{job.payload.case.trade.charAt(0).toUpperCase() + job.payload.case.trade.slice(1)} repair</H2>
      <P>{f['case.summary']}</P>

      <View>
        <KV k="Address" v={f['property.address']} />
        <KV k="Floor" v={f['unit.floor']} />
        {heating && <KV k="Heating" v={`${heating.make} (${heating.installed}) · ${heating.location} · last service ${heating.last_service}`} />}
        <KV k="Built" v={String(f['property.building_year'])} />
        {f['tenant.phone'] ? (
          <KV k="Phone" v={<Text onPress={() => Linking.openURL(`tel:${f['tenant.phone'].replace(/\s/g, '')}`)} style={{ color: colors.primaryHover }}>{f['tenant.phone']}</Text>} />
        ) : null}
        {job.payload.withheld.map((w: any) => (
          <KV key={w.field} k={w.label} v={`🔒 shared once the tenant consents`} locked />
        ))}
        <KV k="Estimate" v={`${eur(job.estimate.gross_eur)} incl. VAT · billed to owner via reltix`} />
      </View>
      {f['case.photos']?.length > 0 && (
        <Row>
          {f['case.photos'].map((p: string, i: number) => (
            <Image key={i} source={{ uri: p }} style={{ width: 96, height: 96, borderRadius: 8 }} />
          ))}
        </Row>
      )}
      <Muted style={{ fontSize: 12 }}>Pre-filled from the property record. Nothing to type.</Muted>

      {needsSlots && <OfferSlots job={job} onDone={refresh} />}

      {job.status === 'accepted' && job.case_status === 'slot_offered' && (
        <Card tone="sunken">
          <P style={{ fontFamily: fonts.medium }}>Waiting for the tenant to pick a time…</P>
          <Muted>{job.offered_slots.map(fmtSlot).join('  ·  ')}</Muted>
        </Card>
      )}

      {job.status === 'scheduled' && job.slot && (
        <>
          <Card tone="accent">
            <Label>Booked</Label>
            <H2>{fmtSlot(job.slot)}</H2>
            <Muted>{f['tenant.phone'] ? 'Call the tenant shortly before arriving to be let in.' : 'Tenant prefers no calls – ring the bell.'}</Muted>
          </Card>
          <Button title="I've arrived – start repair" size="lg" onPress={run(() => status({ status: 'in_progress' }))} />
        </>
      )}

      {job.status === 'in_progress' && <Complete job={job} onDone={refresh} />}

      {job.status === 'completed' && (
        <Button title="Send invoice" size="lg" onPress={run(() => api(`/centrix/jobs/${job.id}/result`, 'POST', { note: job.completion_note }))} />
      )}
      <ErrorNote error={err} />
    </Card>
  );
}

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
  if (job.case_status === 'no_slot_fits') return 'new times needed';
  return ({ sent: 'new', accepted: 'awaiting tenant', scheduled: 'booked', in_progress: 'on site', completed: 'completed', invoiced: 'invoiced', declined: 'declined' } as Record<string, string>)[job.status] ?? job.status;
}
