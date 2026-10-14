import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  attributeSources,
  calcInvoices,
  clusterProfiles,
  detectAnomalies,
  forecastOccupancy,
  planCapacity,
  sessionCost,
  solarShare,
  sumSources,
  totalEnergyKwh,
  userFeatures,
  type ActivityDto,
  type Anomaly,
  type BillingStatus,
  type CarDto,
  type ChargerDto,
  type EnergySources,
  type HomeDto,
  type HourStat,
  type InsightDto,
  type IntegrationStatus,
  type LiveDto,
  type ManagerOverviewDto,
  type ProfileDto,
  type RateioMode,
  type ScanResultDto,
  type Session,
  type SessionDto,
  type UnitDto,
} from '@chargeops/shared';
import {
  CAPEX,
  CHARGERS,
  CIRCUIT_LIMIT_KW,
  ME_ID,
  TARIFFS,
  USERS,
  WAITING_LIST,
  buildSamples,
  chargerById,
  generateHistory,
  mulberry32,
} from './mock.js';

const store = generateHistory();
const userById = (id: string) => USERS.find((u) => u.id === id)!;

/* ---------- IA 1 no fluxo de cobrança ----------
 * A detecção de anomalias decide o que entra na fatura: falha do carregador e leitura
 * absurda de energia ficam retidas até o gestor liberar ou descartar. */
const decisions = new Map<string, 'approved' | 'discarded'>();
const ANOMALY_WINDOW_DAYS = 120;

function anomalies(): Map<string, Anomaly> {
  const from = Date.now() - ANOMALY_WINDOW_DAYS * 86400000;
  const recent = store.sessions.filter((s) => Date.parse(s.startAt) >= from);
  return new Map(detectAnomalies(recent).map((a) => [a.sessionId, a]));
}

function billingStatusOf(s: Session, found: Map<string, Anomaly>): BillingStatus {
  const a = found.get(s.id);
  if (!a?.holdBilling) return 'billed';
  const d = decisions.get(s.id);
  return d === 'approved' ? 'billed' : d === 'discarded' ? 'discarded' : 'review';
}

/** Só sessões com cobrança liberada entram em fatura, rateio e totais financeiros. */
function billable(list: Session[]): Session[] {
  const found = anomalies();
  return list.filter((s) => billingStatusOf(s, found) === 'billed');
}

/** Na demo, 1 segundo real = 2 minutos simulados, para a recarga andar rápido. */
const SIM_SECONDS_PER_REAL_SECOND = 120;
const MAX_SIM_MIN = 8 * 60;
const DEMO_POWER_KW = 7.4;
/** Carregador que, na demonstração, está sendo usado por outro morador. */
const OCCUPIED_BY_OTHER = CHARGERS[1].id;

/* ---------- perfil do morador mockado ---------- */
const SUPPORTED_BRANDS = ['BYD', 'GWM', 'Volvo', 'Tesla', 'Renault'];
const BRANDS = ['BYD', 'GWM', 'Volvo', 'Renault', 'Peugeot', 'Tesla', 'Outra'];
const brandStatus = (brand: string): IntegrationStatus => (SUPPORTED_BRANDS.includes(brand) ? 'available' : 'unsupported');

interface CarRecord {
  id: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  unitId: string;
  batteryKwh: number;
  connected: boolean;
  socPct: number | null;
  syncedAt: string | null;
}
const units: Omit<UnitDto, 'carIds'>[] = [
  { id: 'apt1', label: 'Bloco A · Apto 42', condo: 'Condomínio Aurora', spot: 'Vaga 12', role: 'Proprietário' },
  { id: 'apt2', label: 'Bloco C · Apto 118', condo: 'Condomínio Aurora', spot: 'Vaga 31', role: 'Inquilino' },
];
const cars: CarRecord[] = [
  { id: 'car1', brand: 'BYD', model: 'Dolphin', year: 2025, plate: 'BRA2E19', unitId: 'apt1', batteryKwh: 60, connected: true, socPct: 62, syncedAt: new Date().toISOString() },
  { id: 'car2', brand: 'Renault', model: 'Kwid E-Tech', year: 2024, plate: 'FIA1A23', unitId: 'apt2', batteryKwh: 26, connected: false, socPct: null, syncedAt: null },
];
const carLabel = (c: CarRecord) => `${c.brand} ${c.model}`;
const unitLabel = (id: string) => units.find((u) => u.id === id)?.label ?? '—';
const carLabelById = (id?: string) => {
  const c = cars.find((x) => x.id === id);
  return c ? carLabel(c) : null;
};

