// centrix Insights: live and historic numbers across the portfolio.
// Charts follow one rule set: thin marks, one axis per chart, legends for 2+
// series plus direct end labels, hover tooltips, and a table view.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { fmtDay, usePoll } from './api';
import { Card, Display, ErrorNote, Label, Muted, P, Small, useWide } from './ui';
import { colors, fonts, radius, space } from './theme';

// Chart colours: a validated categorical order (blue, orange); text never wears series colour.
const SERIES = { new: '#2a78d6', resolved: '#eb6834', backlog: colors.ink, routine: '#2a78d6', urgent: '#eb6834', bar: '#2a78d6' };
const GRID = '#EDE4DB';

export default function Insights({ openUnit }: { openUnit: (unitId: string) => void }) {
  const wide = useWide(980);
  const [city, setCity] = useState('all');
  const [weeks, setWeeks] = useState(26);
  const { data, error } = usePoll<any>(`/stats?city=${encodeURIComponent(city)}&weeks=${weeks}`, 5000);

  return (
    <View style={[st.column, { paddingTop: space(14), gap: space(8) }]}>
      <View style={{ gap: space(3) }}>
        <Display>Insights</Display>
        <Muted style={{ fontSize: 17 }}>Repairs, partners and deadlines across the portfolio.</Muted>
      </View>

      {/* filters: one row, above every chart */}
      <View style={st.filters}>
        <Segment value={city} onChange={setCity} options={[['all', 'All cities'], ...((data?.cities ?? []) as string[]).map((c) => [c, c])]} />
        <View style={{ flex: 1 }} />
        <Segment value={String(weeks)} onChange={(v) => setWeeks(Number(v))} options={[['13', '3 months'], ['26', '6 months'], ['52', '12 months']]} />
        {data && (
          <View style={st.live}>
            <View style={[st.liveDot]} />
            <Small>Live · {new Date(data.generated_at).toLocaleTimeString('en-GB')}</Small>
          </View>
        )}
      </View>
      <ErrorNote error={error} />
      {!data ? (
        <Muted>Loading…</Muted>
      ) : (
        <>
          <Kpis k={data.kpis} />

          <View style={{ flexDirection: wide ? 'row' : 'column', gap: space(6) }}>
            <Card style={{ flex: 1 }}>
              <ChartHeader title="Unsolved cases" sub="Open at the end of each week" />
              <LineChart
                weeks={data.series.map((s: any) => s.week)}
                series={[{ key: 'open', name: 'Unsolved', color: SERIES.backlog, values: data.series.map((s: any) => s.open) }]}
                area
              />
            </Card>
            <Card style={{ flex: 1 }}>
              <ChartHeader title="New and resolved" sub="Cases per week" />
              <LineChart
                weeks={data.series.map((s: any) => s.week)}
                series={[
                  { key: 'new', name: 'New', color: SERIES.new, values: data.series.map((s: any) => s.new) },
                  { key: 'resolved', name: 'Resolved', color: SERIES.resolved, values: data.series.map((s: any) => s.resolved) },
                ]}
              />
            </Card>
          </View>

          <View style={{ flexDirection: wide ? 'row' : 'column', gap: space(6) }}>
            <Card style={{ flex: 3 }}>
              <ChartHeader title="Open cases by city" sub="Urgent = emergency or high urgency" />
              <Legend items={[{ name: 'Urgent', color: SERIES.urgent }, { name: 'Routine', color: SERIES.routine }]} />
              <CityBars rows={data.by_city} highlight={city} onPick={(c) => setCity(c === city ? 'all' : c)} />
            </Card>
            <Card style={{ flex: 2 }}>
              <ChartHeader title="Open by urgency" sub={city === 'all' ? 'All cities' : city} />
              <Bars rows={data.by_urgency.map((u: any) => ({ label: cap(u.urgency), value: u.open }))} />
              <Label style={{ marginTop: space(2) }}>Open by trade</Label>
              <Bars rows={data.by_trade.map((t: any) => ({ label: cap(t.trade), value: t.open }))} />
            </Card>
          </View>

          <View style={{ flexDirection: wide ? 'row' : 'column', gap: space(6) }}>
            <Card style={{ flex: 3 }}>
              <ChartHeader title="Partners" sub="Last 90 days" />
              <PartnerTable rows={data.partners} />
            </Card>
            <Card style={{ flex: 2 }}>
              <ChartHeader title="Partner changes" sub="Joins, declines and rating moves" />
              {data.partner_changes.length === 0 && <Muted>No changes recently.</Muted>}
              {data.partner_changes.map((c: any, i: number) => (
                <Pressable key={i} onPress={() => c.unit_id && openUnit(c.unit_id)} style={[st.changeRow, i > 0 && st.rowBorder]}>
                  <Text style={st.changeIcon}>{c.kind === 'joined' ? '＋' : c.kind === 'reassigned' ? '⇄' : c.kind === 'rating_up' ? '↑' : '↓'}</Text>
                  <View style={{ flex: 1 }}>
                    <P style={{ fontSize: 14 }}>{c.text}</P>
                    <Small>{fmtDay(c.at)}</Small>
                  </View>
                </Pressable>
              ))}
            </Card>
          </View>

          <Card>
            <ChartHeader
              title="Upcoming deadlines"
              sub={`${data.deadlines.total} in the next 120 days · ${data.deadlines.next_30d} within 30 days`}
            />
            <Deadlines items={data.deadlines.items} openUnit={openUnit} />
          </Card>
        </>
      )}
    </View>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- pieces

function Segment({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <View style={st.segment}>
      {options.map(([v, l]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={({ hovered }: any) => [st.segBtn, v === value && st.segOn, hovered && v !== value && { backgroundColor: colors.sunken }]}>
          <Text style={[st.segText, v === value && { color: '#fff' }]}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ChartHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={st.chartTitle}>{title}</Text>
      {sub ? <Small>{sub}</Small> : null}
    </View>
  );
}

function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: space(4), flexWrap: 'wrap' }}>
      {items.map((i) => (
        <View key={i.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: i.color }} />
          <Small style={{ color: colors.text }}>{i.name}</Small>
        </View>
      ))}
    </View>
  );
}

