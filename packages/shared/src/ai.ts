import type { Session, User } from './types';

/* ------------------------------------------------------------------ */
/* IA 1 — Anomalias: z-score robusto (mediana + MAD) + regras de domínio */
/* ------------------------------------------------------------------ */

export type AnomalyKind = 'falha' | 'medicao' | 'ociosa' | 'curta';

export interface Anomaly {
  sessionId: string;
  userId: string;
  score: number;
  kinds: AnomalyKind[];
  reasons: string[];
  /**
   * Quando verdadeiro, a recarga fica fora da fatura até o gestor conferir:
   * falha do carregador e leitura absurda de energia corrompem o rateio.
   * Carro parado ou recarga curta não distorcem o kWh, então seguem sendo cobrados.
   */
  holdBilling: boolean;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** z-score robusto: resistente aos próprios outliers que queremos achar. */
function robustZ(values: number[]): number[] {
  const med = median(values);
  const mad = median(values.map((v) => Math.abs(v - med))) * 1.4826;
  const scale = Math.max(mad, Math.abs(med) * 0.05, 1e-3);
  return values.map((v) => (v - med) / scale);
}

const durationMin = (s: Session) => (Date.parse(s.endAt) - Date.parse(s.startAt)) / 60000;

export function detectAnomalies(sessions: Session[], threshold = 3.5): Anomaly[] {
  if (sessions.length < 8) return [];
  const rate = (s: Session) => s.energyKwh / Math.max(durationMin(s) / 60, 1 / 60);

  // Baseline por morador (cada carro carrega de um jeito); sem histórico suficiente, usa o geral.
  const MIN_HISTORY = 8;
  const byUser = new Map<string, Session[]>();
  for (const s of sessions) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
  const zDur = new Map<string, number>();
  const zRate = new Map<string, number>();
  const fill = (group: Session[]) => {
    const zd = robustZ(group.map(durationMin));
    const zr = robustZ(group.map(rate));
    group.forEach((s, i) => {
      zDur.set(s.id, zd[i]);
      zRate.set(s.id, zr[i]);
    });
  };
  const everyone = sessions.filter((s) => (byUser.get(s.userId)?.length ?? 0) < MIN_HISTORY);
  for (const group of byUser.values()) if (group.length >= MIN_HISTORY) fill(group);
  if (everyone.length >= MIN_HISTORY) fill(everyone);

  const out: Anomaly[] = [];
  for (const s of sessions) {
    const reasons: string[] = [];
    const kinds: AnomalyKind[] = [];
    let score = 0;
    const dur = durationMin(s);
    const zd = zDur.get(s.id) ?? 0;
    const zr = zRate.get(s.id) ?? 0;
    if (s.status === 'error') {
      reasons.push('O carregador registrou uma falha nessa recarga.');
      kinds.push('falha');
      score = Math.max(score, 5);
    }
    if (zr > threshold) {
      reasons.push('O carro puxou muito mais energia por hora do que o normal. Pode ser erro de medição.');
      kinds.push('medicao');
      score = Math.max(score, zr);
    }
    if (zd > threshold && rate(s) < 1) {
      reasons.push('O carro ficou conectado por muito tempo quase sem carregar.');
      kinds.push('ociosa');
      score = Math.max(score, zd);
    }
    if (dur < 5 && s.energyKwh < 0.5 && s.status !== 'error') {
      reasons.push('A recarga foi curta demais para ser uma carga de verdade.');
      kinds.push('curta');
      score = Math.max(score, 4);
    }
    if (reasons.length) {
      out.push({
        sessionId: s.id,
        userId: s.userId,
        score: Math.round(score * 10) / 10,
        kinds,
        reasons,
        holdBilling: kinds.includes('falha') || kinds.includes('medicao'),
      });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* IA 2 — Perfis de uso: K-Means sobre features por usuário             */
/* ------------------------------------------------------------------ */

export interface UserFeatures {
  userId: string;
  avgStartHour: number;
  avgDurationMin: number;
  sessionsPerWeek: number;
  avgKwh: number;
}

export interface UserProfile extends UserFeatures {
  cluster: number;
  label: string;
  hint: string;
}

export function userFeatures(sessions: Session[], users: User[]): UserFeatures[] {
  if (!sessions.length) return [];
  const times = sessions.map((s) => Date.parse(s.startAt));
  const weeks = Math.max(1, (Math.max(...times) - Math.min(...times)) / (7 * 86400000));
  return users
    .map((u) => {
      const mine = sessions.filter((s) => s.userId === u.id);
      if (!mine.length) return null;
      const avg = (f: (s: Session) => number) => mine.reduce((a, s) => a + f(s), 0) / mine.length;
      return {
        userId: u.id,
        avgStartHour: avg((s) => new Date(s.startAt).getHours() + new Date(s.startAt).getMinutes() / 60),
        avgDurationMin: avg(durationMin),
        sessionsPerWeek: mine.length / weeks,
        avgKwh: avg((s) => s.energyKwh),
      };
    })
    .filter((x): x is UserFeatures => x !== null);
}

function labelFor(hour: number): { label: string; hint: string } {
  if (hour < 16) return { label: 'Carrega com o sol', hint: 'Usa o carregador de dia, quando tem energia solar de sobra.' };
  if (hour < 20) return { label: 'Fim de tarde', hint: 'Chega do trabalho e carrega no horário de maior movimento.' };
  return { label: 'Carrega à noite', hint: 'Deixa o carro carregando por horas durante a noite.' };
}

export function clusterProfiles(feats: UserFeatures[], k = 3, iterations = 25): UserProfile[] {
  if (!feats.length) return [];
  k = Math.min(k, feats.length);
  const cols: (keyof Omit<UserFeatures, 'userId'>)[] = ['avgStartHour', 'avgDurationMin', 'sessionsPerWeek', 'avgKwh'];
  const mins = cols.map((c) => Math.min(...feats.map((f) => f[c])));
  const maxs = cols.map((c) => Math.max(...feats.map((f) => f[c])));
  // o horário de uso é o que define o perfil; pesa o dobro das demais features
  const weights = [2, 1, 1, 1];
  const norm = feats.map((f) => cols.map((c, i) => (maxs[i] === mins[i] ? 0 : ((f[c] - mins[i]) / (maxs[i] - mins[i])) * weights[i])));

  // inicialização determinística: usuários ordenados por horário, em quantis
  const order = feats.map((_, i) => i).sort((a, b) => feats[a].avgStartHour - feats[b].avgStartHour);
  let centroids = Array.from({ length: k }, (_, c) => [...norm[order[Math.floor(((c + 0.5) * feats.length) / k)]]]);
  let assign = new Array(feats.length).fill(0);

  const dist = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
  for (let it = 0; it < iterations; it++) {
    const next = norm.map((p) => centroids.reduce((best, c, ci) => (dist(p, c) < dist(p, centroids[best]) ? ci : best), 0));
    const changed = next.some((v, i) => v !== assign[i]);
    assign = next;
    centroids = centroids.map((c, ci) => {
      const members = norm.filter((_, i) => assign[i] === ci);
      return members.length ? c.map((_, d) => members.reduce((s, m) => s + m[d], 0) / members.length) : c;
    });
    if (!changed && it > 0) break;
  }

  return feats.map((f, i) => {
    const members = feats.filter((_, j) => assign[j] === assign[i]);
    const clusterHour = members.reduce((s, m) => s + m.avgStartHour, 0) / members.length;
    return { ...f, cluster: assign[i], ...labelFor(clusterHour) };
  });
}

/* ------------------------------------------------------------------ */
/* IA 3 — Previsão de ocupação: média sazonal por dia da semana × hora  */
/* ------------------------------------------------------------------ */

export interface DayForecast {
  date: string; // YYYY-MM-DD
  weekday: number;
  /** fração esperada de ocupação do carregador em cada hora (0..1) */
  hourly: number[];
  peakHour: number;
  peakPct: number;
  /** hora de menor ocupação entre 10h e 15h, quando há mais sol */
  bestSolarHour: number;
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** `chargers`: quantos carregadores dividem a demanda (a ocupação é a fração deles em uso). */
export function forecastOccupancy(sessions: Session[], from: Date, days = 7, windowWeeks = 8, chargers = 1): DayForecast[] {
  const windowStart = new Date(from);
  windowStart.setDate(windowStart.getDate() - windowWeeks * 7);
  windowStart.setHours(0, 0, 0, 0);

  // minutos ocupados por (data, hora)
  const busy = new Map<string, number>();
  for (const s of sessions) {
    const a = Date.parse(s.startAt);
    const b = Date.parse(s.endAt);
    if (b < windowStart.getTime() || a > from.getTime()) continue;
    for (let t = new Date(a).setMinutes(0, 0, 0); t < b; t += 3600000) {
      const overlap = Math.min(b, t + 3600000) - Math.max(a, t);
      if (overlap <= 0) continue;
      const d = new Date(t);
      const key = `${isoDay(d)}|${d.getHours()}`;
      busy.set(key, (busy.get(key) ?? 0) + overlap / 60000);
    }
  }

  const sums = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const counts = new Array(7).fill(0);
  for (let d = new Date(windowStart); d < from; d.setDate(d.getDate() + 1)) {
    counts[d.getDay()]++;
    for (let h = 0; h < 24; h++) sums[d.getDay()][h] += Math.min(60 * chargers, busy.get(`${isoDay(d)}|${h}`) ?? 0) / (60 * chargers);
  }

  const result: DayForecast[] = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const wd = d.getDay();
    const hourly = sums[wd].map((v: number) => (counts[wd] ? Math.round((v / counts[wd]) * 100) / 100 : 0));
    const peakHour = hourly.indexOf(Math.max(...hourly));
    let best = 10;
    for (let h = 10; h <= 15; h++) if (hourly[h] < hourly[best]) best = h;
    result.push({ date: isoDay(d), weekday: wd, hourly, peakHour, peakPct: Math.round(hourly[peakHour] * 100), bestSolarHour: best });
  }
  return result;
}
