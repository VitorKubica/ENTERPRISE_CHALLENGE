import { useState } from 'react';
import { View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import type { ManagerOverviewDto } from '@chargeops/shared';
import { api, useApi } from '../../src/api';
import { brl, dayLabel, duration, hhmm, hourLabel, n0, n1, shortDate, weekdayLong } from '../../src/format';
import { space, useTheme } from '../../src/theme';
import {
  BigNumber, Button, Card, Chip, Divider, ErrorState, HBar, HourChart, Loading, Notice, Screen, SectionTitle, Segmented, SourceBar, SourceLegend, StackedBars, Stat, Txt,
} from '../../src/ui';

export default function Gestor() {
  const { c } = useTheme();
  const { data: d, error, loading, refresh, refreshing, reload } = useApi<ManagerOverviewDto>('/manager/overview');
  const [n, setN] = useState('4');
  const [deciding, setDeciding] = useState<string | null>(null);

  async function decide(sessionId: string, decision: 'approved' | 'discarded') {
    setDeciding(sessionId);
    try {
      await api(`/manager/anomalies/${sessionId}`, { method: 'POST', body: JSON.stringify({ decision }) });
      await reload();
    } finally {
      setDeciding(null);
    }
  }

  if (loading && !d) return <Screen><Loading /></Screen>;
  if (!d) return <Screen><ErrorState message={error ?? 'Sem dados.'} onRetry={reload} /></Screen>;
  const k = d.kpis;
  const cap = d.capacity;

  const newRes = Number(n);
  const point = cap.curve[newRes - 1];
  const chargersNeeded = Math.ceil(newRes / cap.residentsPerCharger);
  const maxCost = Math.max(point.shared, point.individual);
  const cheaper = point.shared <= point.individual ? 'compartilhado' : 'individual';

  const groups = new Map<string, typeof d.profiles>();
  for (const p of d.profiles) groups.set(p.label, [...(groups.get(p.label) ?? []), p]);
  const topShare = d.residentsShare.slice(0, 5);
  const restKwh = d.residentsShare.slice(5).reduce((a, x) => a + x.kwh, 0);
  const maxShare = Math.max(...d.residentsShare.map((x) => x.kwh), 1);

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View style={{ paddingTop: space.sm }}>
        <Txt variant="h1">Painel do gestor</Txt>
        <Txt color="textSecondary">Condomínio Aurora · {d.window}</Txt>
      </View>

      {/* Economia */}
      <Card tone="hero">
        <Txt variant="caption" color={c.onHeroMuted}>Economia dos moradores com o sistema compartilhado</Txt>
        <View style={{ marginTop: 4 }}>
          <BigNumber value={brl(k.savedVsPublicBrl)} color={c.onHero} />
        </View>
        <Txt color={c.onHeroMuted} style={{ marginTop: 4 }}>
          nos {d.window}, comparado ao eletroposto público. Fora isso, o prédio evitou {brl(cap.avoidedCapexToday)} em obras por não instalar um carregador por morador.
        </Txt>
        <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.lg }}>
          <Stat inverse label="Energia" value={n0(k.energyKwh)} unit="kWh" />
          <Stat inverse label="Faturado" value={brl(k.billedBrl)} />
          <Stat inverse label="Do sol" value={`${k.sourcesPct.solar}%`} />
        </View>
      </Card>

      {/* Insights */}
      <SectionTitle hint="O que a análise dos últimos 30 dias mostra.">O que merece sua atenção</SectionTitle>
      {d.insights.map((i) => (
        <Notice key={i.id} tone={i.tone} title={i.title}>{i.text}</Notice>
      ))}

      {/* Picos e sobrecarga */}
      <SectionTitle hint="Maior demanda simultânea dos carregadores em cada hora do dia.">Horários de pico</SectionTitle>
      <Card style={{ gap: space.md }}>
        <HourChart values={d.hourly.map((h) => h.maxKw)} limit={d.limitKw} limitLabel={`Limite do circuito: ${d.limitKw} kW`} />
        <Txt variant="caption" color="textTertiary">Barras em laranja passaram do limite em algum dia.</Txt>
      </Card>
      <Card style={{ gap: space.md }}>
        <Txt variant="h3">Carregadores ocupados</Txt>
        <HourChart values={d.hourly.map((h) => h.occupancyPct)} limit={80} limitLabel="Acima de 80% a fila começa a crescer" unit="%" height={100} />
        <Divider />
        <View style={{ flexDirection: 'row', gap: space.lg }}>
          <Stat label="Esperaram" value={String(d.waits.sessionsWaited)} />
          <Stat label="Espera média" value={String(d.waits.avgWaitMin)} unit="min" />
          <Stat label="Desistiram" value={String(d.waits.dropped)} />
        </View>
      </Card>

      {/* Distribuição */}
      <SectionTitle hint="Quem usa e onde a energia está indo.">Distribuição</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Txt variant="h3">Origem da energia</Txt>
        <SourceBar values={k.sourcesPct} height={14} />
        <SourceLegend pct={k.sourcesPct} />
        <StackedBars bars={d.daily.map((x) => ({ key: x.date, label: shortDate(x.date), values: [x.solarKwh, x.batteryKwh, x.gridKwh] }))} height={90} />
      </Card>
      <Card style={{ gap: space.md }}>
        <Txt variant="h3">Por carregador</Txt>
        {d.chargers.map((ch) => (
          <HBar key={ch.id} label={ch.name} valueText={`${n0(ch.kwh)} kWh`} fraction={ch.kwh / Math.max(...d.chargers.map((x) => x.kwh), 1)} caption={`${ch.sessions} recargas · ocupado ${ch.utilizationPct}% do tempo`} />
        ))}
      </Card>
      <Card style={{ gap: space.md }}>
        <Txt variant="h3">Por morador</Txt>
        {topShare.map((r) => (
          <HBar key={r.name} label={r.name} valueText={`${n0(r.kwh)} kWh`} fraction={r.kwh / maxShare} caption={`${r.pct}% da energia`} />
        ))}
        {restKwh > 0 ? <HBar label={`Outros ${d.residentsShare.length - 5} moradores`} valueText={`${n0(restKwh)} kWh`} fraction={restKwh / maxShare} tone="muted" /> : null}
      </Card>

      {/* Investimento */}
      <SectionTitle hint="Quanto compensa ampliar o sistema compartilhado.">Vale investir em mais carregadores?</SectionTitle>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.lg }}>
          <Stat label="Moradores atendidos" value={String(cap.residents)} />
          <Stat label="A infra comporta" value={`~${n0(cap.maxResidents)}`} />
          <Stat label="Na fila" value={String(cap.waitingList)} />
        </View>
        <HBar
          label="Uso da capacidade"
          valueText={`${Math.min(100, Math.round((cap.residents / cap.maxResidents) * 100))}%`}
          fraction={cap.residents / cap.maxResidents}
          tone={cap.residents / cap.maxResidents > 0.8 ? 'warning' : 'brand'}
          caption={`No horário de pico (${hourLabel(cap.peakHour)}), ${cap.peakOccupancyPct}% dos carregadores já estão em uso.`}
        />
      </Card>
      <Card style={{ gap: space.md }}>
        <Txt variant="h3">Se entrarem mais moradores</Txt>
        <Segmented value={n} onChange={setN} options={['2', '4', '6', '8', '12'].map((v) => ({ value: v, label: `+${v} moradores` }))} />
        <HBar
          label={`Compartilhado · ${chargersNeeded} carregador${chargersNeeded > 1 ? 'es' : ''}`}
          valueText={brl(point.shared)}
          fraction={point.shared / maxCost}
          tone={cheaper === 'compartilhado' ? 'brand' : 'muted'}
        />
        <HBar
          label={`Individual · ${newRes} carregadores`}
          valueText={brl(point.individual)}
          fraction={point.individual / maxCost}
          tone={cheaper === 'individual' ? 'brand' : 'muted'}
        />
        <Txt color="textSecondary">
          {cheaper === 'compartilhado'
            ? `Para +${newRes} moradores o compartilhado sai ${brl(point.individual - point.shared)} mais barato.`
            : `Para +${newRes} moradores o individual sai ${brl(point.shared - point.individual)} mais barato, mas o compartilhado ainda tem folga para mais gente.`}
          {cap.breakEvenResidents ? ` A partir de ${cap.breakEvenResidents} moradores novos o compartilhado compensa sempre.` : ''}
        </Txt>
        <Txt variant="caption" color="textTertiary">
          Premissas de exemplo: {brl(cap.capexSharedCharger)} por carregador compartilhado e {brl(cap.capexIndividual)} por carregador individual, com obra elétrica. Cada compartilhado comporta ~{n1(cap.residentsPerCharger)} moradores.
        </Txt>
      </Card>

      {/* IA */}
      <SectionTitle hint="A IA segura a cobrança de falhas e leituras absurdas até você conferir.">Recargas pra conferir</SectionTitle>
      {d.anomalies.length === 0 ? (
        <Card><Txt color="textSecondary">Nenhuma recarga estranha nos últimos 30 dias.</Txt></Card>
      ) : (
        d.anomalies.map((a) => (
          <Card key={a.sessionId} tone={a.decision === 'pending' ? 'warning' : 'default'} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <TriangleAlert size={20} strokeWidth={1.5} color={c.warning} />
              <Txt variant="h3">{a.userName}</Txt>
            </View>
            <Txt variant="caption" color="textTertiary">
              {dayLabel(a.startAt)} · {hhmm(a.startAt)} · {n1(a.energyKwh)} kWh · {duration(a.durationMin)}
            </Txt>
            {a.reasons.map((r) => (
              <Txt key={r} color="textSecondary">{r}</Txt>
            ))}
            {a.decision === 'pending' ? (
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <Txt variant="caption" color={c.warning} style={{ fontFamily: 'Inter_600SemiBold' }}>
                  Cobrança retida: {brl(a.heldBrl)} fora da fatura até você decidir.
                </Txt>
                <Button label="Liberar cobrança" variant="secondary" onPress={() => decide(a.sessionId, 'approved')} loading={deciding === a.sessionId} />
                <Button label="Descartar recarga" variant="tertiary" onPress={() => decide(a.sessionId, 'discarded')} disabled={deciding === a.sessionId} />
              </View>
            ) : (
              <View style={{ alignSelf: 'flex-start', marginTop: space.xs }}>
                <Chip
                  tone={a.decision === 'discarded' ? 'neutral' : 'brand'}
                  label={a.decision === 'approved' ? 'Cobrança liberada' : a.decision === 'discarded' ? 'Recarga descartada' : 'Segue sendo cobrada'}
                />
              </View>
            )}
          </Card>
        ))
      )}

      <SectionTitle hint="Quem puxa mais energia da rede é quem mais ganha com o horário do sol.">Perfis de uso</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Txt variant="h3">Quem puxa da rede</Txt>
        {d.gridByProfile.map((g) => (
          <HBar key={g.label} label={`${g.label} · ${g.residents} moradores`} valueText={`${g.pct}%`} fraction={g.pct / 100} tone={g.pct >= 30 ? 'warning' : 'brand'} caption={`${n0(g.gridKwh)} kWh vindos da rede nos ${d.window}`} />
        ))}
      </Card>
      {[...groups.entries()].map(([label, list]) => (
        <Card key={label}>
          <Txt variant="h3">{label}</Txt>
          <Txt variant="caption" color="textTertiary" style={{ marginTop: 2 }}>{list[0].hint}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
            {list.map((p) => (
              <Chip key={p.userId} tone="neutral" label={`${p.userName.split(' ')[0]} · ${hourLabel(Math.round(p.avgStartHour))}`} />
            ))}
          </View>
        </Card>
      ))}

      <SectionTitle hint="Ocupação esperada, com base nas últimas 8 semanas.">Próximos 7 dias</SectionTitle>
      <Card style={{ gap: space.md }}>
        {d.forecast.map((f) => (
          <HBar
            key={f.date}
            label={weekdayLong(f.weekday)}
            valueText={`${f.peakPct}%`}
            fraction={f.peakPct / 100}
            tone={f.peakPct >= 70 ? 'warning' : 'brand'}
            caption={`Pico às ${hourLabel(f.peakHour)} · melhor hora pro sol: ${hourLabel(f.bestSolarHour)}`}
          />
        ))}
      </Card>
    </Screen>
  );
}
