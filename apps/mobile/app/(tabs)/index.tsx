import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, Lightbulb, Plug } from 'lucide-react-native';
import type { ChargerDto, HomeDto, LiveDto, ScanResultDto } from '@chargeops/shared';
import { api, useApi } from '../../src/api';
import { brl, cycleLabel, dayLabel, durationShort, n1 } from '../../src/format';
import { Scanner } from '../../src/Scanner';
import { space, useTheme } from '../../src/theme';
import {
  Avatar, BigNumber, Button, Card, Chip, ErrorState, HBar, Loading, Screen, SectionTitle, SourceBar, SourceLegend, Stat, Txt,
} from '../../src/ui';

export default function Home() {
  const router = useRouter();
  const { c } = useTheme();
  const home = useApi<HomeDto>('/home');
  const charging = !!home.data?.live;
  // durante a recarga, atualiza a cada segundo
  const liveApi = useApi<LiveDto | { active: false }>('/charger/live', { intervalMs: charging ? 1000 : undefined });
  const live: LiveDto | null = charging && liveApi.data && 'active' in liveApi.data && liveApi.data.active ? liveApi.data : home.data?.live ?? null;

  const [scan, setScan] = useState<ScanResultDto | null>(null);
  const [carId, setCarId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCode(code: string) {
    setNotice(null);
    try {
      const r = await api<ScanResultDto>('/charger/scan', { method: 'POST', body: JSON.stringify({ code }) });
      if (r.canStart) {
        setScan(r);
        setCarId(home.data?.cars[0]?.id ?? null);
        return;
      }
      setNotice(r.message);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  async function start() {
    if (!scan) return;
    setBusy(true);
    try {
      await api('/charger/start', { method: 'POST', body: JSON.stringify({ chargerId: scan.charger.id, carId }) });
      setScan(null);
      await home.reload();
      await liveApi.reload();
    } catch (e) {
      setNotice((e as Error).message);
      setScan(null);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      const s = await api<{ id: string }>('/charger/stop', { method: 'POST' });
      await home.reload();
      router.push({ pathname: '/recarga/[id]', params: { id: s.id } });
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (home.loading && !home.data) return <Screen><Loading /></Screen>;
  if (home.error && !home.data) return <Screen><ErrorState message={home.error} onRetry={home.reload} /></Screen>;
  const d = home.data!;
  const firstName = d.user.name.split(' ')[0];

  return (
    <Screen onRefresh={home.refresh} refreshing={home.refreshing}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.sm }}>
        <View>
          <Txt variant="caption" color="textTertiary">Condomínio Aurora</Txt>
          <Txt variant="h1">Oi, {firstName}</Txt>
        </View>
        <Pressable onPress={() => router.push('/perfil')} accessibilityRole="button" accessibilityLabel="Abrir meu perfil">
          <Avatar initials={d.user.initials} size={44} />
        </Pressable>
      </View>

      {/* Topo: ler o QR code, ou acompanhar a recarga que está rolando */}
      <Card tone="hero">
        {live ? (
          <LiveCard live={live} onStop={stop} busy={busy} />
        ) : scan ? (
          <ConfirmCard
            scan={scan}
            cars={d.cars}
            carId={carId}
            onCar={setCarId}
            onStart={start}
            onCancel={() => setScan(null)}
            busy={busy}
          />
        ) : notice ? (
          <>
            <View style={{ alignSelf: 'flex-start' }}>
              <Chip label="Não deu certo" tone="warning" />
            </View>
            <Txt variant="h2" color={c.onHero} style={{ marginTop: space.sm }}>{notice}</Txt>
            <View style={{ marginTop: space.lg }}>
              <Button label="Voltar" variant="onHero" icon={ArrowLeft} onPress={() => setNotice(null)} />
            </View>
          </>
        ) : (
          <>
            <Txt variant="h2" color={c.onHero}>Aponte pro QR do carregador</Txt>
            <Txt color={c.onHeroMuted} style={{ marginTop: 2, marginBottom: space.md }}>
              O QR code fica colado em cada carregador da garagem.
            </Txt>
            <Scanner onCode={handleCode} onError={setNotice} paused={busy} />
          </>
        )}
      </Card>

      <SavingsCard d={d} />
      <TipCard d={d} />

      <SectionTitle hint="Os que você usou por último aparecem primeiro.">Carregadores do prédio</SectionTitle>
      {d.chargers.map((ch) => (
        <ChargerRow key={ch.id} ch={ch} onSimulate={() => !live && !scan && handleCode(ch.qr)} />
      ))}
      <Txt variant="caption" color="textTertiary">
        Demonstração: toque num carregador para simular a leitura do QR code.
      </Txt>
    </Screen>
  );
}

/* ---------- economia ---------- */
function SavingsCard({ d }: { d: HomeDto }) {
  const { c } = useTheme();
  const { month, total } = d.savings;
  const pct = month.publicBrl > 0 ? Math.round((month.savedBrl / month.publicBrl) * 100) : 0;
  return (
    <Card>
      <Txt variant="caption" color="textTertiary">Quanto você economizou com a infra do prédio</Txt>
      <View style={{ marginTop: 4 }}>
        <BigNumber value={brl(total.savedBrl)} color={c.brandText} />
        <Txt variant="caption" color="textTertiary">desde {total.sinceLabel}, em {n1(total.kwh)} kWh carregados</Txt>
      </View>
      <View style={{ marginTop: space.lg, gap: space.md }}>
        <Txt variant="h3">Em {cycleLabel(month.cycle)}</Txt>
        <HBar label="No eletroposto público seria" valueText={brl(month.publicBrl)} fraction={1} tone="muted" />
        <HBar label="Você pagou" valueText={brl(month.paidBrl)} fraction={month.publicBrl ? month.paidBrl / month.publicBrl : 0} />
      </View>
      <Txt color="textSecondary" style={{ marginTop: space.md }}>
        Você economizou {brl(month.savedBrl)} ({pct}% a menos) neste mês, e {month.solarPct}% da sua energia veio do sol do prédio.
      </Txt>
      <Txt variant="caption" color="textTertiary" style={{ marginTop: 4 }}>
        Comparado a {brl(d.savings.publicKwhPrice)} por kWh, preço médio de um eletroposto público.
      </Txt>
    </Card>
  );
}

/* ---------- dica: perfil de uso (IA 2) e previsão de ocupação (IA 3) ---------- */
function TipCard({ d }: { d: HomeDto }) {
  const { c } = useTheme();
  if (!d.tip) return null;
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <Lightbulb size={20} strokeWidth={1.5} color={c.brandText} />
        <Txt variant="h3">Dica pra economizar</Txt>
      </View>
      {d.profile ? (
        <Txt color="textSecondary" style={{ marginTop: 6 }}>
          Seu perfil de uso: <Txt style={{ fontFamily: 'Inter_600SemiBold' }}>{d.profile.label}</Txt>. {d.profile.hint}
        </Txt>
      ) : null}
      <Txt color="textSecondary" style={{ marginTop: 6 }}>
        Amanhã, por volta das {d.tip.bestSolarHour}h, o prédio deve estar gerando bastante sol e os carregadores devem estar {d.tip.occupancyPct}% ocupados. É um bom horário pra carregar com o sol.
      </Txt>
    </Card>
  );
}

/* ---------- carregadores ---------- */
function ChargerRow({ ch, onSimulate }: { ch: ChargerDto; onSimulate: () => void }) {
  const { c } = useTheme();
  const free = ch.status === 'available';
  const chip =
    ch.status === 'available' ? <Chip label="Livre" /> : ch.status === 'mine' ? <Chip label="Você" /> : ch.status === 'occupied' ? <Chip label="Em uso" tone="neutral" /> : <Chip label="Fora do ar" tone="warning" />;
  return (
    <Pressable onPress={onSimulate} accessibilityRole="button" accessibilityLabel={`${ch.name}, ${ch.place}`}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: free || ch.status === 'mine' ? c.brandSoft : c.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Plug size={20} strokeWidth={1.5} color={free || ch.status === 'mine' ? c.onBrandSoft : c.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="h3">{ch.name}</Txt>
          <Txt variant="caption" color="textTertiary">{ch.place} · até {n1(ch.ratedKw)} kW</Txt>
          {ch.note ? <Txt variant="caption" color="textSecondary">{ch.note}</Txt> : ch.lastUsedAt ? <Txt variant="caption" color="textSecondary">Você usou em {dayLabel(ch.lastUsedAt)}</Txt> : null}
        </View>
        {chip}
      </Card>
    </Pressable>
  );
}

/* ---------- confirmar qual carro ---------- */
function ConfirmCard({
  scan, cars, carId, onCar, onStart, onCancel, busy,
}: {
  scan: ScanResultDto;
  cars: { id: string; label: string }[];
  carId: string | null;
  onCar: (id: string) => void;
  onStart: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { c } = useTheme();
  return (
    <>
      <Chip label="QR lido" />
      <Txt variant="h2" color={c.onHero} style={{ marginTop: space.sm }}>{scan.charger.name}</Txt>
      <Txt color={c.onHeroMuted}>{scan.charger.place} · até {n1(scan.charger.ratedKw)} kW</Txt>
      {cars.length > 1 ? (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <Txt variant="caption" color={c.onHeroMuted}>Qual carro vai carregar?</Txt>
          {cars.map((car) => (
            <Pressable key={car.id} onPress={() => onCar(car.id)} accessibilityRole="radio" accessibilityState={{ selected: carId === car.id }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 8, borderWidth: 1, borderColor: carId === car.id ? '#7FD4A8' : '#1B5E3F' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: carId === car.id ? '#2E9E6B' : 'transparent', borderWidth: 1, borderColor: '#7FD4A8', alignItems: 'center', justifyContent: 'center' }}>
                  {carId === car.id ? <Check size={14} color="#fff" strokeWidth={2} /> : null}
                </View>
                <Txt color={c.onHero}>{car.label}</Txt>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <Button label="Começar a carregar" icon={Plug} onPress={onStart} loading={busy} />
        <Button label="Ler outro QR code" variant="onHero" onPress={onCancel} />
      </View>
    </>
  );
}

/* ---------- recarga ao vivo ---------- */
function LiveCard({ live, onStop, busy }: { live: LiveDto; onStop: () => void; busy: boolean }) {
  const { c } = useTheme();
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <Chip label="Carregando agora" />
        <Txt variant="caption" color={c.onHeroMuted}>{live.chargerName}{live.carLabel ? ` · ${live.carLabel}` : ''}</Txt>
      </View>
      <View style={{ marginTop: space.md }}>
        <BigNumber value={n1(live.energyKwh)} unit="kWh" color={c.onHero} />
      </View>
      <Txt color={c.onHeroMuted} style={{ marginTop: 4 }}>
        {live.sources.solarKwh > 0 ? `${n1(live.sources.solarKwh)} kWh vieram do sol do seu prédio` : 'Agora está usando a bateria e a rede'}
      </Txt>
      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <SourceBar values={live.sourcesPct} />
        <SourceLegend pct={live.sourcesPct} inverse />
      </View>
      <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.lg }}>
        <Stat inverse label="Tempo" value={durationShort(live.elapsedMin)} />
        <Stat inverse label="Potência" value={n1(live.powerKw)} unit="kW" />
        <Stat inverse label="Economia" value={brl(live.savingsBrl)} />
      </View>
      <Txt variant="caption" color={c.onHeroMuted} style={{ marginTop: space.md }}>
        Modo demonstração: o tempo passa 120 vezes mais rápido.
      </Txt>
      <View style={{ marginTop: space.md }}>
        <Button label="Parar de carregar" variant="onHero" onPress={onStop} loading={busy} />
      </View>
    </>
  );
}
