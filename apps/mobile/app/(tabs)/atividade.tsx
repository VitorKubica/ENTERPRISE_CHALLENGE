import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { ActivityDto } from '@chargeops/shared';
import { useApi } from '../../src/api';
import { brl, cycleLabel, cycleShort, dayLabel, duration, hhmm, n1, sourcesPctOf } from '../../src/format';
import { space, useTheme } from '../../src/theme';
import {
  BigNumber, Card, Chip, Divider, ErrorState, HBar, Loading, Notice, Row, Screen, SectionTitle, Segmented, SourceBadges, SourceBar, Txt,
} from '../../src/ui';

export default function Atividade() {
  const router = useRouter();
  const { c } = useTheme();
  const [cycle, setCycle] = useState<string | undefined>();
  const { data, error, loading, refresh, refreshing, reload } = useApi<ActivityDto>(`/activity${cycle ? `?cycle=${cycle}` : ''}`);

  const inv = data?.invoice;
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View style={{ paddingTop: space.sm }}>
        <Txt variant="h1">Recargas e fatura</Txt>
        {data ? <Txt color="textSecondary">{cycleLabel(data.cycle)}</Txt> : null}
      </View>

      {data ? (
        <Segmented value={data.cycle} onChange={setCycle} options={data.cycles.slice(0, 4).map((cy) => ({ value: cy, label: cycleShort(cy) }))} />
      ) : null}

      {loading && !data ? <Loading /> : null}
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : null}
      {data && !inv ? <Card><Txt color="textSecondary">Você não carregou nada nesse mês, então não tem nada a pagar.</Txt></Card> : null}

      {data && inv ? (
        <>
          <Card>
            <Txt variant="caption" color="textTertiary">Você economizou</Txt>
            <BigNumber value={brl(data.savings.savedBrl)} color={c.brandText} />
            <View style={{ marginTop: space.lg, gap: space.md }}>
              <HBar label="No eletroposto público seria" valueText={brl(data.savings.publicBrl)} fraction={1} tone="muted" />
              <HBar label="Você pagou" valueText={brl(data.savings.paidBrl)} fraction={data.savings.publicBrl ? data.savings.paidBrl / data.savings.publicBrl : 0} />
            </View>
            <Txt color="textSecondary" style={{ marginTop: space.md }}>
              {n1(inv.energyKwh)} kWh em {inv.sessions} recargas, {data.savings.solarPct}% com energia do sol do prédio.
            </Txt>
          </Card>

          {data.inReview.count > 0 ? (
            <Notice tone="warning" title={`${data.inReview.count} recarga${data.inReview.count > 1 ? 's' : ''} em revisão`}>
              Detectamos algo estranho na medição ({n1(data.inReview.kwh)} kWh). Ela não entra na fatura até o gestor conferir, para você não pagar por um erro.
            </Notice>
          ) : null}

          <SectionTitle hint="Cada kWh custa de acordo com a origem dele.">Sua fatura</SectionTitle>
          <Card style={{ gap: space.md }}>
            <SourceBar values={{ solar: inv.solarKwh, battery: inv.batteryKwh, grid: inv.gridKwh }} height={14} />
            <View>
              <Row label={`Sol · ${n1(inv.solarKwh)} kWh`} value={brl(inv.solarKwh * data.tariffs.solarKwh)} />
              <Row label={`Bateria · ${n1(inv.batteryKwh)} kWh`} value={brl(inv.batteryKwh * data.tariffs.batteryKwh)} />
              <Row label={`Rede · ${n1(inv.gridKwh)} kWh`} value={brl(inv.gridKwh * data.tariffs.gridKwh)} />
            </View>
            <Divider />
            <View>
              <Row label="Sua parte da demanda" value={brl(inv.demandCostBrl)} />
              <Row label="Taxa do app" value={brl(inv.platformFeeBrl)} />
              <Row strong label="Total do mês" value={brl(inv.totalBrl)} />
            </View>
            {data.singleRateTotalBrl != null ? (
              <Txt variant="caption" color={c.textTertiary}>
                Com tarifa única você pagaria {brl(data.singleRateTotalBrl)}. Cobrar pela origem faz quem carrega com o sol pagar menos.
              </Txt>
            ) : null}
          </Card>

          {data.byUnit.length > 1 ? (
            <>
              <SectionTitle hint="A fatura é dividida pelo carro que carregou.">Por apartamento</SectionTitle>
              <Card>
                {data.byUnit.map((u, i) => (
                  <View key={u.unitId}>
                    {i > 0 ? <Divider /> : null}
                    <Row label={`${u.label} · ${n1(u.kwh)} kWh`} value={brl(u.totalBrl)} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SectionTitle>Suas recargas</SectionTitle>
          {data.sessions.map((s) => (
            <Pressable key={s.id} onPress={() => router.push({ pathname: '/recarga/[id]', params: { id: s.id } })} accessibilityRole="button">
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="h3">{dayLabel(s.startAt)} · {hhmm(s.startAt)}</Txt>
                    <Txt variant="caption" color="textTertiary">
                      {n1(s.energyKwh)} kWh · {duration(s.durationMin)} · {brl(s.costBrl)}
                    </Txt>
                    <Txt variant="caption" color="textTertiary">{s.chargerName}{s.carLabel ? ` · ${s.carLabel}` : ''}</Txt>
                  </View>
                  {s.billingStatus === 'review' ? <Chip label="Em revisão" tone="warning" /> : s.billingStatus === 'discarded' ? <Chip label="Descartada" tone="neutral" /> : s.status !== 'completed' ? <Chip label={s.status === 'error' ? 'Com falha' : 'Interrompida'} tone="warning" /> : null}
                  <ChevronRight size={20} strokeWidth={1.5} color={c.textTertiary} />
                </View>
                <View style={{ marginTop: space.md, gap: space.sm }}>
                  <SourceBadges pct={sourcesPctOf(s)} />
                  {s.savingsBrl > 0 ? (
                    <Txt variant="caption" color={c.brandText} style={{ fontFamily: 'Inter_600SemiBold' }}>Economizou {brl(s.savingsBrl)}</Txt>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
