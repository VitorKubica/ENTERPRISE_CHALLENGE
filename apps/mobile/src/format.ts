import type { ChargeMode } from '@chargeops/shared';

const comma = (s: string) => s.replace('.', ',');
export const n1 = (x: number) => comma(x.toFixed(1));
export const n0 = (x: number) => String(Math.round(x));

export function brl(x: number): string {
  const [int, dec] = Math.abs(x).toFixed(2).split('.');
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${x < 0 ? '-' : ''}R$ ${withDots},${dec}`;
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const weekdayLong = (n: number) => WEEKDAYS_LONG[n];
export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const cycleLabel = (cycle: string) => {
  const [y, m] = cycle.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} de ${y}`;
};
export const cycleShort = (cycle: string) => {
  const [y, m] = cycle.split('-').map(Number);
  return `${MONTHS[m - 1]}/${String(y).slice(2)}`;
};
export const duration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
};
/** Versão curta para espaços apertados: 1h33, 45min. */
export const durationShort = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
};
export const hourLabel = (h: number) => `${h}h`;

export const MODE_LABEL: Record<ChargeMode, string> = {
  pv_battery_priority: 'Sol + bateria',
  pv_priority: 'Só sol',
  fast: 'Rápido',
};
export const MODE_HINT: Record<ChargeMode, string> = {
  pv_battery_priority: 'Usa primeiro o sol do prédio, depois a bateria. Só puxa da rede se faltar.',
  pv_priority: 'Usa só o sol que sobra no prédio. Se não tiver, completa pela rede.',
  fast: 'Carrega o mais rápido possível, usando o que estiver disponível.',
};

/** Percentuais sol / bateria / rede de uma sessão (somam ~100). */
export function sourcesPctOf(s: { energyKwh: number; sources: { solarKwh: number; batteryKwh: number; gridKwh: number } }) {
  const t = s.energyKwh || 1;
  return {
    solar: Math.round((s.sources.solarKwh / t) * 100),
    battery: Math.round((s.sources.batteryKwh / t) * 100),
    grid: Math.round((s.sources.gridKwh / t) * 100),
  };
}
