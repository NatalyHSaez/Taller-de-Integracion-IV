import type { AlertaItem } from '@/constants/alerts-mock';
import type { Measurement } from '@/types/measurement';
import { demo } from './demo-store';

// ⚠️ Umbrales simplificados SOLO para la demo. El motor real (media móvil,
// tendencia, variabilidad, adherencia) lo construye Integración II —
// esto no debe usarse como referencia clínica.
const MIN_LECTURAS = 3;

const average = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;

function evaluarPresion(lecturas: Extract<Measurement, { type: 'blood_pressure' }>[]): AlertaItem | null {
  if (lecturas.length < MIN_LECTURAS) return null;
  const recientes = lecturas.slice(-MIN_LECTURAS);
  const avgSys = average(recientes.map((r) => r.systolic));
  const avgDia = average(recientes.map((r) => r.diastolic));
  const subiendo = recientes.every((r, i) => i === 0 || r.systolic >= recientes[i - 1].systolic);

  let severidad: AlertaItem['severidad'] = 'NORMAL';
  if (avgSys >= 140 || avgDia >= 90) severidad = 'ALERTA';
  else if (avgSys >= 130 || avgDia >= 85) severidad = 'ADVERTENCIA';
  if (severidad === 'NORMAL') return null;

  const ultima = recientes[recientes.length - 1];
  return {
    id: `trend-bp-${ultima.id}`,
    severidad,
    parametro: 'Presión arterial',
    mensaje: `Promedio de las últimas ${MIN_LECTURAS} mediciones: ${avgSys.toFixed(0)}/${avgDia.toFixed(0)} mmHg${subiendo ? ', con tendencia al alza' : ''}.`,
    comparacion: `Última lectura: ${ultima.systolic}/${ultima.diastolic} mmHg.`,
    fecha: new Date(ultima.measuredAt).toLocaleDateString('es-CL'),
    hora: new Date(ultima.measuredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    regla: 'HTA-demo v1 (umbral simplificado)',
  };
}

function evaluarGlucosa(lecturas: Extract<Measurement, { type: 'glucose' }>[]): AlertaItem | null {
  if (lecturas.length < MIN_LECTURAS) return null;
  const recientes = lecturas.slice(-MIN_LECTURAS);
  const avg = average(recientes.map((r) => r.value));

  let severidad: AlertaItem['severidad'] = 'NORMAL';
  if (avg >= 126) severidad = 'ALERTA';
  else if (avg >= 100) severidad = 'ADVERTENCIA';
  if (severidad === 'NORMAL') return null;

  const ultima = recientes[recientes.length - 1];
  return {
    id: `trend-glucose-${ultima.id}`,
    severidad,
    parametro: 'Glucosa',
    mensaje: `Promedio de las últimas ${MIN_LECTURAS} mediciones: ${avg.toFixed(0)} mg/dL.`,
    comparacion: `Última lectura: ${ultima.value} mg/dL.`,
    fecha: new Date(ultima.measuredAt).toLocaleDateString('es-CL'),
    hora: new Date(ultima.measuredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    regla: 'DM2-demo v1 (umbral simplificado)',
  };
}

export function getDemoAlerts(): AlertaItem[] {
  const mediciones = demo.measurements();

  const presion = mediciones
    .filter((m): m is Extract<Measurement, { type: 'blood_pressure' }> => m.type === 'blood_pressure')
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

  const glucosa = mediciones
    .filter((m): m is Extract<Measurement, { type: 'glucose' }> => m.type === 'glucose')
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

  return [evaluarPresion(presion), evaluarGlucosa(glucosa)].filter((a): a is AlertaItem => a !== null);
}

export async function getAlerts(): Promise<AlertaItem[]> {
  return getDemoAlerts();
}