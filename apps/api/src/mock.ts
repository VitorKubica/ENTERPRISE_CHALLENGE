import {
  attributeSources,
  totalEnergyKwh,
  type ChargeMode,
  type PlantSample,
  type Session,
  type SessionStatus,
  type Tariffs,
  type User,
} from '@chargeops/shared';

export const ME_ID = 'u001';
export const HISTORY_DAYS = 90;

/** Valores de exemplo (não são a tarifa real da distribuidora). */
export const TARIFFS: Tariffs = {
  solarKwh: 0.3,
  batteryKwh: 0.55,
  gridKwh: 0.95,
  demandCostCycle: 180,
  platformFeeCycle: 60,
  publicKwh: 2.1,
};

/** Premissas de investimento (exemplo) usadas na comparação do gestor. */
export const CAPEX = { sharedCharger: 18000, individualCharger: 8500 };
export const CIRCUIT_LIMIT_KW = 22;
export const WAITING_LIST = 5;

export interface Charger {
  id: string;
  name: string;
  place: string;
  ratedKw: number;
}
export const CHARGERS: Charger[] = [
  { id: 'GW22K-HCA-20-BR001', name: 'Carregador 1', place: 'Subsolo 1 · Vaga 01', ratedKw: 7.4 },
  { id: 'GW22K-HCA-20-BR002', name: 'Carregador 2', place: 'Subsolo 1 · Vaga 02', ratedKw: 7.4 },
  { id: 'GW22K-HCA-20-BR003', name: 'Carregador 3', place: 'Subsolo 1 · Vaga 03', ratedKw: 7.4 },
  { id: 'GW22K-HCA-20-BR004', name: 'Carregador 4', place: 'Subsolo 2 · Vaga 01', ratedKw: 11 },
];
export const chargerById = (id: string) => CHARGERS.find((c) => c.id === id);

export const USERS: User[] = [
  { id: 'u001', name: 'Vitor Kubica', unit: 'Bloco A · Apto 42', vehicle: 'BYD Dolphin' },
  { id: 'u002', name: 'Marina Alves', unit: 'Bloco B · Apto 31', vehicle: 'Volvo EX30' },
  { id: 'u003', name: 'Carlos Menezes', unit: 'Bloco A · Apto 17', vehicle: 'Renault Kwid E-Tech' },
  { id: 'u004', name: 'Ana Ribeiro', unit: 'Bloco C · Apto 121', vehicle: 'Peugeot e-208' },
  { id: 'u005', name: 'Rafael Costa', unit: 'Bloco B · Apto 55', vehicle: 'GWM Ora 03' },
  { id: 'u006', name: 'Beatriz Lima', unit: 'Bloco C · Apto 22', vehicle: 'BYD Dolphin Mini' },
  { id: 'u007', name: 'Lucas Prado', unit: 'Bloco A · Apto 63', vehicle: 'BYD Seal' },
  { id: 'u008', name: 'Fernanda Rocha', unit: 'Bloco B · Apto 08', vehicle: 'Volvo EX30' },
  { id: 'u009', name: 'Paulo Nogueira', unit: 'Bloco C · Apto 74', vehicle: 'BYD Dolphin' },
  { id: 'u010', name: 'Juliana Matos', unit: 'Bloco A · Apto 12', vehicle: 'GWM Ora 03' },
  { id: 'u011', name: 'Diego Farias', unit: 'Bloco B · Apto 90', vehicle: 'Renault Kwid E-Tech' },
  { id: 'u012', name: 'Camila Torres', unit: 'Bloco C · Apto 45', vehicle: 'BYD Dolphin Mini' },
];

/* ---------- gerador pseudoaleatório determinístico ---------- */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rand: () => number) {
  return Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
}

/* ---------- planta: sol, carga do prédio, bateria ---------- */
const PV_PEAK_KW = 40;
const BATTERY_MAX_KW = 6;
export const BATTERY_DAILY_KWH = 18;

export function pvAt(d: Date, cloud: number): number {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 6 || h > 18) return 0;
  return PV_PEAK_KW * cloud * Math.pow(Math.sin(Math.PI * ((h - 6) / 12)), 1.4);
}
export function baseLoadAt(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60;
  const daytime = h >= 8 && h <= 18 ? 4 : 0;
  const evening = h >= 18 && h <= 22 ? 6 : 0;
  return 6 + daytime + evening;
}
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export function cloudFor(d: Date): number {
  const r = mulberry32(d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate())();
  return 0.55 + r * 0.45;
}

