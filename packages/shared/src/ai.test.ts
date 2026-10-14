import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clusterProfiles, detectAnomalies, forecastOccupancy, userFeatures } from './ai';
import type { Session, User } from './types';

function mkSession(i: number, kwh: number, minutes: number, status: Session['status'] = 'completed', userId = 'u', hour = 18): Session {
  const start = Date.parse(`2026-06-01T${String(hour).padStart(2, '0')}:00:00`) + i * 86400000;
  return {
    id: `s${i}`, userId, chargerId: 'c', startAt: new Date(start).toISOString(),
    endAt: new Date(start + minutes * 60000).toISOString(), energyKwh: kwh, peakPowerKw: 7, avgPowerKw: 7,
    chargeMode: 'pv_priority', status, sources: { solarKwh: 0, batteryKwh: 0, gridKwh: kwh },
  };
}

test('anomalias: acha medição absurda e sessão com falha, ignora as normais', () => {
  const normal = Array.from({ length: 20 }, (_, i) => mkSession(i, 14 + (i % 3), 120 + (i % 4) * 5));
  const bad = mkSession(30, 80, 60); // 80 kWh em 1h
  const err = mkSession(31, 1, 20, 'error');
  const all = detectAnomalies([...normal, bad, err]);
  const found = all.map((a) => a.sessionId);
  assert.ok(found.includes('s30'));
  assert.ok(found.includes('s31'));
  assert.equal(found.filter((id) => !['s30', 's31'].includes(id)).length, 0);
  // leitura absurda e falha do carregador corrompem o rateio: ficam retidas
  assert.equal(all.find((a) => a.sessionId === 's30')!.holdBilling, true);
  assert.equal(all.find((a) => a.sessionId === 's31')!.holdBilling, true);
});

test('anomalias: carro parado conectado não retém a cobrança (o kWh é pequeno e correto)', () => {
  const normal = Array.from({ length: 20 }, (_, i) => mkSession(i, 14 + (i % 3), 120 + (i % 4) * 5));
  const idle = mkSession(40, 5, 14 * 60); // 5 kWh em 14 horas conectado
  const found = detectAnomalies([...normal, idle]).find((a) => a.sessionId === 's40');
  assert.ok(found);
  assert.deepEqual(found!.kinds, ['ociosa']);
  assert.equal(found!.holdBilling, false);
});

test('anomalias: usa a base de cada morador, então quem carrega rápido sempre não é suspeito', () => {
  // Ana carrega 9 kWh em 50 min (rápido) sempre; Beto carrega 18 kWh em 150 min sempre
  const ana = Array.from({ length: 12 }, (_, i) => mkSession(i, 9 + (i % 2) * 0.2, 50, 'completed', 'ana'));
  const beto = Array.from({ length: 12 }, (_, i) => mkSession(100 + i, 18 + (i % 2) * 0.3, 150, 'completed', 'beto'));
  assert.equal(detectAnomalies([...ana, ...beto]).length, 0);
});

test('perfis: separa quem carrega de dia de quem carrega à noite', () => {
  const users: User[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, unit: '', vehicle: '' }));
  const day = (id: string) => Array.from({ length: 10 }, (_, i) => mkSession(i, 12, 120, 'completed', id, 11));
  const night = (id: string) => Array.from({ length: 10 }, (_, i) => mkSession(50 + i, 20, 300, 'completed', id, 22));
  const profiles = clusterProfiles(userFeatures([...day('a'), ...day('b'), ...night('c'), ...night('d')], users), 2);
  const by = Object.fromEntries(profiles.map((p) => [p.userId, p]));
  assert.equal(by.a.cluster, by.b.cluster);
  assert.equal(by.c.cluster, by.d.cluster);
  assert.notEqual(by.a.cluster, by.c.cluster);
  assert.equal(by.a.label, 'Carrega com o sol');
  assert.equal(by.c.label, 'Carrega à noite');
});

test('previsão: dia com sessão sempre às 18h tem pico às 18h', () => {
  const sessions = Array.from({ length: 56 }, (_, i) => mkSession(i, 14, 120));
  const f = forecastOccupancy(sessions, new Date('2026-07-28T12:00:00'), 7);
  assert.equal(f.length, 7);
  assert.ok(f.every((d) => d.peakHour === 18 || d.peakHour === 19));
});

test('previsão: com 2 carregadores, uma sessão por dia ocupa ~50% no pico', () => {
  const sessions = Array.from({ length: 56 }, (_, i) => mkSession(i, 14, 120));
  const f = forecastOccupancy(sessions, new Date('2026-07-28T12:00:00'), 7, 8, 2);
  assert.ok(f.every((d) => d.peakPct <= 51 && d.peakPct >= 43));
});
