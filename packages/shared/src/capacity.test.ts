import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCapacity } from './capacity';

test('capacidade: pico saturado => sem folga e compartilhado vence a partir de N moradores', () => {
  const plan = planCapacity({
    chargers: 4, residents: 12, waitingList: 5, peakOccupancy: 0.95,
    capexSharedCharger: 18000, capexIndividual: 8500,
  });
  assert.ok(plan.saturated);
  assert.ok(plan.headroom < 0);
  assert.ok(plan.unserved >= 5);
  assert.ok(plan.extraChargersNeeded >= 1);
  assert.ok(plan.breakEvenResidents !== null && plan.breakEvenResidents >= 2);
  // com um grupo grande, o compartilhado custa menos que um individual para cada
  const big = plan.curve[plan.curve.length - 1];
  assert.ok(big.shared < big.individual);
  assert.equal(plan.avoidedCapexToday, 12 * 8500 - 4 * 18000 > 0 ? 12 * 8500 - 4 * 18000 : 0);
});

test('capacidade: infra folgada não pede carregador novo', () => {
  const plan = planCapacity({
    chargers: 4, residents: 6, waitingList: 0, peakOccupancy: 0.4,
    capexSharedCharger: 18000, capexIndividual: 8500,
  });
  assert.equal(plan.saturated, false);
  assert.equal(plan.extraChargersNeeded, 0);
  assert.ok(plan.headroom > 0);
});

test('capacidade: o ponto de equilíbrio só vale se o compartilhado continua mais barato depois dele', () => {
  const plan = planCapacity({
    chargers: 4, residents: 12, waitingList: 5, peakOccupancy: 0.7,
    capexSharedCharger: 18000, capexIndividual: 8500,
  });
  const n = plan.breakEvenResidents!;
  for (let k = n; k <= 12; k++) assert.ok(plan.curve[k - 1].shared <= plan.curve[k - 1].individual);
});
