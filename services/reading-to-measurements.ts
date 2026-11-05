
import type { ReadingResponse } from "@/services/api";
import type { Measurement } from "@/types/measurement";

export function readingsToMeasurements(
  readings: ReadingResponse[],
): Measurement[] {
  const result: Measurement[] = [];

  for (const reading of readings) {
    const values = new Map(
      reading.measurements.map((item) => [
        item.parameterCode,
        item.value,
      ]),
    );

    const systolic = values.get("SBP");
    const diastolic = values.get("DBP");
    const heartRate = values.get("HEART_RATE");
    const glucose = values.get("GLUCOSE");
    const weight = values.get("WEIGHT");

    if (
      systolic !== undefined &&
      diastolic !== undefined &&
      heartRate !== undefined
    ) {
      result.push({
        id: reading.readingId,
        readingId: reading.readingId,
        type: "blood_pressure",
        measuredAt: reading.measuredAt,
        systolic,
        diastolic,
        heartRate,
      });
    }

    if (glucose !== undefined) {
      result.push({
        id: `${reading.readingId}-glucose`,
        readingId: reading.readingId,
        type: "glucose",
        measuredAt: reading.measuredAt,
        value: glucose,
        unit: "mg/dL",
      });
    }

    if (weight !== undefined) {
      result.push({
        id: `${reading.readingId}-weight`,
        readingId: reading.readingId,
        type: "weight",
        measuredAt: reading.measuredAt,
        value: weight,
        unit: "kg",
      });
    }
  }

  return result;
}
