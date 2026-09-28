import type { Severidad } from '@/constants/severity';
import alertasJson from '@/data/alerts-mock.json';

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