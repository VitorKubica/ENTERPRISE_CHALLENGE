import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** Em dispositivo físico (Expo Go), usa o IP da máquina que serve o bundle. */
function baseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:3333`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:3333' : 'http://localhost:3333';
}
export const API_URL = baseUrl();

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    // só declara JSON quando há corpo (o Fastify rejeita POST vazio com esse header)
    headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Algo deu errado. Tente de novo.');
  }
  return res.json() as Promise<T>;
}

export function useApi<T>(path: string, opts: { intervalMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const d = await api<T>(path);
      if (!alive.current) return;
      setData(d);
      setError(null);
    } catch {
      if (alive.current) setError('Não conseguimos falar com o servidor agora.');
    } finally {
      if (alive.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [path]);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    load();
    const id = opts.intervalMs ? setInterval(load, opts.intervalMs) : null;
    return () => {
      alive.current = false;
      if (id) clearInterval(id);
    };
  }, [load, opts.intervalMs]);

  // as abas ficam montadas: relê os dados toda vez que a tela volta ao foco (sem piscar o carregando)
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) first.current = false;
      else load();
    }, [load]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    return load();
  }, [load]);

  return { data, error, loading, refreshing, refresh, reload: load };
}
