import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

// Works on the laptop (web) and on phones in Expo Go: the API runs on the same
// machine as Metro, so reuse Metro's host. Override with EXPO_PUBLIC_API_URL.
function resolveBase(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:4000`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000`;
}

export const API = resolveBase();

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

/** Poll an endpoint every few seconds; `refresh()` re-fetches right away. */
export function usePoll<T = any>(path: string | null, intervalMs = 2500) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const refresh = useCallback(async () => {
    const p = pathRef.current;
    if (!p) return;
    try {
      const d = await api<T>(p);
      if (pathRef.current === p) {
        setData(d);
        setError(null);
      }
    } catch (e: any) {
      setError(e.message ?? 'Network error');
    }
  }, []);

  useEffect(() => {
    setData(null);
    refresh();
    if (!path) return;
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
  }, [path, intervalMs, refresh]);

  return { data, error, refresh };
}

// ---------- formatting helpers

// Weekday for recent dates, the year for anything outside this year.
export const fmtDay = (iso: string) => {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', sameYear ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const fmtSlot = (s: { start: string; end: string }) => `${fmtDay(s.start)} · ${fmtTime(s.start)}–${fmtTime(s.end)}`;
export const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? fmtTime(iso) : `${fmtDay(iso)}, ${fmtTime(iso)}`;
};
export const eur = (n: number) => `€${n.toFixed(2)}`;
