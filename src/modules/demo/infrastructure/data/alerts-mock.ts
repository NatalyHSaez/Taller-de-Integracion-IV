import type { Severidad } from '@/src/modules/evaluation/domain/severity';
import alertasJson from '@/src/modules/demo/infrastructure/data/alerts-mock.json';

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