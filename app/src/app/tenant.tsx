import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api, fmtDay, fmtSlot, fmtWhen, usePoll } from '../lib/api';
import { Button, Card, Display, ErrorNote, H2, KV, Label, Muted, P, Small, StatusChip, Toggle, useWide } from '../lib/ui';
import { colors, fonts, layout, radius, space } from '../lib/theme';

const TENANT_ID = 'c_202'; // Lena Hoffmann, unit_4b
const QUICK = ['No heating since yesterday', 'No hot water', 'Radiator is leaking', 'Heating makes a loud noise'];
const OPEN = (c: any) => c.status !== 'closed';

type Route = { name: 'home' } | { name: 'requests' } | { name: 'profile' } | { name: 'chat'; id: string };

export default function TenantPortal() {
  const { data, refresh, error } = usePoll<any>(`/tenants/${TENANT_ID}`);
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const openCount = data?.cases.filter(OPEN).length ?? 0;

  return (
    <SafeAreaView style={st.page} edges={['top', 'left', 'right']}>
      <Nav
        active={route.name}
        openCount={openCount}
        initials={data ? data.contact.name.split(' ').map((p: string) => p[0]).join('') : '··'}
        go={setRoute}
      />
      {error ? (
        <View style={{ padding: layout.gutter }}>
          <ErrorNote error={error} />
        </View>
      ) : null}
      {data && route.name === 'home' && (
        <Home
          data={data}
          go={setRoute}
          onSent={(id) => {
            refresh();
            setRoute({ name: 'chat', id });
          }}
        />
      )}
      {data && route.name === 'requests' && <Requests cases={data.cases} go={setRoute} />}
      {data && route.name === 'profile' && <Profile data={data} />}
      {data && route.name === 'chat' && <Chat kase={data.cases.find((c: any) => c.id === route.id)} refresh={refresh} go={setRoute} />}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- navigation

function Nav({ active, openCount, initials, go }: { active: string; openCount: number; initials: string; go: (r: Route) => void }) {
  return (
    <View style={st.nav}>
      <View style={st.navInner}>
        <Pressable onPress={() => go({ name: 'home' })} onLongPress={() => router.replace('/')} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={st.brand}>centrix</Text>
          <Text style={st.brandSub}>Tenant portal · demo</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <Pressable
            onPress={() => go({ name: 'requests' })}
            style={({ hovered }: any) => [st.navBtn, (active === 'requests' || active === 'chat' || hovered) && st.navBtnOn]}
          >
            <Text style={st.navBtnText}>My requests</Text>
            {openCount > 0 && (
              <View style={st.badge}>
                <Text style={st.badgeText}>{openCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => go({ name: 'profile' })} style={[st.avatar, active === 'profile' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            <Text style={[st.avatarText, active === 'profile' && { color: '#fff' }]}>{initials}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- home: the big composer

function Home({ data, go, onSent }: { data: any; go: (r: Route) => void; onSent: (id: string) => void }) {
  const wide = useWide(720);
  const open = data.cases.filter(OPEN);
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: space(24) }} keyboardShouldPersistTaps="handled">
      <View style={[st.column, { maxWidth: 760, paddingTop: wide ? space(24) : space(12) }]}>
        <View style={{ alignItems: wide ? 'center' : 'flex-start', gap: space(3), marginBottom: space(10) }}>
          <Display style={{ textAlign: wide ? 'center' : 'left' }}>What can we fix for you, {data.contact.name.split(' ')[0]}?</Display>
          <Muted style={{ fontSize: 17, textAlign: wide ? 'center' : 'left' }}>
            {data.unit.address} · {data.unit.label}
          </Muted>
        </View>
        <Composer onSent={onSent} />
        {open.length > 0 && (
          <View style={{ marginTop: space(16), gap: space(3) }}>
            <Label>Open requests</Label>
            {open.map((c: any) => (
              <RequestRow key={c.id} c={c} onPress={() => go({ name: 'chat', id: c.id })} />
            ))}
          </View>
        )}
        <Pressable onPress={() => go({ name: 'requests' })} style={{ marginTop: space(6), alignSelf: wide ? 'center' : 'flex-start' }}>
          <Text style={st.link}>All requests, including resolved ones →</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Composer({ onSent }: { onSent: (id: string) => void }) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.3, base64: true });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      setPhoto(a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : a.uri);
    }
  };
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const kase = await api('/cases', 'POST', { unit_id: 'unit_4b', contact_id: TENANT_ID, text, photos: photo ? [photo] : [] });
      setText('');
      setPhoto(null);
      onSent(kase.id);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space(5) }}>
      <View style={[st.composer, focused && { borderColor: colors.borderStrong }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Describe what's not working – one sentence is enough."
          placeholderTextColor={colors.subtle}
          multiline
          style={st.composerInput}
          onKeyPress={(e: any) => enterToSend(e, send)}
        />
        <View style={st.composerBar}>
          <Pressable onPress={pick} style={({ hovered }: any) => [st.iconBtn, hovered && { backgroundColor: colors.sunken }]}>
            {photo ? <Image source={{ uri: photo }} style={{ width: 24, height: 24, borderRadius: 6 }} /> : <Text style={{ fontSize: 15, color: colors.ink }}>＋</Text>}
            <Small style={{ color: colors.ink }}>{photo ? 'Photo added' : 'Add photo'}</Small>
          </Pressable>
          <Pressable onPress={send} disabled={!text.trim() || busy} style={[st.sendBtn, (!text.trim() || busy) && { opacity: 0.3 }]}>
            <Text style={st.sendIcon}>{busy ? '…' : '↑'}</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2), justifyContent: 'center' }}>
        {QUICK.map((q) => (
          <Pressable key={q} onPress={() => setText(q)} style={({ hovered }: any) => [st.suggest, hovered && { borderColor: colors.ink }]}>
            <Text style={st.suggestText}>{q}</Text>
          </Pressable>
        ))}
      </View>
      <Small style={{ textAlign: 'center' }}>We already know your flat, your heating and the building. No forms.</Small>
      <ErrorNote error={err} />
    </View>
  );
}