/** Quanto resta de bateria "usável" por dia, consumido conforme as sessões. */
export class BatteryBudget {
  private left = new Map<string, number>();
  remaining(d: Date) {
    return this.left.get(dayKey(d)) ?? BATTERY_DAILY_KWH;
  }
  consume(d: Date, kwh: number) {
    this.left.set(dayKey(d), Math.max(0, this.remaining(d) - kwh));
  }
  availableKw(d: Date): number {
    const h = d.getHours() + d.getMinutes() / 60;
    const discharging = h >= 17.5 || h < 6;
    return discharging ? Math.min(BATTERY_MAX_KW, this.remaining(d) / 0.25) : 0;
  }
}

export interface PlanPoint {
  chargerKw: number;
  minutes: number;
}

/** Monta o fluxo de potência da planta para uma curva de carga do carregador. */
export function buildSamples(start: Date, plan: PlanPoint[], battery: BatteryBudget): PlantSample[] {
  const samples: PlantSample[] = [];
  let t = start.getTime();
  const cloud = cloudFor(start);
  for (const p of plan) {
    const at = new Date(t);
    const pvKw = pvAt(at, cloud);
    const batteryKw = battery.availableKw(at);
    const loadKw = baseLoadAt(at) + p.chargerKw;
    samples.push({
      at: at.toISOString(),
      minutes: p.minutes,
      pvKw: round(pvKw),
      batteryKw: round(batteryKw),
      gridKw: round(loadKw - pvKw - batteryKw),
      loadKw: round(loadKw),
      chargerKw: round(p.chargerKw),
    });
    t += p.minutes * 60000;
  }
  return samples;
}
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Curva de carga: potência quase constante, afunilando no fim (como um carro real). */
export function chargePlan(powerKw: number, minutes: number, rand: () => number): PlanPoint[] {
  const plan: PlanPoint[] = [];
  const step = 15;
  for (let m = 0; m < minutes; m += step) {
    const chunk = Math.min(step, minutes - m);
    const taper = m > minutes - 30 ? 0.65 : 1;
    plan.push({ chargerKw: Math.max(0.5, powerKw * taper * (0.97 + rand() * 0.04)), minutes: chunk });
  }
  return plan;
}

/* ---------- histórico de sessões ---------- */
interface Habit {
  userId: string;
  weekdayProb: number[]; // dom..sáb
  hourMean: number;
  hourSd: number;
  kwhMean: number;
  kwhSd: number;
  maxKw: number;
  mode: ChargeMode;
}
const WEEK_DAY = [0.35, 0.6, 0.6, 0.6, 0.6, 0.55, 0.35];
// quem chega do trabalho carrega quase todo dia útil, e é isso que aperta o fim da tarde
const EVENING = [0.5, 0.9, 0.9, 0.9, 0.9, 0.8, 0.5];
const h = (userId: string, hourMean: number, hourSd: number, kwhMean: number, maxKw: number, mode: ChargeMode, prob = WEEK_DAY): Habit => ({
  userId, weekdayProb: prob, hourMean, hourSd, kwhMean, kwhSd: kwhMean * 0.22, maxKw, mode,
});
const HABITS: Habit[] = [
  // Vitor: dia útil no fim da tarde, fim de semana de manhã (mais sol)
  h('u001', 13, 5.5, 17, 7.4, 'pv_battery_priority', [0.8, 0.45, 0.2, 0.45, 0.2, 0.3, 0.8]),
  h('u002', 21.5, 1, 24, 7.4, 'fast'),
  h('u003', 10, 1.2, 11, 3.7, 'pv_priority'),
  h('u004', 17.5, 0.8, 9, 7.4, 'fast', [0.1, 0.35, 0.4, 0.35, 0.4, 0.4, 0.1]),
  h('u005', 13, 1.3, 14, 7.4, 'pv_battery_priority'),
  h('u006', 19.5, 1, 15, 7.4, 'pv_battery_priority', EVENING),
  // maioria chega do trabalho e ocupa o fim de tarde/começo da noite
  h('u007', 19, 0.9, 20, 7.4, 'pv_battery_priority', EVENING),
  h('u008', 20, 0.9, 18, 7.4, 'pv_battery_priority', EVENING),
  h('u009', 18.5, 0.8, 16, 7.4, 'pv_battery_priority', EVENING),
  h('u010', 19.8, 0.8, 15, 7.4, 'pv_battery_priority', EVENING),
  h('u011', 11, 1.5, 12, 3.7, 'pv_priority'),
  h('u012', 18.8, 0.8, 13, 7.4, 'pv_battery_priority', EVENING),
];

interface Planned {
  userId: string;
  start: number;
  kind: 'normal' | 'glitch' | 'error' | 'idle';
  habit: Habit;
  kwh: number;
}

