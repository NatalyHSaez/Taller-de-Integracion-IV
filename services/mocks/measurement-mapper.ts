import type { ReadingResponse } from '../../types/api';
import type { Measurement } from '../../types/measurement';

/**
 * Convierte las lecturas con forma de API al modelo que ya usa la interfaz.
 * Se conserva readingId para poder navegar posteriormente al detalle de la
 * lectura completa, incluso cuando una lectura contiene varias mediciones.
 */
export function readingsToMeasurements(readings: ReadingResponse[]): Measurement[] {
  return readings.flatMap((reading) => {
    const result: Measurement[] = [];
    const byCode = new Map(
      reading.measurements.map((measurement) => [measurement.parameterCode, measurement]),
    );

    const sbp = byCode.get('SBP');
    const dbp = byCode.get('DBP');
    const heartRate = byCode.get('HEART_RATE');

    if (
      sbp?.value != null &&
      dbp?.value != null &&
      heartRate?.value != null
    ) {
      result.push({
        id: reading.readingId,
        readingId: reading.readingId,
        patientId: reading.patientId,
        recordedById: reading.recordedBy,
        recordedBy: 'Datos simulados',
        context: reading.context ?? undefined,
        measuredAt: reading.measuredAt,
        type: 'blood_pressure',
        systolic: sbp.value,
        diastolic: dbp.value,
        heartRate: heartRate.value,
      });
    }

    const glucose = byCode.get('GLUCOSE');
    if (glucose?.value != null) {
      result.push({
        id: glucose.measurementId,
        readingId: reading.readingId,
        patientId: reading.patientId,
        recordedById: reading.recordedBy,
        recordedBy: 'Datos simulados',
        context: reading.context ?? undefined,
        measuredAt: reading.measuredAt,
        type: 'glucose',
        value: glucose.value,
        unit: 'mg/dL',
      });
    }

    const weight = byCode.get('WEIGHT');
    if (weight?.value != null) {
      result.push({
        id: weight.measurementId,
        readingId: reading.readingId,
        patientId: reading.patientId,
        recordedById: reading.recordedBy,
        recordedBy: 'Datos simulados',
        context: reading.context ?? undefined,
        measuredAt: reading.measuredAt,
        type: 'weight',
        value: weight.value,
        unit: 'kg',
      });
    }

    return result;
  });
}