function Kpis({ k }: { k: any }) {
  const delta = k.new_7d - k.new_prev_7d;
  const tiles = [
    { label: 'Unsolved now', value: k.open, sub: 'open cases' },
    { label: 'Urgent', value: k.urgent_open, sub: 'emergency or high' },
    { label: 'New this week', value: k.new_7d, sub: `${delta >= 0 ? '+' : ''}${delta} vs last week` },
    { label: 'Resolved this week', value: k.resolved_7d, sub: 'cases closed' },
    { label: 'Time to resolve', value: k.median_days_to_resolve != null ? `${k.median_days_to_resolve} d` : '—', sub: 'median, 90 days' },
    { label: 'Needs you', value: k.awaiting_pm, sub: 'approval or reply' },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(4) }}>
      {tiles.map((t) => (
        <View key={t.label} style={st.tile}>
          <Label>{t.label}</Label>
          <Text style={st.tileValue}>{t.value}</Text>
          <Small>{t.sub}</Small>
        </View>
      ))}
    </View>
  );
}

type Series = { key: string; name: string; color: string; values: number[] };

/** Line chart with one y-axis, crosshair tooltip on hover/tap, legend for 2+ series and a table view. */
function LineChart({ weeks, series, area }: { weeks: string[]; series: Series[]; area?: boolean }) {
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const h = 200;
  const pad = { l: 34, r: series.length > 1 ? 70 : 16, t: 12, b: 26 };
  const max = Math.max(4, ...series.flatMap((s) => s.values));
  const niceMax = Math.ceil(max / 10) * 10; // even, so the middle gridline is a whole number
  const n = weeks.length;
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (w - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / niceMax) * (h - pad.t - pad.b);
  const ticks = [0, niceMax / 2, niceMax];
  // first week of each month; drop the partial first month if the next label is too close
  const monthTicks = useMemo(() => {
    const t = weeks.map((wk, i) => ({ i, d: new Date(wk) })).filter(({ d }) => d.getDate() <= 7);
    return n > 30 ? t.filter((_, k) => k % 2 === 0) : t;
  }, [weeks, n]);

  return (
    <View style={{ gap: space(3) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {series.length > 1 ? <Legend items={series} /> : <View />}
        <Pressable onPress={() => setTable(!table)}>
          <Text style={st.link}>{table ? 'Show chart' : 'Show table'}</Text>
        </Pressable>
      </View>
      {table ? (
        <View>
          <View style={[st.tr, { borderTopWidth: 0 }]}>
            <Text style={[st.th, { flex: 2 }]}>Week of</Text>
            {series.map((s) => (
              <Text key={s.key} style={[st.th, { flex: 1, textAlign: 'right' }]}>{s.name}</Text>
            ))}
          </View>
          {weeks.slice().reverse().slice(0, 12).map((wk, ri) => {
            const i = n - 1 - ri;
            return (
              <View key={wk} style={st.tr}>
                <Text style={[st.td, { flex: 2 }]}>{fmtDay(wk)}</Text>
                {series.map((s) => (
                  <Text key={s.key} style={[st.td, { flex: 1, textAlign: 'right' }]}>{s.values[i]}</Text>
                ))}
              </View>
            );
          })}
        </View>
      ) : (
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: h }}>
          {w > 0 && (
            <>
              <Svg width={w} height={h}>
                {ticks.map((t) => (
                  <G key={t}>
                    <Line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                    <SvgText x={pad.l - 8} y={y(t) + 4} fontSize={11} fill={colors.muted} textAnchor="end" fontFamily={fonts.body}>
                      {t}
                    </SvgText>
                  </G>
                ))}
                {monthTicks.map(({ i, d }) => (
                  <SvgText key={i} x={x(i)} y={h - 6} fontSize={11} fill={colors.muted} textAnchor="middle" fontFamily={fonts.body}>
                    {d.toLocaleDateString('en-GB', { month: 'short' })}
                  </SvgText>
                ))}
                {series.map((s) => {
                  const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
                  return (
                    <G key={s.key}>
                      {area && <Path d={`${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={s.color} opacity={0.07} />}
                      <Path d={d} stroke={s.color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                      {/* direct label at the line end */}
                      {series.length > 1 && (
                        <SvgText x={x(n - 1) + 8} y={y(s.values[n - 1]) + 4} fontSize={11} fill={colors.text} fontFamily={fonts.medium}>
                          {s.name} {s.values[n - 1]}
                        </SvgText>
                      )}
                      <Circle cx={x(n - 1)} cy={y(s.values[n - 1])} r={4} fill={s.color} stroke={colors.card} strokeWidth={2} />
                    </G>
                  );
                })}
                {hover != null && (
                  <G>
                    <Line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={h - pad.b} stroke={colors.subtle} strokeWidth={1} strokeDasharray="3,3" />
                    {series.map((s) => (
                      <Circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} stroke={colors.card} strokeWidth={2} />
                    ))}
                  </G>
                )}
                <Rect x={0} y={0} width={w} height={h} fill="transparent" />
              </Svg>
              {/* hit areas: one column per week, wider than the line */}
              <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', left: pad.l - (w - pad.l - pad.r) / (2 * (n - 1)), right: pad.r - (w - pad.l - pad.r) / (2 * (n - 1)) }]}>
                {weeks.map((wk, i) => (
                  <Pressable key={wk} style={{ flex: 1 }} onHoverIn={() => setHover(i)} onHoverOut={() => setHover((h0) => (h0 === i ? null : h0))} onPress={() => setHover(i)} />
                ))}
              </View>
              {hover != null && (
                <View pointerEvents="none" style={[st.tooltip, { left: Math.min(Math.max(x(hover) - 70, 0), w - 150), top: 0 }]}>
                  <Text style={st.tipTitle}>Week of {fmtDay(weeks[hover])}</Text>
                  {series.map((s) => (
                    <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
                      <Text style={st.tipText}>
                        {s.name}: <Text style={{ fontFamily: fonts.semibold }}>{s.values[hover]}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

/** Horizontal stacked bars: urgent + routine open cases per city. Tap a city to filter. */
function CityBars({ rows, highlight, onPick }: { rows: any[]; highlight: string; onPick: (city: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.open));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <View style={{ gap: space(3) }}>
      {rows.map((r) => {
        const dim = highlight !== 'all' && highlight !== r.city;
        return (
          <Pressable key={r.city} onPress={() => onPick(r.city)} onHoverIn={() => setHover(r.city)} onHoverOut={() => setHover(null)} style={{ gap: 4, opacity: dim ? 0.4 : 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={st.barLabel}>{r.city}</Text>
              <Small>
                {hover === r.city ? `${r.urgent} urgent · ${r.routine} routine · ${r.units} units · ${r.last_90d} cases in 90 days` : `${r.open} open`}
              </Small>
            </View>
            <View style={{ flexDirection: 'row', height: 12, gap: 2 }}>
              {r.urgent > 0 && <View style={{ width: `${(r.urgent / max) * 100}%`, backgroundColor: SERIES.urgent, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: r.routine ? 0 : 4, borderBottomRightRadius: r.routine ? 0 : 4 }} />}
              {r.routine > 0 && <View style={{ width: `${(r.routine / max) * 100}%`, backgroundColor: SERIES.routine, borderTopRightRadius: 4, borderBottomRightRadius: 4, borderTopLeftRadius: r.urgent ? 0 : 4, borderBottomLeftRadius: r.urgent ? 0 : 4 }} />}
              {r.open === 0 && <View style={{ width: 2, backgroundColor: GRID }} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: space(2) }}>
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <Text style={[st.barLabel, { width: 84 }]}>{r.label}</Text>
          <View style={{ flex: 1, height: 10, justifyContent: 'center' }}>
            <View style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0, height: 10, borderRadius: 4, backgroundColor: SERIES.bar }} />
          </View>
          <Text style={[st.barValue]}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

function PartnerTable({ rows }: { rows: any[] }) {
  const cols = [
    ['Partner', 3],
    ['Jobs', 1],
    ['Open', 1],
    ['Declined', 1],
    ['Avg days', 1],
    ['Rating', 1.3],
  ] as const;
  return (
    <View>
      <View style={[st.tr, { borderTopWidth: 0 }]}>
        {cols.map(([c, f], i) => (
          <Text key={c} style={[st.th, { flex: f, textAlign: i ? 'right' : 'left' }]}>{c}</Text>
        ))}
      </View>
      {rows.map((p) => (
        <View key={p.id} style={st.tr}>
          <View style={{ flex: 3 }}>
            <Text style={[st.td, { fontFamily: fonts.medium }]} numberOfLines={1}>{p.name}</Text>
            <Small style={{ fontSize: 11 }}>{p.trades.join(', ')} · since {fmtDay(p.joined_at)}</Small>
          </View>
          <Text style={[st.td, st.num]}>{p.jobs_90d}</Text>
          <Text style={[st.td, st.num]}>{p.open}</Text>
          <Text style={[st.td, st.num]}>{p.declined_90d}</Text>
          <Text style={[st.td, st.num]}>{p.avg_days ?? '—'}</Text>
          <Text style={[st.td, st.num, { flex: 1.3 }]}>
            {p.rating}★{p.rating_change_90d ? ` ${p.rating_change_90d > 0 ? '↑' : '↓'}${Math.abs(p.rating_change_90d)}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

const KINDS = [
  ['all', 'All'],
  ['lease_end', 'Leases'],
  ['service_contract', 'Service contracts'],
  ['certificate', 'Certificates'],
  ['maintenance', 'Heating service'],
];

function Deadlines({ items, openUnit }: { items: any[]; openUnit: (id: string) => void }) {
  const [kind, setKind] = useState('all');
  const list = items.filter((d) => kind === 'all' || d.kind === kind).slice(0, 15);
  return (
    <View style={{ gap: space(3) }}>
      <Segment value={kind} onChange={setKind} options={KINDS} />
      {list.length === 0 && <Muted>Nothing due.</Muted>}
      {list.map((d, i) => {
        const tone = d.days_left <= 7 ? { fg: colors.danger, bg: colors.dangerSoft } : d.days_left <= 30 ? { fg: colors.warning, bg: colors.warningSoft } : { fg: colors.muted, bg: colors.sunken };
        return (
          <Pressable key={i} onPress={() => d.unit_id && openUnit(d.unit_id)} style={({ hovered }: any) => [st.deadline, i > 0 && st.rowBorder, hovered && { backgroundColor: colors.section }]}>
            <View style={[st.days, { backgroundColor: tone.bg }]}>
              <Text style={[st.daysNum, { color: tone.fg }]}>{d.days_left <= 0 ? 'Today' : `${d.days_left} d`}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={st.td} numberOfLines={1}>
                <Text style={{ fontFamily: fonts.medium }}>{d.label}:</Text> {d.title}
              </Text>
              <Small numberOfLines={1}>
                {d.where}, {d.city} · {fmtDay(d.due)} · {d.note}
              </Small>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  column: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: 20 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(3) },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignSelf: 'flex-start' },
  segBtn: { paddingHorizontal: 12, height: 32, borderRadius: 8, justifyContent: 'center' },
  segOn: { backgroundColor: colors.primary },
  segText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  tile: { flexGrow: 1, flexBasis: 170, gap: 4, padding: space(5), borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  tileValue: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.ink, letterSpacing: -1.5 },
  chartTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, letterSpacing: -0.6 },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
  tooltip: { position: 'absolute', width: 150, gap: 4, padding: 10, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  tipTitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  tipText: { fontFamily: fonts.body, fontSize: 13, color: colors.text },
  barLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  barValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, width: 28, textAlign: 'right' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(2), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  th: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  td: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  num: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  changeRow: { flexDirection: 'row', gap: space(3), paddingVertical: space(3), alignItems: 'flex-start' },
  changeIcon: { width: 22, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, textAlign: 'center' },
  deadline: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingVertical: space(3), paddingHorizontal: space(1) },
  days: { width: 64, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  daysNum: { fontFamily: fonts.semibold, fontSize: 13 },
});
