import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { button, card, colors, fonts, layout, radius, shadow, space, statusTone, type } from './theme';
import { fmtWhen } from './api';

export function useWide(min = 900) {
  return useWindowDimensions().width >= min;
}

// ---------------------------------------------------------------- text

type TP = { children: React.ReactNode; style?: TextStyle | TextStyle[]; numberOfLines?: number };

export function Display({ children, style }: TP) {
  const compact = !useWide(640);
  const t = compact ? type.displayCompact : type.display;
  return <Text style={[s.display, { fontSize: t.size, lineHeight: t.line, letterSpacing: t.tracking }, style]}>{children}</Text>;
}
export const H2 = ({ children, style }: TP) => <Text style={[s.h2, style]}>{children}</Text>;
export const H3 = ({ children, style }: TP) => <Text style={[s.h3, style]}>{children}</Text>;
export const P = ({ children, style, numberOfLines }: TP) => (
  <Text numberOfLines={numberOfLines} style={[s.p, style]}>
    {children}
  </Text>
);
export const Muted = ({ children, style, numberOfLines }: TP) => (
  <Text numberOfLines={numberOfLines} style={[s.p, s.muted, style]}>
    {children}
  </Text>
);
export const Small = ({ children, style }: TP) => <Text style={[s.small, style]}>{children}</Text>;
export const Label = ({ children, style }: TP) => <Text style={[s.label, style]}>{children}</Text>;

// ---------------------------------------------------------------- layout

