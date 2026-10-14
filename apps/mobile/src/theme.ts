import { useColorScheme, type TextStyle } from 'react-native';

/** Charge DS — tokens (verde royal, neutros e semânticas). */
export const palette = {
  green950: '#0B2E1F',
  green900: '#123B29',
  green700: '#1B5E3F',
  green600: '#1E7A4F',
  green500: '#2E9E6B',
  green300: '#7FD4A8',
  green100: '#DFF5E9',
  green50: '#F0FBF5',
  gray950: '#0A0F0D',
  gray700: '#3D4A44',
  gray500: '#6B7A73',
  gray300: '#C9D4CE',
  gray100: '#F2F6F4',
  white: '#FFFFFF',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 48 } as const;
export const radius = { card: 12, button: 8, pill: 999 } as const;
export const SCREEN_MARGIN = 20;

export interface Colors {
  bg: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  brand: string;
  brandText: string; // texto/ícone de marca sobre a superfície
  brandSoft: string;
  onBrandSoft: string;
  hero: string;
  onHero: string;
  onHeroMuted: string;
  solar: string;
  battery: string;
  grid: string;
  warning: string;
  danger: string;
  info: string;
}

const light: Colors = {
  bg: palette.gray100,
  surface: palette.white,
  border: palette.gray300,
  text: palette.gray950,
  textSecondary: palette.gray700,
  textTertiary: palette.gray500,
  brand: palette.green600,
  brandText: palette.green700,
  brandSoft: palette.green100,
  onBrandSoft: palette.green700,
  hero: palette.green950,
  onHero: palette.white,
  onHeroMuted: palette.green300,
  solar: palette.green600,
  battery: palette.green300,
  grid: palette.gray300,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,
};

const dark: Colors = {
  bg: palette.green950,
  surface: palette.green900,
  border: palette.green700,
  text: palette.white,
  textSecondary: palette.green300,
  textTertiary: palette.gray300,
  brand: palette.green500,
  brandText: palette.green300,
  brandSoft: palette.green700,
  onBrandSoft: palette.green100,
  hero: palette.green700,
  onHero: palette.white,
  onHeroMuted: palette.green100,
  solar: palette.green500,
  battery: palette.green300,
  grid: palette.gray500,
  warning: '#F59E0B',
  danger: '#F87171',
  info: '#60A5FA',
};

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { c: isDark ? dark : light, isDark };
}

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38 },
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  mono: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;
export type TypeVariant = keyof typeof type;
