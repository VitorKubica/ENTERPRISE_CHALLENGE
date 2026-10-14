/**
 * Planejamento de capacidade: a infraestrutura atual aguenta quantos moradores,
 * e quanto custa atender mais gente com carregadores compartilhados versus
 * um carregador individual (wallbox) por morador.
 */
export interface CapacityInput {
  chargers: number;
  residents: number;
  /** moradores que pediram acesso e ainda não foram atendidos */
  waitingList: number;
  /** fração média de carregadores ocupados na hora mais cheia (0..1) */
  peakOccupancy: number;
  /** ocupação de pico considerada confortável (default 0,8) */
  targetPeakOccupancy?: number;
  /** custo de um carregador compartilhado instalado (R$) */
  capexSharedCharger: number;
  /** custo de um carregador individual com adequação elétrica (R$) */
  capexIndividual: number;
}

export interface CapacityPlan {
  /** moradores que a infra atual atende com conforto, supondo demanda proporcional */
  maxResidents: number;
  residentsPerCharger: number;
  /** vagas livres de morador; negativo = já estourou */
  headroom: number;
  saturated: boolean;
  /** moradores além da capacidade (incluindo a lista de espera) */
  unserved: number;
  extraChargersNeeded: number;
  sharedExpansionCost: number;
  individualAlternativeCost: number;
  /** quanto o prédio deixou de gastar por ter um sistema compartilhado em vez de um por morador */
  avoidedCapexToday: number;
  /** custo de um carregador compartilhado dividido pelos moradores que ele comporta */
  sharedCostPerResident: number;
  /** a partir de quantos moradores novos o compartilhado passa a ser sempre mais barato; null se nunca */
  breakEvenResidents: number | null;
  curve: { newResidents: number; shared: number; individual: number }[];
}

export function planCapacity(i: CapacityInput): CapacityPlan {
  const target = i.targetPeakOccupancy ?? 0.8;
  const peak = Math.max(i.peakOccupancy, 0.05);
  const maxResidents = (i.residents * target) / peak;
  const residentsPerCharger = maxResidents / Math.max(1, i.chargers);
  const headroom = Math.floor(maxResidents - i.residents);
  const unserved = Math.max(0, Math.ceil(i.residents + i.waitingList - maxResidents));
  const chargersFor = (n: number) => Math.ceil(n / residentsPerCharger);
  const sharedCost = (n: number) => chargersFor(n) * i.capexSharedCharger;
  const individualCost = (n: number) => n * i.capexIndividual;

  // o custo do compartilhado sobe em degraus; só vale como ponto de equilíbrio
  // quando continua mais barato para qualquer quantidade maior de moradores
  let breakEven: number | null = null;
  for (let n = 60; n >= 1; n--) {
    if (sharedCost(n) <= individualCost(n)) breakEven = n;
    else break;
  }

  return {
    maxResidents: Math.round(maxResidents * 10) / 10,
    residentsPerCharger: Math.round(residentsPerCharger * 10) / 10,
    headroom,
    sharedCostPerResident: Math.round(i.capexSharedCharger / residentsPerCharger),
    saturated: peak >= 0.9 || headroom < 0,
    unserved,
    extraChargersNeeded: unserved > 0 ? chargersFor(unserved) : 0,
    sharedExpansionCost: unserved > 0 ? sharedCost(unserved) : 0,
    individualAlternativeCost: individualCost(unserved),
    avoidedCapexToday: Math.max(0, individualCost(i.residents) - i.chargers * i.capexSharedCharger),
    breakEvenResidents: breakEven,
    curve: Array.from({ length: 12 }, (_, k) => ({
      newResidents: k + 1,
      shared: sharedCost(k + 1),
      individual: individualCost(k + 1),
    })),
  };
}
