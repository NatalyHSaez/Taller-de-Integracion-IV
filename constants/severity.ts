import { StatusColors } from '@/constants/theme';

export type Severidad =
  | 'NORMAL'
  | 'INFORMATIVA'
  | 'ADVERTENCIA'
  | 'ALERTA'
  | 'DATOS_INSUFICIENTES'
  | 'NO_APLICABLE'
  | 'ENTRADA_INVALIDA';

export const SEVERITY_COLORS: Record<Severidad, { bg: string; fg: string }> = {
  NORMAL: { bg: StatusColors.normal.background, fg: StatusColors.normal.foreground },
  INFORMATIVA: { bg: StatusColors.info.background, fg: StatusColors.info.foreground },
  ADVERTENCIA: { bg: StatusColors.warning.background, fg: StatusColors.warning.foreground },
  ALERTA: { bg: StatusColors.danger.background, fg: StatusColors.danger.foreground },
  DATOS_INSUFICIENTES: { bg: StatusColors.neutral.background, fg: StatusColors.neutral.foreground },
  NO_APLICABLE: { bg: StatusColors.neutral.background, fg: StatusColors.neutral.foreground },
  ENTRADA_INVALIDA: { bg: StatusColors.invalid.background, fg: StatusColors.invalid.foreground },
};

export const SEVERITY_STYLE: Record<
  Severidad,
  { bg: string; fg: string; border: string; icon: string; label: string }
> = {
  NORMAL: { ...SEVERITY_COLORS.NORMAL, border: SEVERITY_COLORS.NORMAL.fg, icon: '✓', label: 'NORMAL' },
  INFORMATIVA: { ...SEVERITY_COLORS.INFORMATIVA, border: SEVERITY_COLORS.INFORMATIVA.fg, icon: 'ℹ', label: 'INFORMATIVA' },
  ADVERTENCIA: { ...SEVERITY_COLORS.ADVERTENCIA, border: SEVERITY_COLORS.ADVERTENCIA.fg, icon: '⚠', label: 'ADVERTENCIA' },
  ALERTA: { ...SEVERITY_COLORS.ALERTA, border: SEVERITY_COLORS.ALERTA.fg, icon: '⚠', label: 'ALERTA' },
  DATOS_INSUFICIENTES: { ...SEVERITY_COLORS.DATOS_INSUFICIENTES, border: SEVERITY_COLORS.DATOS_INSUFICIENTES.fg, icon: '•', label: 'DATOS INSUFICIENTES' },
  NO_APLICABLE: { ...SEVERITY_COLORS.NO_APLICABLE, border: SEVERITY_COLORS.NO_APLICABLE.fg, icon: '•', label: 'NO APLICABLE' },
  ENTRADA_INVALIDA: { ...SEVERITY_COLORS.ENTRADA_INVALIDA, border: SEVERITY_COLORS.ENTRADA_INVALIDA.fg, icon: '•', label: 'ENTRADA INVÁLIDA' },
};