export interface SessionStore {
  sessions: Session[];
  samples: Map<string, PlantSample[]>;
  battery: BatteryBudget;
  /** pessoas que desistiram de carregar porque não havia carregador livre */
  dropped: { at: string; userId: string }[];
}

/** Quanto alguém aceita esperar por um carregador antes de desistir. */
const MAX_WAIT_MIN = 90;

export function generateHistory(now = new Date()): SessionStore {
  const rand = mulberry32(2026);
  const planned: Planned[] = [];

  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const day = new Date(now);
    day.setDate(day.getDate() - back);
    day.setHours(0, 0, 0, 0);
    for (const habit of HABITS) {
      if (rand() > habit.weekdayProb[day.getDay()]) continue;
      const hour = Math.min(22.5, Math.max(6.5, habit.hourMean + gauss(rand) * habit.hourSd));
      const start = day.getTime() + hour * 3600000;
      const kwh = Math.max(3, habit.kwhMean + gauss(rand) * habit.kwhSd);
      planned.push({ userId: habit.userId, start, kind: 'normal', habit, kwh });
    }
  }
  planned.sort((a, b) => a.start - b.start);

  // algumas sessões "estranhas" recentes, para a IA ter o que achar
  const pick = (userId: string, fromEnd: number) => {
    const idxs = planned.map((p, i) => (p.userId === userId ? i : -1)).filter((i) => i >= 0);
    return idxs[idxs.length - fromEnd];
  };
  planned[pick('u002', 6)].kind = 'idle';
  planned[pick('u005', 9)].kind = 'glitch';
  planned[pick('u003', 4)].kind = 'error';
  planned[pick('u001', 3)].kind = 'error'; // uma falha também na conta do morador mockado

  const battery = new BatteryBudget();
  const store: SessionStore = { sessions: [], samples: new Map(), battery, dropped: [] };
  const freeAt = new Map<string, number>(CHARGERS.map((c) => [c.id, 0]));
  let n = 0;

  for (const p of planned) {
    // o carregador que fica livre primeiro (o de menor número em caso de empate)
    const charger = CHARGERS.reduce((best, c) => (freeAt.get(c.id)! < freeAt.get(best.id)! ? c : best));
    const free = freeAt.get(charger.id)!;
    const waited = Math.max(0, free + 5 * 60000 - p.start);
    if (waited > MAX_WAIT_MIN * 60000) {
      store.dropped.push({ at: new Date(p.start).toISOString(), userId: p.userId });
      continue;
    }
    const start = new Date(p.start + waited);
    const power = Math.min(p.habit.maxKw, charger.ratedKw) * (0.9 + rand() * 0.1);
    let plan: PlanPoint[];
    let status: SessionStatus = 'completed';

    if (p.kind === 'error') {
      plan = [{ chargerKw: 0.4, minutes: 3 }];
      status = 'error';
    } else if (p.kind === 'idle') {
      plan = [...chargePlan(power, 90, rand), ...Array.from({ length: 50 }, () => ({ chargerKw: 0.2, minutes: 15 }))];
    } else if (p.kind === 'glitch') {
      plan = chargePlan(power, Math.round(((p.kwh / power) * 60) / 15) * 15 || 60, rand).map((x) => ({ ...x, chargerKw: x.chargerKw * 9 }));
    } else {
      plan = chargePlan(power, Math.max(15, Math.round(((p.kwh / power) * 60) / 15) * 15), rand);
    }

    const samples = buildSamples(start, plan, battery);
    const sources = attributeSources(samples, p.habit.mode);
    battery.consume(start, sources.batteryKwh);
    const minutes = plan.reduce((a, x) => a + x.minutes, 0);
    const energy = totalEnergyKwh(samples);
    const id = `s-${String(++n).padStart(4, '0')}`;
    freeAt.set(charger.id, start.getTime() + minutes * 60000);

    store.sessions.push({
      id,
      userId: p.userId,
      chargerId: charger.id,
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + minutes * 60000).toISOString(),
      energyKwh: energy,
      peakPowerKw: Math.max(...samples.map((s) => s.chargerKw)),
      avgPowerKw: round(energy / (minutes / 60)),
      chargeMode: p.habit.mode,
      status,
      sources,
      waitedMin: Math.round(waited / 60000),
      // o morador mockado tem dois carros; o segundo é usado de vez em quando
      carId: p.userId === ME_ID ? (rand() < 0.22 ? 'car2' : 'car1') : undefined,
    });
    store.samples.set(id, samples);
  }
  store.sessions.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  return store;
}
