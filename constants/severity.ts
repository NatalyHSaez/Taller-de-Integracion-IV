// Paleta compartida de severidad, para usar en cualquier pantalla que muestre
// el resultado del motor de evaluación (Alertas, Resumen, Documentos, etc.).
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
