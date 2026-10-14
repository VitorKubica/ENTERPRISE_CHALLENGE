import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcInvoices, sessionCost } from './billing';
import type { Tariffs } from './types';

const tariffs: Tariffs = { solarKwh: 0.3, batteryKwh: 0.55, gridKwh: 1, demandCostCycle: 100, platformFeeCycle: 20, publicKwh: 2 };
const bs = (userId: string, solar: number, grid: number, peak: number) => ({
  userId, energyKwh: solar + grid, peakPowerKw: peak, sources: { solarKwh: solar, batteryKwh: 0, gridKwh: grid },
});

test('rateio by_source cobra cada origem pela sua tarifa e divide demanda/taxa', () => {
  const inv = calcInvoices([bs('a', 10, 0, 6), bs('b', 0, 10, 4)], tariffs, 'by_source', '2026-06');
  const a = inv.find((i) => i.userId === 'a')!;
  const b = inv.find((i) => i.userId === 'b')!;
  assert.equal(a.energyCostBrl, 3); // 10 * 0.30
  assert.equal(b.energyCostBrl, 10); // 10 * 1.00
  assert.equal(a.demandCostBrl, 60); // 6/10 * 100
  assert.equal(a.platformFeeBrl, 10);
  assert.equal(a.savingsBrl, 7);
  assert.equal(b.savingsBrl, 0);
});

test('rateio single divide proporcionalmente ao kWh', () => {
  const inv = calcInvoices([bs('a', 0, 30, 6), bs('b', 0, 10, 6)], tariffs, 'single', '2026-06');
  assert.equal(inv.find((i) => i.userId === 'a')!.energyCostBrl, 30);
  assert.equal(inv.find((i) => i.userId === 'b')!.energyCostBrl, 10);
});

test('quem não carregou no ciclo não aparece e a taxa fixa só é dividida entre ativos', () => {
  const inv = calcInvoices([bs('a', 5, 5, 6)], tariffs, 'by_source', '2026-06');
  assert.equal(inv.length, 1);
  assert.equal(inv[0].platformFeeBrl, 20);
  assert.deepEqual(calcInvoices([], tariffs, 'by_source', '2026-06'), []);
});

test('a soma das faturas cobre a demanda e a taxa do ciclo inteiros', () => {
  const inv = calcInvoices([bs('a', 8, 2, 6), bs('b', 0, 10, 4), bs('c', 3, 7, 5)], tariffs, 'by_source', '2026-06');
  const demand = inv.reduce((s, i) => s + i.demandCostBrl, 0);
  const fee = inv.reduce((s, i) => s + i.platformFeeBrl, 0);
  assert.ok(Math.abs(demand - 100) < 0.05);
  assert.ok(Math.abs(fee - 20) < 0.05);
});

test('economia da sessão compara com o eletroposto da rede', () => {
  const { costBrl, savingsBrl } = sessionCost({ solarKwh: 10, batteryKwh: 0, gridKwh: 0 }, tariffs);
  assert.equal(costBrl, 3);
  assert.equal(savingsBrl, 7);
});
