import type { ReadingResponse } from '../../types/api';
import type { Measurement } from '../../types/measurement';

/**
 * Convierte las lecturas con forma de API al modelo que ya usa la interfaz.
 * Esto permite conservar types/measurement.ts sin mezclarlo con los DTO de la API.
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
      sbp?.valueNumeric != null &&
      dbp?.valueNumeric != null &&
      heartRate?.valueNumeric != null
    ) {
      result.push({
        id: reading.readingId,
        patientId: reading.patientId,
        recordedById: reading.recordedByUserId,
        recordedBy: 'Datos simulados',
        context: reading.context ?? undefined,
        measuredAt: reading.measuredAt,
        type: 'blood_pressure',
        systolic: sbp.valueNumeric,
        diastolic: dbp.valueNumeric,
        heartRate: heartRate.valueNumeric,
      });
    }

    const glucose = byCode.get('GLUCOSE');
    if (glucose?.valueNumeric != null) {
      result.push({
        id: glucose.measurementId,
        patientId: reading.patientId,
        recordedById: reading.recordedByUserId,
        recordedBy: 'Datos simulados',
        context: reading.context ?? undefined,
        measuredAt: reading.measuredAt,
        type: 'glucose',
        value: glucose.valueNumeric,
        unit: 'mg/dL',
      });
    }

    const weight = byCode.get('WEIGHT');
    if (weight?.valueNumeric != null) {
      result.push({
        id: weight.measurementId,
        patientId: reading.patientId,
        recordedById: reading.recordedByUserId,
        recordedBy: 'Datos simulados',
        context: reading.context ?? undefined,
        measuredAt: reading.measuredAt,
        type: 'weight',
        value: weight.valueNumeric,
        unit: 'kg',
      });
    }

    return result;
  });
}
