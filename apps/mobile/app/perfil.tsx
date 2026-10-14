import { useState } from 'react';
import { View } from 'react-native';
import { Car as CarIcon, Link2, Plus } from 'lucide-react-native';
import type { CarDto, ProfileDto, UnitDto } from '@chargeops/shared';
import { api, useApi } from '../src/api';
import { cycleLabel, n1 } from '../src/format';
import { space, useTheme } from '../src/theme';
import { Avatar, Button, Card, Chip, Divider, ErrorState, HBar, Input, Loading, Row, Screen, Segmented, Txt } from '../src/ui';

type Tab = 'cadastro' | 'apartamentos' | 'carros';

export default function Perfil() {
  const { data, error, loading, reload } = useApi<ProfileDto>('/profile');
  const [tab, setTab] = useState<Tab>('cadastro');

  if (loading && !data) return <Screen edges={[]}><Loading /></Screen>;
  if (!data) return <Screen edges={[]}><ErrorState message={error ?? 'Sem dados.'} onRetry={reload} /></Screen>;

  return (
    <Screen edges={[]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar initials="VK" size={56} />
        <View style={{ flex: 1 }}>
          <Txt variant="h1">{data.name}</Txt>
          <Txt color="textSecondary">{data.units.length} apartamentos · {data.cars.length} carros</Txt>
        </View>
      </View>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'cadastro', label: 'Cadastro' },
          { value: 'apartamentos', label: 'Apartamentos' },
          { value: 'carros', label: 'Carros' },
        ]}
      />
      {tab === 'cadastro' ? <Cadastro p={data} /> : null}
      {tab === 'apartamentos' ? <Apartamentos p={data} onChange={reload} /> : null}
      {tab === 'carros' ? <Carros p={data} onChange={reload} /> : null}
    </Screen>
  );
}

/* ---------- cadastro ---------- */
function Cadastro({ p }: { p: ProfileDto }) {
  return (
    <>
      <Card>
        <Row label="Nome" value={p.name} />
        <Divider />
        <Row label="E-mail" value={p.email} />
        <Divider />
        <Row label="Celular" value={p.phone} />
        <Divider />
        <Row label="CPF" value={p.document} />
        <Divider />
        <Row label="Morador desde" value={cycleLabel(p.memberSince.slice(0, 7))} />
      </Card>
      <Txt variant="caption" color="textTertiary">
        Para trocar algum dado, fale com a administração do condomínio.
      </Txt>
    </>
  );
}