function carDto(c: CarRecord): CarDto {
  const status: IntegrationStatus = c.connected ? 'connected' : brandStatus(c.brand);
  return {
    id: c.id,
    brand: c.brand,
    model: c.model,
    year: c.year,
    plate: c.plate,
    unitId: c.unitId,
    unitLabel: unitLabel(c.unitId),
    batteryKwh: c.batteryKwh,
    integration: {
      status,
      provider: c.brand,
      socPct: c.connected ? c.socPct : null,
      rangeKm: c.connected && c.socPct != null ? Math.round(c.socPct * 3.1) : null,
      syncedAt: c.syncedAt,
    },
  };
}

function profileDto(): ProfileDto {
  return {
    name: 'Vitor Kubica',
    email: 'vitor05kubica12@gmail.com',
    phone: '(11) 98888-1234',
    document: '***.482.***-07',
    memberSince: '2026-07-01',
    units: units.map((u) => ({ ...u, carIds: cars.filter((c) => c.unitId === u.id).map((c) => c.id) })),
    cars: cars.map(carDto),
    brands: BRANDS.map((brand) => ({ brand, status: brandStatus(brand) })),
  };
}

/* ---------- utilitários ---------- */
interface Active {
  startReal: number;
  simStart: Date;
  chargerId: string;
  carId: string | null;
  seed: number;
}
let active: Active | null = null;

const round2 = (n: number) => Math.round(n * 100) / 100;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const cycleOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const durationMin = (s: Session) => Math.round((Date.parse(s.endAt) - Date.parse(s.startAt)) / 60000);
const mine = () => store.sessions.filter((s) => s.userId === ME_ID);

function sessionDto(s: Session, found: Map<string, Anomaly> = anomalies()): SessionDto {
  const { costBrl, savingsBrl } = sessionCost(s.sources, TARIFFS);
  return {
    ...s,
    billingStatus: billingStatusOf(s, found),
    userName: userById(s.userId).name,
    chargerName: chargerById(s.chargerId)?.name ?? s.chargerId,
    carLabel: carLabelById(s.carId),
    durationMin: durationMin(s),
    solarPct: Math.round(solarShare(s.sources) * 100),
    costBrl,
    // economia = quanto custaria o mesmo kWh num eletroposto público, menos o que o morador pagou
    savingsBrl: round2(s.energyKwh * TARIFFS.publicKwh - costBrl),
    gridCostBrl: round2(s.sources.gridKwh * TARIFFS.gridKwh),
  };
}

function sourcesPct(src: EnergySources) {
  const t = sumSources(src) || 1;
  return {
    solar: Math.round((src.solarKwh / t) * 100),
    battery: Math.round((src.batteryKwh / t) * 100),
    grid: Math.round((src.gridKwh / t) * 100),
  };
}

function sumSourcesOf(list: Session[]): EnergySources {
  return list.reduce(
    (a, s) => ({
      solarKwh: a.solarKwh + s.sources.solarKwh,
      batteryKwh: a.batteryKwh + s.sources.batteryKwh,
      gridKwh: a.gridKwh + s.sources.gridKwh,
    }),
    { solarKwh: 0, batteryKwh: 0, gridKwh: 0 },
  );
}

function downsample<T extends Record<string, number>>(rows: T[], max: number): T[] {
  if (rows.length <= max) return rows;
  const size = Math.ceil(rows.length / max);
  const out: T[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const g = rows.slice(i, i + size);
    const avg = {} as Record<string, number>;
    for (const k of Object.keys(g[0])) avg[k] = round2(g.reduce((s, r) => s + r[k], 0) / g.length);
    out.push(avg as T);
  }
  return out;
}

/* ---------- carregadores ---------- */
function chargerDtos(): ChargerDto[] {
  const list = CHARGERS.map((c): ChargerDto => {
    const last = [...mine()].reverse().find((s) => s.chargerId === c.id);
    let status: ChargerDto['status'] = 'available';
    let note: string | null = null;
    if (active?.chargerId === c.id) {
      status = 'mine';
      note = 'Você está carregando aqui';
    } else if (c.id === OCCUPIED_BY_OTHER) {
      status = 'occupied';
      note = 'Em uso há 1h20';
    }
    return { id: c.id, name: c.name, place: c.place, ratedKw: c.ratedKw, status, note, lastUsedAt: last?.startAt ?? null, qr: `chargeops://charger/${c.id}` };
  });
  const rank = (c: ChargerDto) => (c.status === 'mine' ? 0 : 1);
  return list.sort((a, b) => rank(a) - rank(b) || Date.parse(b.lastUsedAt ?? '0') - Date.parse(a.lastUsedAt ?? '0'));
}

