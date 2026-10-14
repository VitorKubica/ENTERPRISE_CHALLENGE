import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BatteryCharging, Sun, Zap, type LucideIcon } from 'lucide-react-native';
import { SCREEN_MARGIN, palette, radius, space, type, useTheme, type Colors, type TypeVariant } from './theme';

/* ---------- texto ---------- */
interface TxtProps {
  variant?: TypeVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
  /** encolhe a fonte em vez de quebrar linha (para números em colunas estreitas) */
  fit?: boolean;
}
export function Txt({ variant = 'body', color, style, children, numberOfLines, fit }: TxtProps) {
  const { c } = useTheme();
  // `color` aceita um token do tema ("textSecondary") ou uma cor literal
  const resolved = color ? (color in c ? c[color as keyof Colors] : color) : c.text;
  return (
    <Text numberOfLines={fit ? 1 : numberOfLines} adjustsFontSizeToFit={fit} minimumFontScale={0.7} style={[type[variant], { color: resolved }, style]}>
      {children}
    </Text>
  );
}

/** Número grande com unidade pequena ao lado: "12,4 kWh". */
export function BigNumber({ value, unit, color }: { value: string; unit?: string; color?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
      <Txt variant="display" color={color ?? c.text} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Txt>
      {unit ? (
        <Txt variant="h3" color={color ?? c.textSecondary}>
          {unit}
        </Txt>
      ) : null}
    </View>
  );
}

