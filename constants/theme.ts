/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

/**
 * Fuente única de colores de la aplicación.
 *
 * - `Colors` contiene los colores semánticos que cambian según el tema.
 * - `BrandColors` contiene colores de marca y decoraciones compartidas.
 * - `MeasurementColors` diferencia visualmente cada tipo de medición.
 * - `StatusColors` representa estados clínicos y mensajes del sistema.
 *
 * Las pantallas y componentes no deben declarar códigos de color propios.
 */
const Palette = {
  white: '#FFFFFF',
  black: '#000000',

  blue50: '#F7FAFF',
  blue75: '#F2F7FF',
  blue100: '#EAF2FF',
  blue150: '#E8F1FF',
  blue175: '#DCE9FF',
  blue200: '#DCE8FF',
  blue300: '#B8C6DC',
  blue400: '#79A9FF',
  blue500: '#3478F6',
  blueDarkAccent: '#69A7FF',
  cyan300: '#73D8FF',

  ink: '#11181C',
  navy900: '#111827',
  navy800: '#172033',
  slate800: '#202A3A',
  slate700: '#243A5E',
  slate600: '#334155',
  slate500: '#35445D',
  gray700: '#687076',
  gray650: '#68758A',
  gray600: '#6B7A76',
  gray550: '#8A9591',
  gray500: '#8B98AA',
  gray400: '#9BA1A6',
  gray350: '#A9B7CB',
  textDark: '#ECEDEE',

  rose50: '#FFF0F3',
  rose400: '#FF7A91',
  rose500: '#EF476F',
  rose900: '#512A3A',
  purple50: '#F5E9FF',
  purple500: '#9333EA',
  purple400: '#C084FC',
  purple900: '#40295A',

  red50: '#FFF1EF',
  red100: '#FBEAE8',
  red200: '#F3D4CF',
  red600: '#C1443A',
  red900: '#321F1E',
  red800: '#57302D',
  green50: '#EAF5EE',
  green600: '#2E8B57',
  info50: '#E8F0FB',
  info600: '#3162A6',
  amber50: '#FCF3E2',
  amber600: '#C88A1E',
  neutral50: '#F0F2F1',

  whiteOverlay08: '#FFFFFF14',
  whiteOverlay12: '#FFFFFF1F',
  whiteOverlay14: '#FFFFFF24',
  whiteBorder18: '#FFFFFF2E',
  whiteBorder22: '#FFFFFF38',
  primaryGhost: '#3478F60F',
  primaryGhostDark: '#69A7FF12',
  purpleGhost: '#9333EA0F',
  purpleGhostDark: '#C084FC12',
} as const;

export const BrandColors = {
  primary: Palette.blue500,
  heroHighlight: Palette.blue400,
  heroAccent: Palette.cyan300,
  onPrimary: Palette.white,
  onPrimaryMuted: Palette.blue150,
  onPrimaryEyebrow: Palette.blue175,
  overlaySubtle: Palette.whiteOverlay08,
  overlay: Palette.whiteOverlay12,
  overlayStrong: Palette.whiteOverlay14,
  overlayBorder: Palette.whiteBorder18,
  overlayBorderStrong: Palette.whiteBorder22,
  primaryGhost: Palette.primaryGhost,
  primaryGhostDark: Palette.primaryGhostDark,
  shadow: Palette.blue500,
  neutralShadow: Palette.black,
} as const;

export const MeasurementColors = {
  light: {
    blood_pressure: { accent: Palette.rose500, background: Palette.rose50 },
    glucose: { accent: Palette.blue500, background: Palette.blue100 },
    weight: { accent: Palette.purple500, background: Palette.purple50 },
  },
  dark: {
    blood_pressure: { accent: Palette.rose400, background: Palette.rose900 },
    glucose: { accent: Palette.blueDarkAccent, background: Palette.slate700 },
    weight: { accent: Palette.purple400, background: Palette.purple900 },
  },
} as const;

export const AccentColors = {
  light: {
    purple: Palette.purple500,
    purpleSoft: Palette.purple50,
    purpleGhost: Palette.purpleGhost,
  },
  dark: {
    purple: Palette.purple400,
    purpleSoft: Palette.purple900,
    purpleGhost: Palette.purpleGhostDark,
  },
} as const;

export const StatusColors = {
  normal: { background: Palette.green50, foreground: Palette.green600 },
  info: { background: Palette.info50, foreground: Palette.info600 },
  warning: { background: Palette.amber50, foreground: Palette.amber600 },
  danger: { background: Palette.red100, foreground: Palette.red600 },
  neutral: { background: Palette.neutral50, foreground: Palette.gray600 },
  invalid: { background: Palette.neutral50, foreground: Palette.gray550 },
} as const;

export const Colors = {
  light: {
    text: Palette.ink,
    background: Palette.blue75,
    surface: Palette.white,
    surfaceMuted: Palette.blue50,
    primary: Palette.blue500,
    primarySoft: Palette.blue100,
    onPrimary: Palette.white,
    onPrimaryMuted: Palette.blue150,
    border: Palette.blue200,
    icon: Palette.gray700,
    mutedText: Palette.gray650,
    placeholder: Palette.gray500,
    disabled: Palette.blue300,
    danger: Palette.red600,
    dangerBackground: Palette.red50,
    dangerBorder: Palette.red200,
    tint: Palette.blue500,
    tabBarBackground: Palette.white,
    tabBarBorder: Palette.blue200,
    tabIconDefault: Palette.gray700,
    tabIconSelected: Palette.blue500,
  },
  dark: {
    text: Palette.textDark,
    background: Palette.navy900,
    surface: Palette.slate800,
    surfaceMuted: Palette.navy800,
    primary: Palette.blueDarkAccent,
    primarySoft: Palette.slate700,
    onPrimary: Palette.white,
    onPrimaryMuted: Palette.blue150,
    border: Palette.slate500,
    icon: Palette.gray400,
    mutedText: Palette.gray350,
    placeholder: Palette.gray500,
    disabled: Palette.slate600,
    danger: Palette.red600,
    dangerBackground: Palette.red900,
    dangerBorder: Palette.red800,
    tint: Palette.blueDarkAccent,
    tabBarBackground: Palette.slate800,
    tabBarBorder: Palette.slate500,
    tabIconDefault: Palette.gray400,
    tabIconSelected: Palette.blueDarkAccent,
  },
} as const;

export type ThemeName = keyof typeof Colors;
export type AppTheme = (typeof Colors)[ThemeName];

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
