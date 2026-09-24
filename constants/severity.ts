export type Severidad =
  | 'NORMAL'
  | 'INFORMATIVA'
  | 'ADVERTENCIA'
  | 'ALERTA'
  | 'DATOS_INSUFICIENTES'
  | 'NO_APLICABLE'
  | 'ENTRADA_INVALIDA';

export const SEVERITY_STYLE: Record<Severidad, { bg: string; fg: string; border: string; icon: string; label: string }> = {
  NORMAL: { bg: '#EAF5EE', fg: '#2E8B57', border: '#2E8B57', icon: '✓', label: 'NORMAL' },
  INFORMATIVA: { bg: '#E8F0FB', fg: '#3162A6', border: '#3162A6', icon: 'ℹ', label: 'INFORMATIVA' },
  ADVERTENCIA: { bg: '#FCF3E2', fg: '#C88A1E', border: '#C88A1E', icon: '⚠', label: 'ADVERTENCIA' },
  ALERTA: { bg: '#FBEAE8', fg: '#C1443A', border: '#C1443A', icon: '⚠', label: 'ALERTA' },
  DATOS_INSUFICIENTES: { bg: '#F0F2F1', fg: '#6B7A76', border: '#6B7A76', icon: '•', label: 'DATOS INSUFICIENTES' },
  NO_APLICABLE: { bg: '#F0F2F1', fg: '#6B7A76', border: '#6B7A76', icon: '•', label: 'NO APLICABLE' },
  ENTRADA_INVALIDA: { bg: '#F0F2F1', fg: '#8A9591', border: '#8A9591', icon: '•', label: 'ENTRADA INVÁLIDA' },
};