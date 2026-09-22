// Paleta compartida de severidad, para usar en cualquier pantalla que muestre
// el resultado del motor de evaluación (Alertas, Resumen, Documentos, etc.).
export type Severidad =
  | 'NORMAL'
  | 'INFORMATIVA'
  | 'ADVERTENCIA'
  | 'ALERTA'
  | 'DATOS_INSUFICIENTES'
  | 'NO_APLICABLE'
  | 'ENTRADA_INVALIDA';

export const SEVERITY_COLORS: Record<Severidad, { bg: string; fg: string }> = {
  NORMAL: { bg: '#EAF5EE', fg: '#2E8B57' },
  INFORMATIVA: { bg: '#E8F0FB', fg: '#3162A6' },
  ADVERTENCIA: { bg: '#FCF3E2', fg: '#C88A1E' },
  ALERTA: { bg: '#FBEAE8', fg: '#C1443A' },
  DATOS_INSUFICIENTES: { bg: '#F0F2F1', fg: '#6B7A76' },
  NO_APLICABLE: { bg: '#F0F2F1', fg: '#6B7A76' },
  ENTRADA_INVALIDA: { bg: '#F0F2F1', fg: '#8A9591' },
};