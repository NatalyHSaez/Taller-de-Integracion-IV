import type { ClinicalParameterCode } from './reading';

export type ClinicalParameterResponse = {
  code: ClinicalParameterCode;
  name: string;
  valueType: string;
  unit: string | null;
  technicalMin: number | null;
  technicalMax: number | null;
};
