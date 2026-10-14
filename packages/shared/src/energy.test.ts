import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attributeSources, solarShare, splitSample } from './energy';
import type { PlantSample } from './types';

const sample = (o: Partial<PlantSample>): PlantSample => ({
  at: '2026-06-10T12:00:00Z', minutes: 60, pvKw: 0, batteryKw: 0, gridKw: 0, loadKw: 0, chargerKw: 0, ...o,
});

test('sol cobre o carregador quando há excedente', () => {
  const s = splitSample(sample({ pvKw: 30, loadKw: 17, chargerKw: 7 }), 'pv_battery_priority');
  assert.equal(s.solarKw, 7);
  assert.equal(s.gridKw, 0);
});

test('cascata sol -> bateria -> rede', () => {
  // base = 10, pv = 13 => excedente 3; carregador 7 => bateria 3 (de 3 disponíveis), rede 1
  const s = splitSample(sample({ pvKw: 13, loadKw: 17, chargerKw: 7, batteryKw: 3 }), 'pv_battery_priority');
  assert.deepEqual([s.solarKw, s.batteryKw, s.gridKw], [3, 3, 1]);
});

test('pv_priority não usa a bateria', () => {
  const s = splitSample(sample({ pvKw: 0, loadKw: 7, chargerKw: 7, batteryKw: 5 }), 'pv_priority');
  assert.equal(s.batteryKw, 0);
  assert.equal(s.gridKw, 7);
});

test('solar + bateria + rede == energia total', () => {
  const samples = [
    sample({ pvKw: 20, loadKw: 17, chargerKw: 7, minutes: 30 }),
    sample({ pvKw: 5, loadKw: 17, chargerKw: 7, batteryKw: 2, minutes: 45 }),
  ];
  const src = attributeSources(samples, 'pv_battery_priority');
  const total = (7 * 30 + 7 * 45) / 60;
  assert.ok(Math.abs(src.solarKwh + src.batteryKwh + src.gridKwh - total) < 0.002);
});

test('sem planta GoodWe (sem sol nem bateria) tudo vem da rede', () => {
  const src = attributeSources([sample({ pvKw: 0, batteryKw: 0, loadKw: 7, chargerKw: 7 })], 'pv_battery_priority');
  assert.equal(solarShare(src), 0);
  assert.equal(src.gridKwh, 7);
});