/* ---------- recarga ao vivo (simulada) ---------- */
function liveSnapshot(a: Active) {
  const realSec = (Date.now() - a.startReal) / 1000;
  const simMin = Math.min(MAX_SIM_MIN, Math.max(1, Math.floor((realSec * SIM_SECONDS_PER_REAL_SECOND) / 60)));
  const plan = [];
  for (let m = 0, i = 0; m < simMin; m += 15, i++) {
    const noise = 0.97 + mulberry32(a.seed + i)() * 0.04;
    plan.push({ chargerKw: DEMO_POWER_KW * noise, minutes: Math.min(15, simMin - m) });
  }
  const samples = buildSamples(a.simStart, plan, store.battery);
  const sources = attributeSources(samples, 'pv_battery_priority');
  const energyKwh = totalEnergyKwh(samples);
  return { simMin, samples, sources, energyKwh, powerKw: samples[samples.length - 1].chargerKw };
}

function liveDto(a: Active): LiveDto {
  const snap = liveSnapshot(a);
  const cost = sessionCost(snap.sources, TARIFFS);
  const last = snap.samples[snap.samples.length - 1];
  return {
    active: true,
    chargerId: a.chargerId,
    chargerName: chargerById(a.chargerId)?.name ?? a.chargerId,
    carLabel: carLabelById(a.carId ?? undefined),
    startedAt: a.simStart.toISOString(),
    elapsedMin: snap.simMin,
    energyKwh: snap.energyKwh,
    powerKw: snap.powerKw,
    sources: snap.sources,
    sourcesPct: sourcesPct(snap.sources),
    costBrl: cost.costBrl,
    savingsBrl: round2(snap.energyKwh * TARIFFS.publicKwh - cost.costBrl),
    plant: { pvKw: last.pvKw, batteryKw: last.batteryKw, loadKw: last.loadKw },
  };
}

/* ---------- faturas e economia ---------- */
function invoiceFor(cycle: string, mode: RateioMode) {
  const inCycle = billable(store.sessions.filter((s) => cycleOf(s.startAt) === cycle));
  return calcInvoices(inCycle, TARIFFS, mode, cycle);
}
const allCycles = () => [...new Set(store.sessions.map((s) => cycleOf(s.startAt)))].sort().reverse();

/** Economia do morador: o que ele pagou na infra do prédio versus o eletroposto público. */
function savingsFor(cycle: string) {
  const inv = invoiceFor(cycle, 'by_source').find((i) => i.userId === ME_ID);
  const paid = inv?.totalBrl ?? 0;
  const kwh = inv?.energyKwh ?? 0;
  const pub = round2(kwh * TARIFFS.publicKwh);
  return { kwh, paidBrl: paid, publicBrl: pub, savedBrl: round2(pub - paid), solarPct: inv && inv.energyKwh ? Math.round((inv.solarKwh / inv.energyKwh) * 100) : 0, sessions: inv?.sessions ?? 0 };
}

/* ---------- servidor ---------- */
const app = Fastify({ logger: { level: 'info' } });
await app.register(cors, { origin: true });

app.get('/health', async () => ({ ok: true }));

app.get('/home', async (): Promise<HomeDto> => {
  const cycles = allCycles();
  const cycle = cycleOf(new Date().toISOString());
  const m = savingsFor(cycle);
  const t = cycles.map(savingsFor).reduce(
    (a, x) => ({ kwh: a.kwh + x.kwh, paidBrl: a.paidBrl + x.paidBrl, publicBrl: a.publicBrl + x.publicBrl, savedBrl: a.savedBrl + x.savedBrl }),
    { kwh: 0, paidBrl: 0, publicBrl: 0, savedBrl: 0 },
  );
  const first = mine()[0];
  const fd = first ? new Date(first.startAt) : new Date();

  // IA 2: perfil de uso do morador. IA 3: previsão de ocupação para amanhã.
  const recent = store.sessions.filter((s) => Date.parse(s.startAt) >= Date.now() - ANOMALY_WINDOW_DAYS * 86400000);
  const me = clusterProfiles(userFeatures(billable(recent), USERS)).find((p) => p.userId === ME_ID);
  const tomorrow = forecastOccupancy(store.sessions, new Date(), 1, 8, CHARGERS.length)[0];
  return {
    user: { name: 'Vitor Kubica', initials: 'VK' },
    savings: {
      month: { cycle, kwh: m.kwh, paidBrl: m.paidBrl, publicBrl: m.publicBrl, savedBrl: m.savedBrl, solarPct: m.solarPct, sessions: m.sessions },
      total: { kwh: round2(t.kwh), paidBrl: round2(t.paidBrl), publicBrl: round2(t.publicBrl), savedBrl: round2(t.savedBrl), sinceLabel: `${MONTHS[fd.getMonth()]}/${String(fd.getFullYear()).slice(2)}` },
      publicKwhPrice: TARIFFS.publicKwh,
    },
    live: active ? liveDto(active) : null,
    chargers: chargerDtos(),
    cars: cars.map((c) => ({ id: c.id, label: carLabel(c) })),
    profile: me ? { label: me.label, hint: me.hint } : null,
    tip: tomorrow
      ? { date: tomorrow.date, bestSolarHour: tomorrow.bestSolarHour, occupancyPct: Math.round(tomorrow.hourly[tomorrow.bestSolarHour] * 100) }
      : null,
  };
});

