import type { EnergySources, Invoice, RateioMode, Tariffs } from './types';

export interface BillableSession {
  id?: string;
  userId: string;
  energyKwh: number;
  peakPowerKw: number;
  sources: EnergySources;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function energyCost(sources: EnergySources, t: Tariffs): number {
  return sources.solarKwh * t.solarKwh + sources.batteryKwh * t.batteryKwh + sources.gridKwh * t.gridKwh;
}

/**
 * Rateio proporcional por kWh + componente de demanda + taxa fixa:
 *
 *   fatura = (kWh_u / kWh_total) * custo_energia
 *          + (pico_u / soma_picos) * custo_demanda
 *          + taxa_plataforma / usuários_ativos
 *
 * `single`: todos pagam a mesma tarifa por kWh (a da rede); custo_energia é o total do ciclo.
 * `by_source`: cada kWh é cobrado pela tarifa da sua origem (sol < bateria < rede),
 *              tornando visível a economia de quem carrega com energia do prédio.
 *
 * Sessões `interrupted` entram pelo kWh entregue. Usuário sem sessão no ciclo não aparece.
 */
export function calcInvoices(
  sessions: BillableSession[],
  tariffs: Tariffs,
  mode: RateioMode,
  cycle: string,
): Invoice[] {
  const byUser = new Map<string, BillableSession[]>();
  for (const s of sessions) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }
  if (byUser.size === 0) return [];

  const totalKwh = sessions.reduce((a, s) => a + s.energyKwh, 0);
  const peaks = new Map<string, number>();
  for (const [uid, list] of byUser) peaks.set(uid, Math.max(...list.map((s) => s.peakPowerKw)));
  const peakSum = [...peaks.values()].reduce((a, b) => a + b, 0);
  const cycleEnergyCostSingle = totalKwh * tariffs.gridKwh;
  const fee = tariffs.platformFeeCycle / byUser.size;

  const out: Invoice[] = [];
  for (const [uid, list] of byUser) {
    const sources = list.reduce<EnergySources>(
      (a, s) => ({
        solarKwh: a.solarKwh + s.sources.solarKwh,
        batteryKwh: a.batteryKwh + s.sources.batteryKwh,
        gridKwh: a.gridKwh + s.sources.gridKwh,
      }),
      { solarKwh: 0, batteryKwh: 0, gridKwh: 0 },
    );
    const kwh = list.reduce((a, s) => a + s.energyKwh, 0);
    const energyCostBrl =
      mode === 'single'
        ? totalKwh > 0
          ? (kwh / totalKwh) * cycleEnergyCostSingle
          : 0
        : energyCost(sources, tariffs);
    const demandCostBrl = peakSum > 0 ? ((peaks.get(uid) ?? 0) / peakSum) * tariffs.demandCostCycle : 0;
    const total = energyCostBrl + demandCostBrl + fee;
    out.push({
      userId: uid,
      cycle,
      sessions: list.length,
      energyKwh: round2(kwh),
      solarKwh: round2(sources.solarKwh),
      batteryKwh: round2(sources.batteryKwh),
      gridKwh: round2(sources.gridKwh),
      energyCostBrl: round2(energyCostBrl),
      demandCostBrl: round2(demandCostBrl),
      platformFeeBrl: round2(fee),
      totalBrl: round2(total),
      savingsBrl: round2(kwh * tariffs.gridKwh - energyCostBrl),
    });
  }
  return out;
}

/** Quanto uma única sessão custou e economizou (sem demanda/taxa fixa). */
export function sessionCost(sources: EnergySources, t: Tariffs) {
  const kwh = sources.solarKwh + sources.batteryKwh + sources.gridKwh;
  const cost = energyCost(sources, t);
  return { costBrl: round2(cost), savingsBrl: round2(kwh * t.gridKwh - cost) };
}
