export type ChargeMode = 'fast' | 'pv_priority' | 'pv_battery_priority';
export type SessionStatus = 'completed' | 'interrupted' | 'error';

/** Uma leitura do fluxo de potência da planta, válida por `minutes` minutos. */
export interface PlantSample {
  at: string; // ISO
  minutes: number;
  pvKw: number;
  /** positivo = bateria descarregando */
  batteryKw: number;
  /** positivo = importando da rede */
  gridKw: number;
  loadKw: number;
  chargerKw: number;
}

export interface EnergySources {
  solarKwh: number;
  batteryKwh: number;
  gridKwh: number;
}

export interface Session {
  id: string;
  userId: string;
  chargerId: string;
  startAt: string;
  endAt: string;
  energyKwh: number;
  peakPowerKw: number;
  avgPowerKw: number;
  chargeMode: ChargeMode;
  status: SessionStatus;
  sources: EnergySources;
  /** carro usado (só moradores com cadastro de carros) */
  carId?: string;
  /** minutos que a pessoa esperou por um carregador livre */
  waitedMin?: number;
}

export interface User {
  id: string;
  name: string;
  unit: string;
  vehicle: string;
}

export interface Tariffs {
  /** R$/kWh por origem */
  solarKwh: number;
  batteryKwh: number;
  gridKwh: number;
  /** custo de demanda do ciclo atribuído ao carregador (R$) */
  demandCostCycle: number;
  /** custo mensal de operação da plataforma (R$), dividido entre usuários ativos */
  platformFeeCycle: number;
  /** referência: preço médio do kWh em eletroposto público (R$) */
  publicKwh: number;
}

export type RateioMode = 'single' | 'by_source';

export interface Invoice {
  userId: string;
  cycle: string; // YYYY-MM
  sessions: number;
  energyKwh: number;
  solarKwh: number;
  batteryKwh: number;
  gridKwh: number;
  energyCostBrl: number;
  demandCostBrl: number;
  platformFeeBrl: number;
  totalBrl: number;
  /** economia em relação a pagar 100% da tarifa da rede */
  savingsBrl: number;
}
