import type { Measurement } from '@/types/measurement';

export const MEASUREMENTS_MOCK: Measurement[] = [
  {
    id: 'measurement-1',
    type: 'blood_pressure',
    systolic: 128,
    diastolic: 82,
    heartRate: 72,
    measuredAt: '2026-09-23T10:30:00',
  },
  {
    id: 'measurement-2',
    type: 'glucose',
    value: 108,
    unit: 'mg/dL',
    measuredAt: '2026-09-23T08:20:00',
  },
  {
    id: 'measurement-3',
    type: 'weight',
    value: 78.4,
    unit: 'kg',
    measuredAt: '2026-09-22T18:10:00',
  },
  {
    id: 'measurement-4',
    type: 'blood_pressure',
    systolic: 124,
    diastolic: 80,
    heartRate: 69,
    measuredAt: '2026-09-22T09:05:00',
  },
  {
    id: 'measurement-5',
    type: 'glucose',
    value: 114,
    unit: 'mg/dL',
    measuredAt: '2026-09-21T12:40:00',
  },
  {
    id: 'measurement-6',
    type: 'weight',
    value: 78.8,
    unit: 'kg',
    measuredAt: '2026-09-20T07:55:00',
  },
  {
    id: 'measurement-7',
    type: 'blood_pressure',
    systolic: 131,
    diastolic: 84,
    heartRate: 74,
    measuredAt: '2026-09-19T20:15:00',
  },
];
