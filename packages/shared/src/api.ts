import type { Anomaly, DayForecast, UserProfile } from './ai';
import type { CapacityPlan } from './capacity';
import type { EnergySources, Invoice, Session, Tariffs } from './types';

/** Contrato HTTP entre apps/api e apps/mobile. Só tipos, sem código em runtime. */

export interface SourcesPct {
  solar: number;
  battery: number;
  grid: number;
}

/** billed: entra na fatura. review: retida pela IA até o gestor conferir. discarded: descartada pelo gestor. */
export type BillingStatus = 'billed' | 'review' | 'discarded';

export interface SessionDto extends Session {
  billingStatus: BillingStatus;
  userName: string;
  chargerName: string;
  carLabel: string | null;
  durationMin: number;
  solarPct: number;
  costBrl: number;
  savingsBrl: number;
  gridCostBrl: number;
}

export interface LiveDto {
  active: true;
  chargerId: string;
  chargerName: string;
  carLabel: string | null;
  startedAt: string;
  elapsedMin: number;
  energyKwh: number;
  powerKw: number;
  sources: EnergySources;
  sourcesPct: SourcesPct;
  costBrl: number;
  /** quanto custaria o mesmo kWh num eletroposto público, menos o que o morador pagou */
  savingsBrl: number;
  plant: { pvKw: number; batteryKw: number; loadKw: number };
}

/* ---------- carregadores ---------- */
export type ChargerStatus = 'available' | 'occupied' | 'mine' | 'offline';

export interface ChargerDto {
  id: string;
  name: string;
  place: string;
  ratedKw: number;
  status: ChargerStatus;
  /** "Em uso há 1h20", "Em manutenção"… */
  note: string | null;
  /** última vez que o morador usou este carregador */
  lastUsedAt: string | null;
  /** conteúdo do QR code colado no carregador (usado na demonstração) */
  qr: string;
}

export interface ScanResultDto {
  charger: ChargerDto;
  /** false quando o carregador não está livre */
  canStart: boolean;
  message: string | null;
}

/* ---------- economia do morador ---------- */
export interface SavingsBlock {
  kwh: number;
  paidBrl: number;
  publicBrl: number;
  savedBrl: number;
}

export interface HomeDto {
  user: { name: string; initials: string };
  savings: {
    month: SavingsBlock & { cycle: string; solarPct: number; sessions: number };
    total: SavingsBlock & { sinceLabel: string };
    publicKwhPrice: number;
  };
  live: LiveDto | null;
  chargers: ChargerDto[];
  cars: { id: string; label: string }[];
  /** IA 2: perfil de uso do morador. null enquanto não há histórico suficiente. */
  profile: { label: string; hint: string } | null;
  /** IA 3: previsão de ocupação para amanhã e melhor hora para carregar com sol. */
  tip: { date: string; bestSolarHour: number; occupancyPct: number } | null;
}

/* ---------- perfil ---------- */
export type IntegrationStatus = 'connected' | 'available' | 'unsupported';

export interface CarDto {
  id: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  unitId: string;
  unitLabel: string;
  batteryKwh: number;
  integration: {
    status: IntegrationStatus;
    provider: string;
    socPct: number | null;
    rangeKm: number | null;
    syncedAt: string | null;
  };
}

export interface UnitDto {
  id: string;
  label: string;
  condo: string;
  spot: string;
  role: 'Proprietário' | 'Inquilino';
  carIds: string[];
}

export interface ProfileDto {
  name: string;
  email: string;
  phone: string;
  document: string;
  memberSince: string;
  units: UnitDto[];
  cars: CarDto[];
  brands: { brand: string; status: IntegrationStatus }[];
}

/* ---------- atividade (recargas + fatura) ---------- */
export interface SeriesPoint {
  t: number; // minutos desde o início
  solarKw: number;
  batteryKw: number;
  gridKw: number;
}

export interface SessionDetailDto extends SessionDto {
  sourcesPct: SourcesPct;
  series: SeriesPoint[];
  anomaly: Anomaly | null;
  publicCostBrl: number;
}

export interface ActivityDto {
  cycle: string;
  cycles: string[];
  tariffs: Tariffs;
  invoice: Invoice | null;
  savings: SavingsBlock & { solarPct: number };
  /** total que o morador pagaria com tarifa única, para comparação */
  singleRateTotalBrl: number | null;
  /** IA 1: recargas retidas fora desta fatura até a conferência do gestor. */
  inReview: { count: number; kwh: number };
  byUnit: { unitId: string; label: string; kwh: number; totalBrl: number }[];
  sessions: SessionDto[];
}

/* ---------- gestor ---------- */
export interface HourStat {
  hour: number;
  avgKw: number;
  maxKw: number;
  occupancyPct: number;
  /** % dos dias em que todos os carregadores estavam ocupados nessa hora */
  fullPct: number;
  /** % dos dias em que a demanda passou do limite do circuito nessa hora */
  overloadPct: number;
}

export interface ChargerStat {
  id: string;
  name: string;
  place: string;
  kwh: number;
  sessions: number;
  utilizationPct: number;
}

export interface InsightDto {
  id: string;
  tone: 'warning' | 'info' | 'success';
  title: string;
  text: string;
}

export interface ManagerOverviewDto {
  window: string;
  kpis: {
    energyKwh: number;
    sessions: number;
    residentsActive: number;
    residentsRegistered: number;
    waitingList: number;
    billedBrl: number;
    savedVsPublicBrl: number;
    solarSavingsBrl: number;
    sourcesPct: SourcesPct;
  };
  chargers: ChargerStat[];
  residentsShare: { name: string; kwh: number; pct: number }[];
  hourly: HourStat[];
  limitKw: number;
  waits: { sessionsWaited: number; avgWaitMin: number; dropped: number };
  insights: InsightDto[];
  capacity: CapacityPlan & {
    chargers: number;
    residents: number;
    waitingList: number;
    peakOccupancyPct: number;
    peakHour: number;
    capexSharedCharger: number;
    capexIndividual: number;
  };
  daily: ({ date: string } & EnergySources)[];
  anomalies: (Anomaly & {
    userName: string;
    startAt: string;
    energyKwh: number;
    durationMin: number;
    /** pending: retida aguardando o gestor. approved: liberada para cobrança. discarded: descartada. */
    decision: 'pending' | 'approved' | 'discarded' | 'none';
    heldBrl: number;
  })[];
  heldBilling: { count: number; kwh: number; brl: number };
  profiles: (UserProfile & { userName: string })[];
  /** IA 2: quanto cada perfil puxa da rede, para direcionar incentivos. */
  gridByProfile: { label: string; residents: number; gridKwh: number; pct: number }[];
  forecast: DayForecast[];
}
