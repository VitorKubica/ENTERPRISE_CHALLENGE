import type { ChargeMode, EnergySources, PlantSample } from './types';

export interface SampleSplit {
  solarKw: number;
  batteryKw: number;
  gridKw: number;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Atribui a potência do carregador a cada fonte em cascata:
 * excedente solar -> bateria -> rede.
 *
 * O excedente solar é a geração PV menos o consumo base do prédio
 * (carga total menos o que o próprio carregador consome).
 * No modo `pv_priority` a bateria não é usada.
 *
 * É uma ESTIMATIVA por balanço de potência, não uma medição física.
 */
export function splitSample(sample: PlantSample, mode: ChargeMode): SampleSplit {
  const charger = Math.max(0, sample.chargerKw);
  const baseLoad = Math.max(0, sample.loadKw - charger);
  const pvSurplus = Math.max(0, sample.pvKw - baseLoad);

  const solarKw = Math.min(charger, pvSurplus);
  let remaining = charger - solarKw;

  let batteryKw = 0;
  if (mode !== 'pv_priority') {
    batteryKw = Math.min(remaining, Math.max(0, sample.batteryKw));
    remaining -= batteryKw;
  }
  return { solarKw, batteryKw, gridKw: remaining };
}

export function attributeSources(samples: PlantSample[], mode: ChargeMode): EnergySources {
  let solar = 0;
  let battery = 0;
  let total = 0;
  for (const s of samples) {
    const h = s.minutes / 60;
    const split = splitSample(s, mode);
    solar += split.solarKw * h;
    battery += split.batteryKw * h;
    total += Math.max(0, s.chargerKw) * h;
  }
  const solarKwh = round3(solar);
  const batteryKwh = round3(battery);
  // a rede fecha a conta, garantindo solar + bateria + rede == total
  const gridKwh = round3(Math.max(0, total - solarKwh - batteryKwh));
  return { solarKwh, batteryKwh, gridKwh };
}

export function totalEnergyKwh(samples: PlantSample[]): number {
  return round3(samples.reduce((acc, s) => acc + (Math.max(0, s.chargerKw) * s.minutes) / 60, 0));
}

export function sumSources(s: EnergySources): number {
  return round3(s.solarKwh + s.batteryKwh + s.gridKwh);
}

export function solarShare(s: EnergySources): number {
  const t = sumSources(s);
  return t > 0 ? s.solarKwh / t : 0;
}