export function Screen({
  children,
  title,
  eyebrow,
  subtitle,
  right,
  maxWidth = 600,
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  right?: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <View style={s.topbar}>
        <View style={[s.topbarInner, { maxWidth }]}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={s.brandRow}>
            <Text style={s.brand}>centrix</Text>
            <View style={s.demoTag}>
              <Text style={s.demoText}>demo</Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>{right}</View>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={[s.titleBlock, { maxWidth }]}>
          {eyebrow ? <Label style={{ marginBottom: space(3) }}>{eyebrow}</Label> : null}
          <Display>{title}</Display>
          {subtitle ? <Muted style={s.subtitle}>{subtitle}</Muted> : null}
        </View>
        <View style={[s.inner, { maxWidth }]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  tone,
  compact,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  tone?: 'accent' | 'sunken';
  compact?: boolean;
}) {
  const narrow = !useWide(640);
  return (
    <View
      style={[
        s.card,
        (compact || narrow) && { padding: layout.cardPaddingCompact },
        tone === 'accent' && { backgroundColor: card.accent.bg, borderColor: card.accent.border, shadowOpacity: 0 },
        tone === 'sunken' && { backgroundColor: card.sunken.bg, borderColor: card.sunken.border, shadowOpacity: 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const Row = ({ children, style, gap = space(2) }: { children: React.ReactNode; style?: ViewStyle; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: 'wrap' }, style]}>{children}</View>
);

export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong, marginVertical: space(2) }} />;

// ---------------------------------------------------------------- controls

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  style,
}: {
  title: string;
  onPress: () => unknown | Promise<unknown>;
  variant?: keyof typeof button.variants;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const [busy, setBusy] = useState(false);
  const v = button.variants[variant];
  const run = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await onPress();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable
      onPress={run}
      disabled={disabled || busy}
      style={({ pressed, hovered }: any) => [
        s.btn,
        { height: button.height[size], paddingHorizontal: button.paddingX[size], backgroundColor: v.bg, borderColor: v.border },
        (pressed || hovered) && { backgroundColor: v.hover },
        (disabled || busy) && { opacity: 0.5 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <Text style={[s.btnText, size === 'sm' && { fontSize: 13 }, size === 'lg' && { fontSize: 16 }, { color: v.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

/** Outlined pill tag, like reltix.de's section labels. */
export const Pill = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[s.pill, style]}>
    <Text style={s.pillText}>{children}</Text>
  </View>
);

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const t = statusTone[status] ?? statusTone.reported;
  return (
    <View style={[s.chip, { backgroundColor: t.bg }]}>
      <View style={[s.dot, { backgroundColor: t.fg }]} />
      <Text style={[s.chipText, { color: t.fg }]}>{label ?? status.replace(/_/g, ' ')}</Text>
    </View>
  );
}

export function Choice({ label, selected, onPress, sub }: { label: string; selected?: boolean; onPress: () => void; sub?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [s.choice, selected && s.choiceOn, hovered && !selected && { borderColor: colors.subtle }]}
    >
      <Text style={[s.choiceText, selected && { color: colors.primaryHover }]}>{label}</Text>
      {sub ? <Text style={[s.choiceSub, selected && { color: colors.primaryHover }]}>{sub}</Text> : null}
    </Pressable>
  );
}

export function Toggle({ value, onChange, label, sub }: { value: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={{ flexDirection: 'row', gap: space(3), alignItems: 'flex-start' }}>
      <View style={[s.switch, value && { backgroundColor: colors.primary }]}>
        <View style={[s.knob, value && { transform: [{ translateX: 16 }] }]} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <P style={{ fontFamily: fonts.medium }}>{label}</P>
        {sub ? <Small>{sub}</Small> : null}
      </View>
    </Pressable>
  );
}

export const KV = ({ k, v, locked }: { k: string; v: React.ReactNode; locked?: boolean }) => (
  <View style={s.kv}>
    <Text style={s.k}>{k}</Text>
    <Text style={[s.v, locked && { color: colors.subtle, fontStyle: 'italic', fontFamily: fonts.body }]}>{v}</Text>
  </View>
);

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <View style={s.error}>
      <Text style={{ color: colors.danger, fontFamily: fonts.medium, fontSize: 14 }}>{error}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- timeline

export type TimelineItem = { id: string; title: string; sub?: string | null; at: string; status?: string; actor?: string };

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <View>
      {items.map((it, i) => {
        const t = statusTone[it.status ?? ''] ?? { fg: colors.subtle, bg: colors.sunken };
        const first = i === 0;
        const last = i === items.length - 1;
        return (
          <View key={it.id} style={{ flexDirection: 'row', gap: space(4) }}>
            <View style={{ alignItems: 'center', width: 10 }}>
              <View style={[s.tlDot, { backgroundColor: first ? t.fg : colors.card, borderColor: first ? t.fg : colors.borderStrong }]} />
              {!last && <View style={s.tlLine} />}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : space(6), gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(2) }}>
                <Text style={[s.p, { fontFamily: fonts.medium, flex: 1, color: first ? colors.ink : colors.text }]}>{it.title}</Text>
                <Small style={{ color: colors.subtle }}>{fmtWhen(it.at)}</Small>
              </View>
              {it.sub ? <Small>{it.sub}</Small> : null}
              {it.actor ? <Small style={{ color: colors.subtle, fontSize: 12 }}>{it.actor}</Small> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Horizontal progress for the tenant: a handful of plain-language steps. */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: space(2) }}>
      {steps.map((label, i) => (
        <View key={label} style={{ flex: 1, gap: space(2) }}>
          <View style={{ height: 2, borderRadius: 1, backgroundColor: i <= current ? colors.primary : colors.border }} />
          <Text style={[s.small, { fontSize: 12, color: i <= current ? colors.ink : colors.subtle, fontFamily: i === current ? fonts.medium : fonts.body }]} numberOfLines={2}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- styles

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topbar: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong, backgroundColor: colors.background },
  topbarInner: {
    width: '100%', alignSelf: 'center', paddingHorizontal: layout.gutter, height: layout.topbarHeight,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  brand: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.5 },
  demoTag: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 },
  demoText: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, letterSpacing: 0.4 },
  scroll: { paddingBottom: space(24) },
  titleBlock: { width: '100%', alignSelf: 'center', paddingHorizontal: layout.gutter, paddingTop: space(14), paddingBottom: space(10) },
  subtitle: { fontSize: 16, lineHeight: 24, marginTop: space(3) },
  inner: { width: '100%', alignSelf: 'center', paddingHorizontal: layout.gutter, gap: layout.sectionGap },
  display: { fontFamily: fonts.display, color: colors.ink },
  h2: { fontFamily: fonts.display, fontSize: type.h2.size, lineHeight: type.h2.line, color: colors.ink, letterSpacing: type.h2.tracking },
  h3: { fontFamily: fonts.semibold, fontSize: type.h3.size, lineHeight: type.h3.line, color: colors.ink },
  p: { fontFamily: fonts.body, fontSize: type.body.size, lineHeight: type.body.line, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: type.small.size, lineHeight: type.small.line, color: colors.muted },
  muted: { color: colors.muted },
  label: { fontFamily: fonts.medium, fontSize: type.label.size, color: colors.muted, textTransform: 'uppercase', letterSpacing: type.label.tracking },
  card: {
    backgroundColor: card.bg, borderRadius: card.radius, borderWidth: 1, borderColor: card.border,
    padding: card.padding, gap: layout.stackGap, ...shadow,
  },
  btn: { borderRadius: button.radius, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.medium, fontSize: 15, letterSpacing: 0.2 },
  pill: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 5 },
  pillText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  chipText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.2 },
  choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 },
  choiceOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceText: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  choiceSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 1 },
  switch: { width: 40, height: 24, borderRadius: 12, backgroundColor: colors.borderStrong, padding: 2, marginTop: 1 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  kv: { flexDirection: 'row', gap: space(4), paddingVertical: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  k: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.muted, width: 120 },
  v: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text, flex: 1 },
  error: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space(4) },
  tlDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, marginTop: 6 },
  tlLine: { flex: 1, width: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong, marginTop: 4 },
});