/* ---- QR code ---- */
app.post<{ Body: { code?: string } }>('/charger/scan', async (req, reply): Promise<ScanResultDto | void> => {
  const code = (req.body?.code ?? '').trim();
  const id = code.startsWith('chargeops://charger/') ? code.slice('chargeops://charger/'.length) : code;
  const dto = chargerDtos().find((c) => c.id === id);
  if (!dto) return reply.code(404).send({ error: 'Esse QR code não é de um carregador do prédio.' });
  if (dto.status === 'available') return { charger: dto, canStart: true, message: null };
  const other = chargerDtos().find((c) => c.status === 'available');
  const message =
    dto.status === 'mine'
      ? 'Você já está carregando neste carregador.'
      : `${dto.name} está em uso agora.${other ? ` O ${other.name} está livre.` : ''}`;
  return { charger: dto, canStart: false, message };
});

app.get('/charger/live', async () => (active ? liveDto(active) : { active: false as const }));

app.post<{ Body: { chargerId?: string; carId?: string } }>('/charger/start', async (req, reply) => {
  if (active) return liveDto(active);
  const chargerId = req.body?.chargerId ?? '';
  const charger = chargerDtos().find((c) => c.id === chargerId);
  if (!charger) return reply.code(404).send({ error: 'Não encontramos esse carregador.' });
  if (charger.status !== 'available') return reply.code(409).send({ error: `${charger.name} não está livre agora.` });
  const carId = cars.some((c) => c.id === req.body?.carId) ? (req.body!.carId as string) : cars[0]?.id ?? null;

  // demo: começa às 10h30 de hoje (ou logo depois da última recarga nesse carregador) para haver sol
  const base = new Date();
  base.setHours(10, 30, 0, 0);
  const lastEnd = store.sessions.filter((s) => s.chargerId === chargerId).reduce((m, s) => Math.max(m, Date.parse(s.endAt)), 0);
  const simStart = new Date(Math.max(base.getTime(), lastEnd + 10 * 60000));
  active = { startReal: Date.now(), simStart, chargerId, carId, seed: Math.floor(Math.random() * 1e6) };
  return liveDto(active);
});

app.post('/charger/stop', async (_req, reply) => {
  if (!active) return reply.code(409).send({ error: 'Nenhuma recarga em andamento.' });
  const snap = liveSnapshot(active);
  const id = `s-${String(store.sessions.length + 1).padStart(4, '0')}`;
  const session: Session = {
    id,
    userId: ME_ID,
    chargerId: active.chargerId,
    startAt: active.simStart.toISOString(),
    endAt: new Date(active.simStart.getTime() + snap.simMin * 60000).toISOString(),
    energyKwh: snap.energyKwh,
    peakPowerKw: Math.max(...snap.samples.map((s) => s.chargerKw)),
    avgPowerKw: round2(snap.energyKwh / (snap.simMin / 60)),
    chargeMode: 'pv_battery_priority',
    status: 'completed',
    sources: snap.sources,
    carId: active.carId ?? undefined,
    waitedMin: 0,
  };
  store.battery.consume(active.simStart, snap.sources.batteryKwh);
  store.sessions.push(session);
  store.samples.set(id, snap.samples);
  active = null;
  return sessionDto(session);
});

/* ---- perfil ---- */
app.get('/profile', async () => profileDto());

app.post<{ Body: { label?: string; role?: UnitDto['role'] } }>('/profile/units', async (req, reply) => {
  const label = (req.body?.label ?? '').trim();
  if (label.length < 3) return reply.code(400).send({ error: 'Conte qual é o apartamento (ex.: Bloco B · Apto 12).' });
  units.push({ id: `apt${units.length + 1}`, label, condo: 'Condomínio Aurora', spot: 'Vaga a definir', role: req.body?.role === 'Inquilino' ? 'Inquilino' : 'Proprietário' });
  return profileDto();
});

