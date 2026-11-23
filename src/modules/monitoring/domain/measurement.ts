export type MeasurementType = 'blood_pressure' | 'glucose' | 'weight' | 'heart_rate' | 'single_pressure';

type BaseMeasurement = {
  patientId?: string;
  readingId?: string;
  recordedBy?: string;
  recordedById?: string;
  context?: string;
  readingStatus?: 'PENDING' | 'REQUIRES_CONFIRMATION' | 'EVALUATED';
  id: string;
  measuredAt: string;
};

export type BloodPressureMeasurement = BaseMeasurement & {
  type: 'blood_pressure';
  systolic: number;
  diastolic: number;
  heartRate?: number;
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

export type HeartRateMeasurement = BaseMeasurement & { type: 'heart_rate'; value: number; unit: 'bpm' };

export type SinglePressureMeasurement = BaseMeasurement & { type: 'single_pressure'; parameter: 'SBP' | 'DBP'; value: number; unit: 'mmHg' };

export type Measurement =
  | HeartRateMeasurement
  | SinglePressureMeasurement
  | BloodPressureMeasurement
  | GlucoseMeasurement
  | WeightMeasurement;

export type MeasurementFilter = 'all' | MeasurementType;
