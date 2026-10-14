import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import type { SessionDetailDto } from '@chargeops/shared';
import { useApi } from '../../src/api';
import { brl, dayLabel, duration, hhmm, n1 } from '../../src/format';
import { space, useTheme } from '../../src/theme';
import {
  BigNumber, Card, Chip, Divider, ErrorState, Loading, Row, Screen, SectionTitle, SourceBar, SourceLegend, SourceLine, StackedBars, Txt,
} from '../../src/ui';

export default function RecargaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { data: s, error, loading, reload } = useApi<SessionDetailDto>(`/sessions/${id}`);

  if (loading && !s) return <Screen edges={[]}><Loading /></Screen>;
  if (!s) return <Screen edges={[]}><ErrorState message={error ?? 'Não encontramos essa recarga.'} onRetry={reload} /></Screen>;

  const src = s.sources;
  const p = s.sourcesPct;
  const end = hhmm(s.endAt);

  return (
    <Screen edges={[]}>
      <View>
        <Txt variant="h1">{dayLabel(s.startAt)}</Txt>
        <Txt color="textSecondary">{hhmm(s.startAt)} às {end} · {duration(s.durationMin)}</Txt>
      </View>

      <Card>
        <BigNumber value={n1(s.energyKwh)} unit="kWh" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' }}>
          <Txt variant="h3" style={{ fontVariant: ['tabular-nums'] }}>{brl(s.costBrl)}</Txt>
          {s.savingsBrl > 0 ? <Chip label={`Economizou ${brl(s.savingsBrl)}`} /> : null}
        </View>
        <Txt variant="caption" color="textTertiary" style={{ marginTop: space.sm }}>
          No eletroposto público seriam {brl(s.publicCostBrl)}.
        </Txt>
      </Card>

      {s.anomaly ? (
        <Card tone="warning">
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <TriangleAlert size={20} strokeWidth={1.5} color={c.warning} />
            <Txt variant="h3">Algo estranho nessa recarga — quer conferir?</Txt>
          </View>
          {s.anomaly.reasons.map((r) => (
            <Txt key={r} color="textSecondary" style={{ marginTop: 6 }}>{r}</Txt>
          ))}
        </Card>
      ) : null}

      <SectionTitle hint="Uma estimativa feita com a geração solar e a bateria do prédio no momento da recarga.">
        De onde veio a energia do seu carro
      </SectionTitle>
      <Card style={{ gap: space.md }}>
        <SourceBar values={p} height={14} />
        {src.solarKwh > 0 ? <SourceLine kind="solar" pct={p.solar} text={`${n1(src.solarKwh)} kWh vieram do sol do seu prédio`} /> : null}
        {src.batteryKwh > 0 ? <SourceLine kind="battery" pct={p.battery} text={`${n1(src.batteryKwh)} kWh vieram da bateria GoodWe`} /> : null}
        {src.gridKwh > 0 ? <SourceLine kind="grid" pct={p.grid} text={`${n1(src.gridKwh)} kWh vieram da rede (${brl(s.gridCostBrl)})`} /> : null}
      </Card>

      <SectionTitle hint="Potência do carregador ao longo da recarga.">Como foi a recarga</SectionTitle>
      <Card style={{ gap: space.md }}>
        <StackedBars
          bars={s.series.map((pt) => ({
            key: String(pt.t),
            label: hhmm(new Date(Date.parse(s.startAt) + pt.t * 60000).toISOString()),
            values: [pt.solarKw, pt.batteryKw, pt.gridKw],
          }))}
        />
        <SourceLegend pct={p} />
      </Card>

      <Card>
        <Row label="Duração" value={duration(s.durationMin)} />
        <Divider />
        <Row label="Potência média" value={`${n1(s.avgPowerKw)} kW`} />
        <Divider />
        <Row label="Potência máxima" value={`${n1(s.peakPowerKw)} kW`} />
        <Divider />
        <Row label="Carregador" value={s.chargerName} />
        {s.carLabel ? (
          <>
            <Divider />
            <Row label="Carro" value={s.carLabel} />
          </>
        ) : null}
      </Card>
    </Screen>
  );
}