app.post<{ Body: { brand?: string; model?: string; plate?: string; unitId?: string } }>('/profile/cars', async (req, reply) => {
  const { brand = '', model = '', plate = '', unitId = '' } = req.body ?? {};
  if (!BRANDS.includes(brand) || model.trim().length < 2 || plate.trim().length < 6) {
    return reply.code(400).send({ error: 'Preencha marca, modelo e placa do carro.' });
  }
  cars.push({
    id: `car${cars.length + 1}`,
    brand,
    model: model.trim(),
    year: new Date().getFullYear(),
    plate: plate.trim().toUpperCase(),
    unitId: units.some((u) => u.id === unitId) ? unitId : units[0].id,
    batteryKwh: 60,
    connected: false,
    socPct: null,
    syncedAt: null,
  });
  return profileDto();
});

app.post<{ Params: { id: string } }>('/profile/cars/:id/connect', async (req, reply) => {
  const car = cars.find((c) => c.id === req.params.id);
  if (!car) return reply.code(404).send({ error: 'Não encontramos esse carro.' });
  if (!SUPPORTED_BRANDS.includes(car.brand)) return reply.code(409).send({ error: `Ainda não temos integração com ${car.brand}.` });
  // simulação: na versão real, abre o login da montadora (OAuth) e lê a bateria do carro
  car.connected = true;
  car.socPct = 35 + (car.plate.charCodeAt(car.plate.length - 1) % 50);
  car.syncedAt = new Date().toISOString();
  return profileDto();
});

/* ---- atividade: recargas + fatura ---- */
app.get<{ Querystring: { cycle?: string } }>('/activity', async (req): Promise<ActivityDto> => {
  const cycles = allCycles();
  const cycle = req.query.cycle && cycles.includes(req.query.cycle) ? req.query.cycle : cycles[0];
  const pick = (m: RateioMode) => invoiceFor(cycle, m).find((i) => i.userId === ME_ID) ?? null;
  const invoice = pick('by_source');
  const sessions = mine().filter((s) => cycleOf(s.startAt) === cycle);
  const found = anomalies();
  const inReview = sessions.filter((s) => billingStatusOf(s, found) === 'review');
  const sv = savingsFor(cycle);

  // quanto da fatura vai para cada apartamento (energia pela origem; demanda e taxa pelo kWh)
  const byUnitMap = new Map<string, { kwh: number; energy: number }>();
  for (const s of sessions.filter((x) => billingStatusOf(x, found) === 'billed')) {
    const uid = cars.find((c) => c.id === s.carId)?.unitId ?? units[0].id;
    const cur = byUnitMap.get(uid) ?? { kwh: 0, energy: 0 };
    cur.kwh += s.energyKwh;
    cur.energy += sessionCost(s.sources, TARIFFS).costBrl;
    byUnitMap.set(uid, cur);
  }
  const totalKwh = [...byUnitMap.values()].reduce((a, x) => a + x.kwh, 0) || 1;
  const fixed = invoice ? invoice.demandCostBrl + invoice.platformFeeBrl : 0;
  const byUnit = [...byUnitMap.entries()].map(([unitId, x]) => ({
    unitId,
    label: unitLabel(unitId),
    kwh: round2(x.kwh),
    totalBrl: round2(x.energy + (fixed * x.kwh) / totalKwh),
  }));

  return {
    cycle,
    cycles,
    tariffs: TARIFFS,
    invoice,
    savings: { kwh: sv.kwh, paidBrl: sv.paidBrl, publicBrl: sv.publicBrl, savedBrl: sv.savedBrl, solarPct: sv.solarPct },
    singleRateTotalBrl: pick('single')?.totalBrl ?? null,
    byUnit,
    inReview: { count: inReview.length, kwh: round2(inReview.reduce((a, s) => a + s.energyKwh, 0)) },
    sessions: sessions.slice().reverse().map((s) => sessionDto(s, found)),
  };
});

