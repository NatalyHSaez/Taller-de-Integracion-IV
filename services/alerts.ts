import type { AlertaItem } from '@/constants/alerts-mock';
// El primer ingreso comienza sin alertas clínicas. La evaluación vendrá de la API.
export function getDemoAlerts(): AlertaItem[] { return []; }
export async function getAlerts(): Promise<AlertaItem[]> { return getDemoAlerts(); }
