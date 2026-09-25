export type MeasurementType = 'blood_pressure' | 'glucose' | 'weight';

type BaseMeasurement = {
  id: string;
  measuredAt: string;
};

export type BloodPressureMeasurement = BaseMeasurement & {
  type: 'blood_pressure';
  systolic: number;
  diastolic: number;
  heartRate: number;
};

export type GlucoseMeasurement = BaseMeasurement & {
  type: 'glucose';
  value: number;
  unit: 'mg/dL';
};

export type WeightMeasurement = BaseMeasurement & {
  type: 'weight';
  value: number;
  unit: 'kg';
};

export type Measurement =
  | BloodPressureMeasurement
  | GlucoseMeasurement
  | WeightMeasurement;

export type MeasurementFilter = 'all' | MeasurementType;