app.get<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
  const s = store.sessions.find((x) => x.id === req.params.id);
  if (!s) return reply.code(404).send({ error: 'Não encontramos essa recarga.' });
  const samples = store.samples.get(s.id) ?? [];
  const series = downsample(
    samples.map((p) => {
      const split = attributeSources([p], s.chargeMode);
      const h = p.minutes / 60;
      return { t: Math.round((Date.parse(p.at) - Date.parse(s.startAt)) / 60000), solarKw: split.solarKwh / h, batteryKw: split.batteryKwh / h, gridKw: split.gridKwh / h };
    }),
    40,
  );
  const from = Date.now() - 120 * 86400000;
  const anomaly = detectAnomalies(store.sessions.filter((x) => Date.parse(x.startAt) >= from)).find((a) => a.sessionId === s.id) ?? null;
  return { ...sessionDto(s), sourcesPct: sourcesPct(s.sources), series, anomaly, publicCostBrl: round2(s.energyKwh * TARIFFS.publicKwh) };
});

/* ---- gestor ---- */
const hourRange = (hours: number[]): string => {
  const sorted = [...hours].sort((a, b) => a - b);
  let best: number[] = [];
  let cur: number[] = [];
  for (const h of sorted) {
    cur = cur.length && h === cur[cur.length - 1] + 1 ? [...cur, h] : [h];
    if (cur.length > best.length) best = cur;
  }
  return best.length > 1 ? `${best[0]}h e ${best[best.length - 1] + 1}h` : `${best[0]}h`;
};

app.post<{ Params: { id: string }; Body: { decision?: 'approved' | 'discarded' } }>('/manager/anomalies/:id', async (req, reply) => {
  const a = anomalies().get(req.params.id);
  const decision = req.body?.decision;
  if (!a?.holdBilling) return reply.code(404).send({ error: 'Essa recarga não está retida para conferência.' });
  if (decision !== 'approved' && decision !== 'discarded') return reply.code(400).send({ error: 'Escolha liberar ou descartar.' });
  decisions.set(req.params.id, decision);
  return { sessionId: req.params.id, decision };
});

