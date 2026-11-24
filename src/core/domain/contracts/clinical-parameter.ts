import type { CanonicalUnit, ClinicalParameterCode } from './reading';

export type ClinicalParameterResponse = {
  code: ClinicalParameterCode;
  name: string;
  valueType: string;
  unit: CanonicalUnit;
  technicalMin: number | null;
  technicalMax: number | null;
};
