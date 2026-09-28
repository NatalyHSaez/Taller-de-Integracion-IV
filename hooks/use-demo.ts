import { useSyncExternalStore } from 'react';
import { demo } from '@/services/demo-store';
export function useDemo() {
  const state = useSyncExternalStore(demo.subscribe, demo.snapshot, demo.snapshot);
  return { ...state, user: demo.user(), patient: demo.patient(), patients: demo.patients(), permissions: demo.permissions(), measurements: demo.measurements() };
}