app.get('/manager/overview', async (): Promise<ManagerOverviewDto> => {
  const now = new Date();
  const DAYS = 30;
  const from = now.getTime() - DAYS * 86400000;
  const win = store.sessions.filter((s) => Date.parse(s.startAt) >= from);
  const found = anomalies();
  // IA 1: o que está retido ou descartado não entra em fatura, rateio nem totais
  const winB = win.filter((s) => billingStatusOf(s, found) === 'billed');
  const invoices = calcInvoices(winB, TARIFFS, 'by_source', 'últimos 30 dias');
  const total = sumSourcesOf(winB);

  /* demanda simultânea em fatias de 15 minutos */
  interface Slot { day: string; hour: number; kw: number; active: Set<string> }
  const slots = new Map<string, Slot>();
  for (const s of win) {
    const rated = chargerById(s.chargerId)?.ratedKw ?? 7.4;
    for (const sp of store.samples.get(s.id) ?? []) {
      const d = new Date(sp.at);
      const key = `${d.toDateString()}|${d.getHours()}|${Math.floor(d.getMinutes() / 15)}`;
      const slot = slots.get(key) ?? { day: d.toDateString(), hour: d.getHours(), kw: 0, active: new Set<string>() };
      slot.kw += Math.min(sp.chargerKw, rated); // leitura absurda (erro de medição) não vira "sobrecarga"
      slot.active.add(s.id);
      slots.set(key, slot);
    }
  }
  const nCh = CHARGERS.length;
  const slotsPerHour = DAYS * 4;
  const hourly: HourStat[] = Array.from({ length: 24 }, (_, hour) => {
    const inHour = [...slots.values()].filter((x) => x.hour === hour);
    const overDays = new Set(inHour.filter((x) => x.kw > CIRCUIT_LIMIT_KW).map((x) => x.day));
    return {
      hour,
      avgKw: round2(inHour.reduce((a, x) => a + x.kw, 0) / slotsPerHour),
      maxKw: round2(Math.max(0, ...inHour.map((x) => x.kw))),
      occupancyPct: Math.round((inHour.reduce((a, x) => a + x.active.size / nCh, 0) / slotsPerHour) * 100),
      fullPct: Math.round((inHour.filter((x) => x.active.size >= nCh).length / slotsPerHour) * 100),
      overloadPct: Math.round((overDays.size / DAYS) * 100),
    };
  });
  const peak = hourly.reduce((b, h) => (h.occupancyPct > b.occupancyPct ? h : b));

  /* esperas e desistências */
  const waited = win.filter((s) => (s.waitedMin ?? 0) > 0);
  const waits = {
    sessionsWaited: waited.length,
    avgWaitMin: waited.length ? Math.round(waited.reduce((a, s) => a + (s.waitedMin ?? 0), 0) / waited.length) : 0,
    dropped: store.dropped.filter((d) => Date.parse(d.at) >= from).length,
  };

  /* distribuição */
  const chargers = CHARGERS.map((c) => {
    const list = winB.filter((s) => s.chargerId === c.id);
    const minutes = list.reduce((a, s) => a + durationMin(s), 0);
    return { id: c.id, name: c.name, place: c.place, kwh: round2(list.reduce((a, s) => a + s.energyKwh, 0)), sessions: list.length, utilizationPct: Math.round((minutes / (DAYS * 17 * 60)) * 100) };
  });
  const totalKwh = sumSources(total) || 1;
  const byUser = USERS.map((u) => ({ name: u.name, kwh: round2(winB.filter((s) => s.userId === u.id).reduce((a, s) => a + s.energyKwh, 0)) }))
    .filter((x) => x.kwh > 0)
    .sort((a, b) => b.kwh - a.kwh);
  const residentsShare = byUser.map((x) => ({ ...x, pct: Math.round((x.kwh / totalKwh) * 100) }));

  /* economia */
  const billed = invoices.reduce((a, i) => a + i.totalBrl, 0);
  const publicCost = invoices.reduce((a, i) => a + i.energyKwh * TARIFFS.publicKwh, 0);
  const solarSavings = invoices.reduce((a, i) => a + i.savingsBrl, 0);

  /* capacidade e investimento */
  const plan = planCapacity({
    chargers: nCh,
    residents: invoices.length,
    waitingList: WAITING_LIST,
    peakOccupancy: peak.occupancyPct / 100,
    capexSharedCharger: CAPEX.sharedCharger,
    capexIndividual: CAPEX.individualCharger,
  });

  /* IA 1: anomalias com a decisão do gestor; IA 2: perfis de uso */
  const recent = store.sessions.filter((s) => Date.parse(s.startAt) >= now.getTime() - ANOMALY_WINDOW_DAYS * 86400000);
  const anomalyList = [...found.values()]
    .filter((a) => Date.parse(store.sessions.find((s) => s.id === a.sessionId)!.startAt) >= from)
    .map((a) => {
      const s = store.sessions.find((x) => x.id === a.sessionId)!;
      const status = billingStatusOf(s, found);
      const decision: ManagerOverviewDto['anomalies'][number]['decision'] = !a.holdBilling ? 'none' : status === 'review' ? 'pending' : status === 'discarded' ? 'discarded' : 'approved';
      return {
        ...a,
        userName: userById(a.userId).name,
        startAt: s.startAt,
        energyKwh: s.energyKwh,
        durationMin: durationMin(s),
        decision,
        heldBrl: round2(sessionCost(s.sources, TARIFFS).costBrl),
      };
    })
    .sort((x, y) => y.score - x.score);
  const held = anomalyList.filter((a) => a.decision === 'pending');
  const heldBilling = { count: held.length, kwh: round2(held.reduce((a, x) => a + x.energyKwh, 0)), brl: round2(held.reduce((a, x) => a + x.heldBrl, 0)) };

  const profiles = clusterProfiles(userFeatures(billable(recent), USERS)).map((p) => ({ ...p, userName: userById(p.userId).name }));
  // quanto cada perfil puxa da rede: direciona o incentivo ao horário do sol
  const gridTotal = winB.reduce((a, x) => a + x.sources.gridKwh, 0) || 1;
  const gridByProfile = [...new Set(profiles.map((p) => p.label))]
    .map((label) => {
      const ids = profiles.filter((p) => p.label === label).map((p) => p.userId);
      const kwh = winB.filter((x) => ids.includes(x.userId)).reduce((a, x) => a + x.sources.gridKwh, 0);
      return { label, residents: ids.length, gridKwh: round2(kwh), pct: Math.round((kwh / gridTotal) * 100) };
    })
    .sort((x, y) => y.gridKwh - x.gridKwh);

  /* insights */
  const insights: InsightDto[] = [];
  if (heldBilling.count > 0) {
    insights.push({
      id: 'held',
      tone: 'warning',
      title: `${heldBilling.count} recarga${heldBilling.count > 1 ? 's' : ''} retida${heldBilling.count > 1 ? 's' : ''} antes de cobrar`,
      text: `A IA segurou ${n2(heldBilling.kwh)} kWh (${fmtBrl(heldBilling.brl)}) que parecem erro de medição ou falha do carregador. Nada disso entrou na fatura dos moradores. Confira abaixo e libere ou descarte.`,
    });
  }
  const overHours = hourly.filter((h) => h.overloadPct >= 15).map((h) => h.hour);
  if (overHours.length) {
    const worst = Math.max(...hourly.filter((h) => overHours.includes(h.hour)).map((h) => h.overloadPct));
    insights.push({
      id: 'overload',
      tone: 'warning',
      title: `Sobrecarga entre ${hourRange(overHours)}`,
      text: `Nesse horário a demanda dos carregadores passa dos ${CIRCUIT_LIMIT_KW} kW do circuito em até ${worst}% dos dias.`,
    });
  }
  const fullHours = hourly.filter((h) => h.fullPct >= 20).map((h) => h.hour);
  if (fullHours.length) {
    insights.push({
      id: 'saturation',
      tone: 'warning',
      title: `Todos os carregadores ocupados entre ${hourRange(fullHours)}`,
      text: `${waits.sessionsWaited} moradores esperaram em média ${waits.avgWaitMin} min por uma vaga e ${waits.dropped} desistiram de carregar nos últimos 30 dias.`,
    });
  }
  if (plan.unserved > 0) {
    const k = plan.extraChargersNeeded;
    insights.push({
      id: 'expansion',
      tone: 'info',
      title: `A infra atual não comporta mais ${plan.unserved} moradores`,
      text:
        `Para atender a fila, ${k} carregador${k > 1 ? 'es' : ''} compartilhado${k > 1 ? 's' : ''} custa${k > 1 ? 'm' : ''} ${fmtBrl(plan.sharedExpansionCost)}; ` +
        `${plan.unserved} carregadores individuais custariam ${fmtBrl(plan.individualAlternativeCost)}. ` +
        `Cada compartilhado comporta ~${Math.round(plan.residentsPerCharger)} moradores (${fmtBrl(plan.sharedCostPerResident)} por morador, contra ${fmtBrl(CAPEX.individualCharger)} no individual)` +
        (plan.breakEvenResidents ? `, e a partir de ${plan.breakEvenResidents} moradores novos o compartilhado sai sempre mais barato.` : '.'),
    });
  }
  const nightGrid = winB.filter((s) => new Date(s.startAt).getHours() >= 18).reduce((a, s) => a + s.sources.gridKwh, 0);
  if (nightGrid > 0) {
    insights.push({
      id: 'shift',
      tone: 'info',
      title: 'Incentive o horário do sol',
      text:
        `${Math.round(nightGrid)} kWh vieram da rede em recargas depois das 18h. Mover parte delas para o meio do dia libera o pico da noite e economiza até ${fmtBrl(nightGrid * (TARIFFS.gridKwh - TARIFFS.solarKwh))} por mês.` +
        (gridByProfile[0] ? ` O perfil que mais puxa da rede é "${gridByProfile[0].label}" (${gridByProfile[0].residents} moradores, ${gridByProfile[0].pct}% da energia da rede): comece por ele.` : ''),
    });
  }
  insights.push({
    id: 'savings',
    tone: 'success',
    title: 'O sistema compartilhado já se paga',
    text: `Os moradores economizaram ${fmtBrl(publicCost - billed)} em 30 dias frente ao eletroposto público, e o prédio evitou ${fmtBrl(plan.avoidedCapexToday)} em obras ao não instalar um carregador por morador.`,
  });

  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (13 - i));
    const src = sumSourcesOf(store.sessions.filter((s) => new Date(s.startAt).toDateString() === d.toDateString()));
    return { date: d.toISOString().slice(0, 10), ...src };
  });

  return {
    window: 'últimos 30 dias',
    kpis: {
      energyKwh: round2(totalKwh),
      sessions: winB.length,
      residentsActive: invoices.length,
      residentsRegistered: USERS.length,
      waitingList: WAITING_LIST,
      billedBrl: round2(billed),
      savedVsPublicBrl: round2(publicCost - billed),
      solarSavingsBrl: round2(solarSavings),
      sourcesPct: sourcesPct(total),
    },
    chargers,
    residentsShare,
    hourly,
    limitKw: CIRCUIT_LIMIT_KW,
    waits,
    insights,
    capacity: { ...plan, chargers: nCh, residents: invoices.length, waitingList: WAITING_LIST, peakOccupancyPct: peak.occupancyPct, peakHour: peak.hour, capexSharedCharger: CAPEX.sharedCharger, capexIndividual: CAPEX.individualCharger },
    daily,
    anomalies: anomalyList,
    heldBilling,
    profiles,
    gridByProfile,
    forecast: forecastOccupancy(store.sessions, now, 7, 8, CHARGERS.length),
  };
});

const n2 = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');

function fmtBrl(x: number): string {
  const [int, dec] = Math.abs(x).toFixed(2).split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}


const port = Number(process.env.PORT ?? 3333);
await app.listen({ port, host: '0.0.0.0' });