// Enter sends, Shift+Enter makes a new line (web only).
function enterToSend(e: any, send: () => void) {
  if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey && typeof window !== 'undefined') {
    e.preventDefault?.();
    send();
  }
}

// ---------------------------------------------------------------- request list

function RequestRow({ c, onPress }: { c: any; onPress: () => void }) {
  const resolved = c.status === 'closed';
  return (
    <Pressable onPress={onPress} style={({ hovered }: any) => [st.row, hovered && { borderColor: colors.borderStrong }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={st.rowTitle}>{c.title ?? 'Repair request'}</Text>
        <Small>
          {resolved
            ? `Resolved ${fmtDay(c.resolved_at ?? c.updated_at)}${c.partner ? ` · ${c.partner.name}` : ''}`
            : `Reported ${fmtDay(c.created_at)}${c.slot ? ` · visit ${fmtSlot(c.slot)}` : c.partner ? ` · ${c.partner.name}` : ''}`}
        </Small>
      </View>
      <StatusChip status={c.status} label={tenantLabel(c.status)} />
    </Pressable>
  );
}

function Requests({ cases, go }: { cases: any[]; go: (r: Route) => void }) {
  const open = cases.filter(OPEN);
  const done = cases.filter((c) => !OPEN(c));
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: space(24) }}>
      <View style={[st.column, { maxWidth: 760, paddingTop: space(14), gap: space(10) }]}>
        <View style={{ gap: space(3) }}>
          <Display>Your requests</Display>
          <Muted>Every request keeps its chat, appointment and outcome here.</Muted>
        </View>
        <Button title="New request" style={{ alignSelf: 'flex-start' }} onPress={() => go({ name: 'home' })} />
        <View style={{ gap: space(3) }}>
          <Label>Open · {open.length}</Label>
          {open.length ? open.map((c) => <RequestRow key={c.id} c={c} onPress={() => go({ name: 'chat', id: c.id })} />) : <Muted>Nothing open right now.</Muted>}
        </View>
        <View style={{ gap: space(3) }}>
          <Label>Resolved · {done.length}</Label>
          {done.map((c) => (
            <RequestRow key={c.id} c={c} onPress={() => go({ name: 'chat', id: c.id })} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------- profile

function Profile({ data }: { data: any }) {
  const consents = data.cases.flatMap((c: any) => c.consents.map((x: any) => ({ ...x, title: c.title })));
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: space(24) }}>
      <View style={[st.column, { maxWidth: 760, paddingTop: space(14), gap: space(8) }]}>
        <Display>{data.contact.name}</Display>
        <Card>
          <Label>Your details</Label>
          <View>
            <KV k="Flat" v={`${data.unit.address} · ${data.unit.label}`} />
            <KV k="Size" v={`${data.unit.size_sqm} m² · ${data.unit.rooms} rooms`} />
            <KV k="Email" v={data.contact.email} />
            <KV k="Phone" v={data.contact.phone} />
            <KV k="Tenant since" v={fmtDay(data.contact.move_in)} />
          </View>
        </Card>
        <Card>
          <Label>Shared with your consent</Label>
          {consents.length === 0 ? (
            <Muted>Nothing shared. We only pass your phone number to a craftsman if you say yes when booking.</Muted>
          ) : (
            consents.map((c: any) => (
              <View key={c.id} style={{ gap: 2 }}>
                <P style={{ fontFamily: fonts.medium }}>
                  {c.data_labels.join(', ')} → {c.partner_name}
                </P>
                <Small>
                  {c.title} · {fmtWhen(c.given_at)} · {c.expired_at ? 'ended when the request closed' : 'active until the request closes'}
                </Small>
              </View>
            ))
          )}
        </Card>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------- chat

function Chat({ kase, refresh, go }: { kase: any; refresh: () => void; go: (r: Route) => void }) {
  const scroll = useRef<any>(null);
  const [draft, setDraft] = useState('');
  const [sharePhone, setSharePhone] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const count = kase?.messages.length ?? 0;
  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [count, kase?.status]);

  if (!kase) {
    return (
      <View style={[st.column, { paddingTop: space(10) }]}>
        <Muted>Loading…</Muted>
      </View>
    );
  }

  const run = (fn: () => Promise<unknown>) => async () => {
    try {
      setErr(null);
      await fn();
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const send = run(async () => {
    if (!draft.trim()) return;
    const text = draft;
    setDraft('');
    await api(`/cases/${kase.id}/messages`, 'POST', { text, from: 'tenant' });
  });

  // Oldest first, newest at the bottom – your message, then our answer below it.
  const messages = kase.messages
    .filter((m: any) => m.channel === 'portal')
    .map((m: any, i: number) => ({ ...m, i }))
    .sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp) || a.i - b.i);
  const partner = kase.partner?.name;
  const resolved = kase.status === 'closed';

  return (
    <View style={{ flex: 1 }}>
      <View style={st.chatHeader}>
        <View style={[st.column, { maxWidth: 760, gap: space(3) }]}>
          <Pressable onPress={() => go({ name: 'requests' })}>
            <Text style={st.link}>← All requests</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(3), flexWrap: 'wrap' }}>
            <H2>{kase.title ?? 'Repair request'}</H2>
            <StatusChip status={kase.status} label={tenantLabel(kase.status)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space(6), rowGap: space(1) }}>
            <Fact k="Reported" v={fmtDay(kase.created_at)} />
            {partner ? <Fact k="Craftsman" v={partner} /> : null}
            {kase.slot ? <Fact k="Visit" v={fmtSlot(kase.slot)} /> : null}
            {resolved ? <Fact k="Resolved" v={fmtDay(kase.resolved_at ?? kase.updated_at)} /> : null}
          </View>
        </View>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ paddingVertical: space(8) }} keyboardShouldPersistTaps="handled">
        <View style={[st.column, { maxWidth: 760, gap: space(5) }]}>
          {messages.map((m: any) => {
            const mine = m.from !== 'centrix';
            return (
              <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
                <View style={[st.bubble, mine ? st.bubbleMine : st.bubbleTheirs]}>
                  <Text style={[st.bubbleText, mine && { color: '#fff' }]}>{m.text}</Text>
                </View>
                <Small style={{ fontSize: 11, color: colors.subtle }}>
                  {mine ? 'You' : 'reltix'} · {fmtWhen(m.timestamp)}
                </Small>
              </View>
            );
          })}

          {kase.status === 'slot_offered' && (
            <View style={st.actionCard}>
              <P style={{ fontFamily: fonts.medium }}>Pick a time – one tap books it</P>
              <View style={{ gap: space(2) }}>
                {kase.offered_slots.map((s: any) => (
                  <Button
                    key={s.id}
                    title={fmtSlot(s)}
                    variant="secondary"
                    onPress={run(() => api(`/cases/${kase.id}/confirm-slot`, 'POST', { slot_id: s.id, share_phone: sharePhone }))}
                  />
                ))}
              </View>
              <Toggle
                value={sharePhone}
                onChange={setSharePhone}
                label="The craftsman may call me"
                sub={`Shares your phone number with ${partner} for this repair only, so they can call to be let in. Ends when the request closes.`}
              />
              <Pressable onPress={run(() => api(`/cases/${kase.id}/no-slot-fits`, 'POST', { note: 'Evenings after 17:00 work best' }))}>
                <Text style={[st.link, { textAlign: 'center' }]}>None of these work for me</Text>
              </Pressable>
            </View>
          )}
          {(kase.status === 'completed' || kase.status === 'invoiced') && (
            <View style={st.actionCard}>
              <P style={{ fontFamily: fonts.medium }}>How did the repair go?</P>
              <View style={{ flexDirection: 'row', gap: space(2) }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={run(() => api(`/cases/${kase.id}/rate`, 'POST', { rating: n }))} hitSlop={6}>
                    <Text style={{ fontSize: 32, color: colors.primary }}>★</Text>
                  </Pressable>
                ))}
              </View>
              <Small>The cost is covered by your landlord – nothing for you to pay.</Small>
            </View>
          )}
          {resolved && (
            <Small style={{ textAlign: 'center', color: colors.subtle }}>
              Resolved{kase.rating ? ` · you rated ${'★'.repeat(kase.rating.stars)}` : ''}. This conversation stays in your requests.
            </Small>
          )}
          <ErrorNote error={err} />
        </View>
      </ScrollView>

      {!resolved && (
        <View style={st.chatFooter}>
          <View style={[st.column, { maxWidth: 760, flexDirection: 'row', gap: space(2), alignItems: 'flex-end' }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor={colors.subtle}
              multiline
              style={st.chatInput}
              onKeyPress={(e: any) => enterToSend(e, send)}
            />
            <Pressable onPress={send} disabled={!draft.trim()} style={[st.sendBtn, !draft.trim() && { opacity: 0.3 }]}>
              <Text style={st.sendIcon}>↑</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const Fact = ({ k, v }: { k: string; v: string }) => (
  <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>
    {k} <Text style={{ fontFamily: fonts.medium, color: colors.text }}>{v}</Text>
  </Text>
);

function tenantLabel(status: string) {
  const map: Record<string, string> = {
    reported: 'Received', triaged: 'Received', partner_matched: 'Finding craftsman', awaiting_pm_approval: 'Finding craftsman',
    partner_declined: 'Finding craftsman', escalated: "We're on it", job_sent: 'Craftsman contacted', job_accepted: 'Craftsman found',
    slot_offered: 'Pick a time', no_slot_fits: 'New times coming', slot_confirmed: 'Booked', in_progress: 'Repair underway',
    completed: 'Repaired', invoiced: 'Repaired', closed: 'Resolved',
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------- styles

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  column: { width: '100%', alignSelf: 'center', paddingHorizontal: layout.gutter },
  nav: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong, backgroundColor: colors.background },
  navInner: {
    width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: layout.gutter, height: 68,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  brand: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, letterSpacing: -0.8 },
  brandSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 14, borderRadius: 12 },
  navBtnOn: { backgroundColor: colors.sunken },
  navBtnText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, color: '#fff' },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  link: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },

  composer: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space(5), gap: space(3),
    shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 30, shadowOffset: { width: 0, height: 12 },
  },
  composerInput: {
    minHeight: 132, fontFamily: fonts.body, fontSize: 18, lineHeight: 27, color: colors.text, textAlignVertical: 'top', outlineStyle: 'none',
  } as any,
  composerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#fff', fontSize: 18, fontFamily: fonts.semibold },
  suggest: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  suggestText: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: space(4), padding: space(5), borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  rowTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, letterSpacing: -0.6 },

  chatHeader: { paddingVertical: space(6), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong, backgroundColor: colors.section },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 11 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
  actionCard: {
    alignSelf: 'flex-start', width: '100%', maxWidth: 460, gap: space(4), padding: space(5), borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong,
  },
  chatFooter: { paddingVertical: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong, backgroundColor: colors.background },
  chatInput: {
    flex: 1, minHeight: 44, maxHeight: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: fonts.body, fontSize: 15, color: colors.text, backgroundColor: colors.card, outlineStyle: 'none',
  } as any,
});
