// Day-column calendar: an hour axis on the left, one column per day, and
// blocks for everything the partner already has. Free time is simply the
// empty space – tap it (when picking) to propose a window there.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fmtTime } from './api';
import { colors, fonts, radius } from './theme';

export type CalEvent = {
  id: string;
  start: string;
  end: string;
  title: string;
  sub?: string;
  kind: 'visit' | 'busy' | 'offered' | 'proposal';
  onPress?: () => void;
};

type Props = {
  days: Date[];
  events: CalEvent[];
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
  colWidth?: number;
  workingHours?: { weekday: number[]; saturday: number[] };
  /** When set, empty working time is tappable: (start of the hour tapped) */
  onPickTime?: (start: Date) => void;
  pickHours?: number;
};

const KIND = {
  visit: { bg: '#F4EEF3', border: colors.primary, title: colors.ink, sub: colors.muted },
  busy: { bg: '#EFE8E1', border: '#CDBFB2', title: colors.text, sub: colors.muted },
  offered: { bg: colors.accentSoft, border: colors.accent, title: colors.text, sub: colors.muted },
  proposal: { bg: colors.accent, border: colors.accentHover, title: '#fff', sub: 'rgba(255,255,255,0.85)' },
};

export default function CalendarGrid({
  days, events, startHour = 7, endHour = 19, hourHeight = 52, colWidth = 168, workingHours, onPickTime, pickHours = 2,
}: Props) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const bodyH = hours.length * hourHeight;
  const now = Date.now();
  const span = (d: Date) => {
    const dow = d.getDay();
    const wh = workingHours ?? { weekday: [7, 18], saturday: [8, 13] };
    return dow === 0 ? null : dow === 6 ? wh.saturday : wh.weekday;
  };

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* hour axis */}
      <View style={{ width: 52, paddingTop: HEADER }}>
        {hours.map((h) => (
          <View key={h} style={{ height: hourHeight }}>
            <Text style={st.hour}>{`${String(h).padStart(2, '0')}.00`}</Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
        {days.map((day) => {
          const dayStart = new Date(day);
          dayStart.setHours(0, 0, 0, 0);
          const isToday = dayStart.toDateString() === new Date().toDateString();
          const work = span(dayStart);
          const dayEvents = events.filter((e) => new Date(e.start).toDateString() === dayStart.toDateString());
          const y = (iso: string) => {
            const d = new Date(iso);
            return (d.getHours() + d.getMinutes() / 60 - startHour) * hourHeight;
          };
          return (
            <View key={dayStart.toISOString()} style={{ width: colWidth }}>
              <View style={st.head}>
                <View style={[st.badge, isToday && { backgroundColor: colors.primary }]}>
                  <Text style={[st.badgeText, isToday && { color: '#fff' }]}>{dayStart.getDate()}</Text>
                </View>
                <View>
                  <Text style={st.dayName}>{dayStart.toLocaleDateString('en-GB', { weekday: 'long' })}</Text>
                  <Text style={st.dayDate}>{isToday ? 'Today' : dayStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
                </View>
              </View>
              <View style={[st.body, { height: bodyH }]}>
                {/* hour lines + (when picking) tappable free hours */}
                {hours.map((h) => {
                  const s = new Date(dayStart);
                  s.setHours(h, 0, 0, 0);
                  const e = new Date(s.getTime() + pickHours * 3600e3);
                  const inWork = !!work && h >= work[0] && h + pickHours <= work[1];
                  const clash = dayEvents.some((ev) => s.getTime() < new Date(ev.end).getTime() && e.getTime() > new Date(ev.start).getTime());
                  const pickable = !!onPickTime && inWork && !clash && s.getTime() > now + 2 * 3600e3;
                  return (
                    <Pressable
                      key={h}
                      disabled={!pickable}
                      onPress={() => onPickTime?.(s)}
                      style={({ hovered }: any) => [
                        st.cell,
                        { top: (h - startHour) * hourHeight, height: hourHeight },
                        !(work && h >= work[0] && h < work[1]) && { backgroundColor: '#ECE6E0' },
                        pickable && hovered && { backgroundColor: colors.accentSoft },
                      ]}
                    >
                      {({ hovered }: any) => (pickable && hovered ? <Text style={st.plus}>+ {fmtTime(s.toISOString())}–{fmtTime(e.toISOString())}</Text> : null)}
                    </Pressable>
                  );
                })}
                {s_now(isToday, startHour, endHour, hourHeight)}
                {dayEvents.map((ev) => {
                  const k = KIND[ev.kind];
                  const top = Math.max(0, y(ev.start));
                  const height = Math.max(26, Math.min(bodyH, y(ev.end)) - top - 3);
                  return (
                    <Pressable
                      key={ev.id}
                      onPress={ev.onPress}
                      disabled={!ev.onPress}
                      style={({ hovered, pressed }: any) => [
                        st.event,
                        { top: top + 1, height, backgroundColor: k.bg, borderLeftColor: k.border },
                        ev.kind === 'offered' && { borderStyle: 'dashed', borderWidth: 1, borderColor: colors.accent, borderLeftWidth: 3 },
                        ev.onPress && hovered && { borderLeftWidth: 4, shadowColor: colors.ink, shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
                        ev.onPress && pressed && { opacity: 0.85 },
                        ev.onPress ? ({ cursor: 'pointer' } as any) : null,
                      ]}
                    >
                      <Text style={[st.evTime, { color: k.sub }]}>
                        {fmtTime(ev.start).replace(':', '.')} – {fmtTime(ev.end).replace(':', '.')}
                      </Text>
                      <Text style={[st.evTitle, { color: k.title }]} numberOfLines={height > 50 ? 2 : 1}>
                        {ev.title}
                      </Text>
                      {ev.sub && height > 60 ? (
                        <Text style={[st.evSub, { color: k.sub }]} numberOfLines={1}>
                          {ev.sub}
                          {ev.onPress ? ' · tap for details' : ''}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// red "now" line on today's column
function s_now(isToday: boolean, startHour: number, endHour: number, hh: number) {
  if (!isToday) return null;
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < startHour || h > endHour) return null;
  return <View pointerEvents="none" style={[st.now, { top: (h - startHour) * hh }]} />;
}

const HEADER = 56;

const st = StyleSheet.create({
  hour: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle, marginTop: -7 },
  head: { height: HEADER, flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  dayName: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  dayDate: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  body: { position: 'relative', backgroundColor: colors.section, borderRadius: radius.sm, overflow: 'hidden' },
  cell: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, justifyContent: 'center', paddingLeft: 8 },
  plus: { fontFamily: fonts.medium, fontSize: 12, color: colors.accentHover },
  event: { position: 'absolute', left: 4, right: 4, borderRadius: 6, borderLeftWidth: 3, paddingHorizontal: 8, paddingVertical: 5, overflow: 'hidden' },
  evTime: { fontFamily: fonts.body, fontSize: 11 },
  evTitle: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17 },
  evSub: { fontFamily: fonts.body, fontSize: 12 },
  now: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colors.danger },
});
