import type { ReadingResponse } from '../../../../src/core/infrastructure/http/dto';
import type { Measurement } from '../../../../src/modules/monitoring/domain/measurement';

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
      sbp?.valueNumeric != null &&
      dbp?.valueNumeric != null
    ) {
      result.push({
        id: reading.readingId,
        readingId: reading.readingId,
        patientId: reading.patientId,
        recordedById: reading.recordedByUserId,
        recordedBy: 'Datos simulados',
        context: reading.context ?? undefined,
        measuredAt: reading.measuredAt,
        type: 'blood_pressure',
        systolic: sbp.valueNumeric,
        diastolic: dbp.valueNumeric,
        ...(heartRate?.valueNumeric != null ? { heartRate: heartRate.valueNumeric } : {}),
      });
    }

    if (sbp?.valueNumeric != null && dbp?.valueNumeric == null) {
      result.push({ id: sbp.measurementId, readingId: reading.readingId,
        patientId: reading.patientId, recordedById: reading.recordedByUserId,
        recordedBy: 'Datos simulados', measuredAt: reading.measuredAt,
        type: 'single_pressure', parameter: 'SBP', value: sbp.valueNumeric, unit: 'mmHg' });
    }
    if (dbp?.valueNumeric != null && sbp?.valueNumeric == null) {
      result.push({ id: dbp.measurementId, readingId: reading.readingId,
        patientId: reading.patientId, recordedById: reading.recordedByUserId,
        recordedBy: 'Datos simulados', measuredAt: reading.measuredAt,
        type: 'single_pressure', parameter: 'DBP', value: dbp.valueNumeric, unit: 'mmHg' });
    }
    if (heartRate?.valueNumeric != null && (sbp?.valueNumeric == null || dbp?.valueNumeric == null)) {
      result.push({ id: heartRate.measurementId, readingId: reading.readingId,
        patientId: reading.patientId, recordedById: reading.recordedByUserId,
        recordedBy: 'Datos simulados', measuredAt: reading.measuredAt,
        type: 'heart_rate', value: heartRate.valueNumeric, unit: 'bpm' });
    }

    const glucose = byCode.get('GLUCOSE');
    if (glucose?.valueNumeric != null) {
      result.push({
        id: glucose.measurementId,
        readingId: reading.readingId,
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
        readingId: reading.readingId,
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
