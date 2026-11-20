import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Muted, Pill, Screen, Button, Row, ErrorNote } from '../lib/ui';
import { colors, fonts } from '../lib/theme';
import { API, api, usePoll } from '../lib/api';
import { useState } from 'react';

const ROLES = [
  { href: '/tenant', who: 'Tenant portal', name: 'Lena Hoffmann', device: 'Phone', text: 'Report a problem in one sentence, pick a slot in one tap.' },
  { href: '/partner', who: 'Partner app', name: 'Heating engineer', device: 'Phone', text: 'Get a pre-filled job, offer slots, finish and invoice.' },
  { href: '/centrix', who: 'centrix workspace', name: 'reltix property manager', device: 'Laptop', text: 'See the AI suggestion, approve in one click, watch it close.' },
] as const;

export default function RolePicker() {
  const health = usePoll<{ ok: boolean }>('/health', 5000);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Screen title="Fix-it Flow" subtitle="Broken heater → craftsman, with zero forms. Pick who you are for this demo.">
      <Pill>Plug a partner into centrix</Pill>
      {ROLES.map((r) => (
        <Pressable key={r.href} onPress={() => router.push(r.href)}>
          {({ hovered }: any) => (
            <Card style={hovered ? { borderColor: colors.primary } : undefined}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.ink, letterSpacing: -0.5 }}>{r.who}</Text>
                <Text style={{ fontFamily: fonts.medium, color: colors.primary, fontSize: 20 }}>→</Text>
              </Row>
              <Muted>
                {r.name} · {r.device}
              </Muted>
              <Text style={{ fontFamily: fonts.body, color: colors.text, fontSize: 15 }}>{r.text}</Text>
            </Card>
          )}
        </Pressable>
      ))}
      <View style={{ gap: 12, marginTop: 16 }}>
        <Muted style={{ fontSize: 13 }}>
          API {API} · {health.data?.ok ? 'connected' : health.error ? 'not reachable – start the server' : 'connecting…'}
        </Muted>
        <ErrorNote error={msg} />
        <Row>
          <Button
            title="Reset demo data"
            variant="secondary"
            size="sm"
            onPress={async () => {
              try {
                await api('/demo/reset', 'POST');
                setMsg(null);
              } catch (e: any) {
                setMsg(e.message);
              }
            }}
          />
        </Row>
      </View>
    </Screen>
  );
}