/* ---------- tela ---------- */
interface ScreenProps {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  edges?: ('top' | 'bottom')[];
}
export function Screen({ children, onRefresh, refreshing, edges = ['top'] }: ScreenProps) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges}>
      <ScrollView
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space.md, paddingBottom: space.xxl }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.brand} /> : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Loading() {
  const { c } = useTheme();
  return (
    <View style={{ padding: space.huge, alignItems: 'center' }}>
      <ActivityIndicator color={c.brand} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <Txt variant="h3">Ops, algo não funcionou</Txt>
      <Txt color="textSecondary" style={{ marginTop: 4 }}>
        {message}
      </Txt>
      {onRetry ? (
        <View style={{ marginTop: space.md }}>
          <Button label="Tentar de novo" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </Card>
  );
}

/* ---------- card ---------- */
export function Card({
  children,
  style,
  tone = 'default',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'hero' | 'warning';
}) {
  const { c, isDark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: tone === 'hero' ? c.hero : c.surface,
    borderRadius: radius.card,
    padding: space.lg,
    ...(isDark
      ? { borderWidth: 1, borderColor: c.border }
      : { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 }),
  };
  if (tone === 'warning') {
    base.borderWidth = 1;
    base.borderColor = c.warning;
  }
  return <View style={[base, style]}>{children}</View>;
}

export function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={{ marginTop: space.sm }}>
      <Txt variant="h2">{children}</Txt>
      {hint ? (
        <Txt variant="caption" color="textTertiary" style={{ marginTop: 2 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/* ---------- botão ---------- */
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'onHero';
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
}
export function Button({ label, onPress, variant = 'primary', loading, disabled, icon: Icon }: ButtonProps) {
  const { c } = useTheme();
  const bg = variant === 'primary' ? c.brand : variant === 'danger' ? c.danger : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' || variant === 'onHero' ? palette.white : variant === 'tertiary' ? c.brandText : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: c.border },
        variant === 'onHero' && { borderWidth: 1, borderColor: palette.green300 },
        variant === 'tertiary' && { height: 40 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {Icon ? <Icon size={20} color={fg} strokeWidth={1.5} /> : null}
          <Txt variant="h3" color={fg}>
            {label}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

/* ---------- chip / badge ---------- */
export function Chip({
  label,
  tone = 'brand',
  icon: Icon,
  selected,
  onPress,
}: {
  label: string;
  tone?: 'brand' | 'warning' | 'danger' | 'neutral';
  icon?: LucideIcon;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  const palettes = {
    brand: { bg: c.brandSoft, fg: c.onBrandSoft },
    warning: { bg: palette.warning + '22', fg: c.warning },
    danger: { bg: palette.danger + '22', fg: c.danger },
    neutral: { bg: c.bg, fg: c.textSecondary },
  };
  const p = palettes[tone];
  const bg = onPress ? (selected ? c.brand : c.surface) : p.bg;
  const fg = onPress ? (selected ? palette.white : c.text) : p.fg;
  const body = (
    <View
      style={[
        styles.chip,
        { backgroundColor: bg },
        onPress && !selected && { borderWidth: 1, borderColor: c.border },
      ]}
    >
      {Icon ? <Icon size={14} color={fg} strokeWidth={1.5} /> : null}
      <Txt variant="caption" color={fg} style={{ fontFamily: 'Inter_600SemiBold' }}>
        {label}
      </Txt>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/* ---------- origem da energia ---------- */
export type SourceKey = 'solar' | 'battery' | 'grid';
export const SOURCE_META: Record<SourceKey, { label: string; icon: LucideIcon }> = {
  solar: { label: 'Sol', icon: Sun },
  battery: { label: 'Bateria', icon: BatteryCharging },
  grid: { label: 'Rede', icon: Zap },
};

export function useSourceColors() {
  const { c } = useTheme();
  return { solar: c.solar, battery: c.battery, grid: c.grid } as const;
}

/** Barra empilhada com a divisão sol / bateria / rede. */
export function SourceBar({ values, height = 12 }: { values: Record<SourceKey, number>; height?: number }) {
  const colors = useSourceColors();
  const total = values.solar + values.battery + values.grid || 1;
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: colors.grid }}>
      {(['solar', 'battery', 'grid'] as SourceKey[]).map((k) =>
        values[k] > 0 ? <View key={k} style={{ flex: values[k] / total, backgroundColor: colors[k] }} /> : null,
      )}
    </View>
  );
}

export function SourceLegend({ pct, inverse }: { pct: Record<SourceKey, number>; inverse?: boolean }) {
  const { c } = useTheme();
  const colors = useSourceColors();
  return (
    <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' }}>
      {(['solar', 'battery', 'grid'] as SourceKey[]).map((k) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors[k] }} />
          <Txt variant="caption" color={inverse ? c.onHeroMuted : c.textSecondary}>
            {SOURCE_META[k].label} <Txt variant="mono" color={inverse ? c.onHero : c.text} style={{ fontSize: 13 }}>{pct[k]}%</Txt>
          </Txt>
        </View>
      ))}
    </View>
  );
}

/** Mini-badges de origem para listas: só mostra as fontes que participaram. */
export function SourceBadges({ pct }: { pct: Record<SourceKey, number> }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
      {(['solar', 'battery', 'grid'] as SourceKey[])
        .filter((k) => pct[k] > 0)
        .map((k) => (
          <Chip key={k} label={`${SOURCE_META[k].label} ${pct[k]}%`} icon={SOURCE_META[k].icon} tone={k === 'grid' ? 'neutral' : 'brand'} />
        ))}
    </View>
  );
}

/** Frase "X kWh vieram do sol do seu prédio" com ícone. */
export function SourceLine({ kind, text, pct }: { kind: SourceKey; text: string; pct: number }) {
  const { c } = useTheme();
  const colors = useSourceColors();
  const Icon = SOURCE_META[kind].icon;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={[styles.iconBubble, { backgroundColor: kind === 'grid' ? c.bg : c.brandSoft }]}>
        <Icon size={20} strokeWidth={1.5} color={kind === 'grid' ? c.textSecondary : c.onBrandSoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="body">{text}</Txt>
      </View>
      <Txt variant="mono" color={c.textSecondary}>
        {pct}%
      </Txt>
      <View style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: colors[kind] }} />
    </View>
  );
}

/* ---------- gráfico de barras empilhadas ---------- */
export interface StackBar {
  key: string;
  label?: string;
  values: [number, number, number]; // sol, bateria, rede
}
export function StackedBars({ bars, height = 110 }: { bars: StackBar[]; height?: number }) {
  const { c } = useTheme();
  const colors = useSourceColors();
  const max = Math.max(...bars.map((b) => b.values[0] + b.values[1] + b.values[2]), 0.001);
  const keys: SourceKey[] = ['solar', 'battery', 'grid'];
  const labelStep = Math.ceil(bars.length / 4);
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 3, borderBottomWidth: 1, borderColor: c.border }}>
        {bars.map((b) => (
          <View key={b.key} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
            {[...keys].reverse().map((k) => {
              const v = b.values[keys.indexOf(k)];
              return v > 0 ? <View key={k} style={{ height: (v / max) * height, backgroundColor: colors[k] }} /> : null;
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
        {bars.map((b, i) => (
          <View key={b.key} style={{ flex: 1, alignItems: 'center' }}>
            {b.label && i % labelStep === 0 ? (
              // largura fixa maior que a barra: o rótulo transborda para os lados em vez de truncar
              <Txt variant="caption" color={c.textTertiary} style={{ fontSize: 10, width: 44, textAlign: 'center' }}>
                {b.label}
              </Txt>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------- linhas de dado ---------- */
export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
      <Txt color={c.textSecondary}>{label}</Txt>
      <Txt variant={strong ? 'h3' : 'mono'} style={strong ? { fontVariant: ['tabular-nums'] } : undefined}>
        {value}
      </Txt>
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.sm }} />;
}

export function Stat({ label, value, unit, inverse }: { label: string; value: string; unit?: string; inverse?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Txt variant="caption" color={inverse ? c.onHeroMuted : c.textTertiary}>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
        <Txt variant="h2" fit color={inverse ? c.onHero : c.text} style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Txt>
        {unit ? (
          <Txt variant="caption" color={inverse ? c.onHeroMuted : c.textSecondary}>
            {unit}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

/** Seletor de opções em pílulas. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

/* ---------- avatar ---------- */
export function Avatar({ initials, size = 40 }: { initials: string; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
      <Txt variant="h3" color={palette.white} style={{ fontSize: size * 0.38 }}>
        {initials}
      </Txt>
    </View>
  );
}

/* ---------- campo de texto ---------- */
export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Txt variant="caption" color="textTertiary">
        {label}
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textTertiary}
        autoCapitalize={autoCapitalize}
        style={{
          height: 48,
          borderRadius: radius.button,
          borderWidth: 1,
          borderColor: c.border,
          paddingHorizontal: space.md,
          color: c.text,
          fontFamily: 'Inter_400Regular',
          fontSize: 15,
          backgroundColor: c.surface,
        }}
      />
    </View>
  );
}

/* ---------- barra horizontal com rótulo ---------- */
export function HBar({
  label,
  valueText,
  fraction,
  tone = 'brand',
  caption,
}: {
  label: string;
  valueText: string;
  fraction: number;
  tone?: 'brand' | 'muted' | 'warning';
  caption?: string;
}) {
  const { c } = useTheme();
  const color = tone === 'brand' ? c.solar : tone === 'warning' ? c.warning : c.grid;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Txt color={c.textSecondary}>{label}</Txt>
        </View>
        <Txt variant="h3" style={{ fontVariant: ['tabular-nums'] }}>
          {valueText}
        </Txt>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: c.bg, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(2, Math.min(100, fraction * 100))}%`, height: 10, backgroundColor: color, borderRadius: 5 }} />
      </View>
      {caption ? (
        <Txt variant="caption" color="textTertiary">
          {caption}
        </Txt>
      ) : null}
    </View>
  );
}

/* ---------- gráfico por hora com linha de limite ---------- */
export function HourChart({
  values,
  limit,
  limitLabel,
  height = 130,
  unit = 'kW',
}: {
  values: number[]; // 24 valores
  limit?: number;
  limitLabel?: string;
  height?: number;
  unit?: string;
}) {
  const { c } = useTheme();
  const max = Math.max(...values, limit ?? 0, 1) * 1.08;
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: 1, borderColor: c.border }}>
        {values.map((v, h) => (
          <View key={h} style={{ flex: 1, height: (v / max) * height, minHeight: v > 0 ? 2 : 0, backgroundColor: limit != null && v > limit ? c.warning : c.solar, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
        ))}
        {limit != null ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: (limit / max) * height, flexDirection: 'row', gap: 5, overflow: 'hidden' }}>
            {Array.from({ length: 60 }, (_, i) => (
              <View key={i} style={{ width: 6, height: 2, backgroundColor: c.text, opacity: 0.55 }} />
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
        {values.map((_, h) => (
          <View key={h} style={{ flex: 1, alignItems: 'center' }}>
            {h % 3 === 0 ? (
              <Txt variant="caption" color={c.textTertiary} style={{ fontSize: 10, width: 28, textAlign: 'center' }}>
                {h}h
              </Txt>
            ) : null}
          </View>
        ))}
      </View>
      {limit != null ? (
        <Txt variant="caption" color={c.textTertiary} style={{ marginTop: 4 }}>
          - - -  {limitLabel ?? `Limite ${limit} ${unit}`}
        </Txt>
      ) : null}
    </View>
  );
}

/* ---------- aviso / insight ---------- */
export function Notice({ tone, title, children }: { tone: 'warning' | 'info' | 'success'; title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  const color = tone === 'warning' ? c.warning : tone === 'success' ? c.solar : c.info;
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.card, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
      <View style={{ width: 4, backgroundColor: color }} />
      <View style={{ flex: 1, padding: space.lg, gap: 4 }}>
        <Txt variant="h3">{title}</Txt>
        <Txt color="textSecondary">{children}</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { height: 48, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  iconBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
