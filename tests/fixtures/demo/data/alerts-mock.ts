/** Clasificación histórica utilizada exclusivamente por esta fixture. */
type Severidad =
  | 'NORMAL'
  | 'INFORMATIVA'
  | 'ADVERTENCIA'
  | 'ALERTA'
  | 'DATOS_INSUFICIENTES'
  | 'NO_APLICABLE'
  | 'ENTRADA_INVALIDA';
import alertasJson from './alerts-mock.json';

export type AlertaItem = {
  id: string;
  severidad: Severidad;
  parametro: string;
  mensaje: string;
  comparacion: string | null;
  fecha: string;
  hora: string;
  regla: string;
};

export const ALERTAS_INICIALES: AlertaItem[] = alertasJson as AlertaItem[];