/* ---------- apartamentos ---------- */
function Apartamentos({ p, onChange }: { p: ProfileDto; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [role, setRole] = useState<UnitDto['role']>('Proprietário');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await api('/profile/units', { method: 'POST', body: JSON.stringify({ label, role }) });
      setLabel('');
      setAdding(false);
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {p.units.map((u) => (
        <Card key={u.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt variant="h3">{u.label}</Txt>
            <Chip label={u.role} tone="neutral" />
          </View>
          <Txt color="textSecondary" style={{ marginTop: 2 }}>{u.condo} · {u.spot}</Txt>
          <Txt variant="caption" color="textTertiary" style={{ marginTop: space.sm }}>
            {u.carIds.length
              ? `Carros: ${u.carIds.map((id) => p.cars.find((c) => c.id === id)).filter(Boolean).map((c) => `${c!.brand} ${c!.model}`).join(', ')}`
              : 'Nenhum carro cadastrado neste apartamento'}
          </Txt>
        </Card>
      ))}
      {adding ? (
        <Card style={{ gap: space.md }}>
          <Txt variant="h3">Novo apartamento</Txt>
          <Input label="Bloco e apartamento" value={label} onChangeText={setLabel} placeholder="Bloco B · Apto 12" autoCapitalize="words" />
          <Segmented<UnitDto['role']> value={role} onChange={setRole} options={[{ value: 'Proprietário', label: 'Proprietário' }, { value: 'Inquilino', label: 'Inquilino' }]} />
          {err ? <Txt color="danger">{err}</Txt> : null}
          <Button label="Salvar apartamento" onPress={save} loading={busy} />
          <Button label="Cancelar" variant="tertiary" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button label="Adicionar apartamento" variant="secondary" icon={Plus} onPress={() => setAdding(true)} />
      )}
    </>
  );
}

/* ---------- carros ---------- */
function Carros({ p, onChange }: { p: ProfileDto; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [brand, setBrand] = useState('BYD');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');
  const [unitId, setUnitId] = useState(p.units[0]?.id ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function save() {
    setBusy('new');
    setErr(null);
    try {
      await api('/profile/cars', { method: 'POST', body: JSON.stringify({ brand, model, plate, unitId }) });
      setModel('');
      setPlate('');
      setAdding(false);
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function connect(id: string) {
    setBusy(id);
    setErr(null);
    try {
      await api(`/profile/cars/${id}/connect`, { method: 'POST' });
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {p.cars.map((car) => (
        <CarCard key={car.id} car={car} onConnect={() => connect(car.id)} busy={busy === car.id} />
      ))}
      {err && !adding ? <Txt color="danger">{err}</Txt> : null}
      {adding ? (
        <Card style={{ gap: space.md }}>
          <Txt variant="h3">Novo carro</Txt>
          <View style={{ gap: 4 }}>
            <Txt variant="caption" color="textTertiary">Marca</Txt>
            <Segmented value={brand} onChange={setBrand} options={p.brands.map((b) => ({ value: b.brand, label: b.brand }))} />
          </View>
          <Input label="Modelo" value={model} onChangeText={setModel} placeholder="Dolphin" autoCapitalize="words" />
          <Input label="Placa" value={plate} onChangeText={setPlate} placeholder="ABC1D23" autoCapitalize="characters" />
          {p.units.length > 1 ? (
            <View style={{ gap: 4 }}>
              <Txt variant="caption" color="textTertiary">Apartamento</Txt>
              <Segmented value={unitId} onChange={setUnitId} options={p.units.map((u) => ({ value: u.id, label: u.label }))} />
            </View>
          ) : null}
          {err ? <Txt color="danger">{err}</Txt> : null}
          <Button label="Salvar carro" onPress={save} loading={busy === 'new'} />
          <Button label="Cancelar" variant="tertiary" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button label="Adicionar carro" variant="secondary" icon={Plus} onPress={() => setAdding(true)} />
      )}
    </>
  );
}

function CarCard({ car, onConnect, busy }: { car: CarDto; onConnect: () => void; busy: boolean }) {
  const { c } = useTheme();
  const i = car.integration;
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <CarIcon size={22} strokeWidth={1.5} color={c.onBrandSoft} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="h3">{car.brand} {car.model}</Txt>
          <Txt variant="caption" color="textTertiary">{car.plate} · {car.year} · bateria de {n1(car.batteryKwh)} kWh</Txt>
          <Txt variant="caption" color="textTertiary">{car.unitLabel}</Txt>
        </View>
      </View>
      <Divider />
      {i.status === 'connected' ? (
        <View style={{ gap: space.sm }}>
          <Chip label={`Conectado ao app da ${i.provider}`} icon={Link2} />
          {i.socPct != null ? (
            <HBar label="Bateria do carro" valueText={`${i.socPct}%`} fraction={i.socPct / 100} caption={i.rangeKm != null ? `Autonomia estimada: ${i.rangeKm} km` : undefined} />
          ) : null}
          <Txt variant="caption" color="textTertiary">Lemos a bateria do carro pelo app da {i.provider} para avisar quando carregar.</Txt>
        </View>
      ) : i.status === 'available' ? (
        <View style={{ gap: space.sm }}>
          <Txt color="textSecondary">Conecte ao app da {i.provider} para ver a bateria do carro aqui e saber a hora de carregar.</Txt>
          <Button label={`Conectar ao app da ${i.provider}`} variant="secondary" icon={Link2} onPress={onConnect} loading={busy} />
        </View>
      ) : (
        <View style={{ alignItems: 'flex-start', gap: space.sm }}>
          <Chip label="Integração em breve" tone="neutral" />
          <Txt variant="caption" color="textTertiary">Ainda não temos conexão com o app da {i.provider}.</Txt>
        </View>
      )}
    </Card>
  );
}
