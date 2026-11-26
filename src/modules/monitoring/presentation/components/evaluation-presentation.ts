import type { ReadingEvaluation } from '../../domain/reading-query';
import { StatusColors } from '@/src/shared/presentation/theme';

/** Traduce únicamente los resultados recibidos; no interpreta mediciones. */
export function evaluationPresentation(evaluation: ReadingEvaluation) {
  const statuses = {
    NORMAL: { label: 'Normal', colors: StatusColors.normal },
    ADVERTENCIA: { label: 'Advertencia', colors: StatusColors.warning },
    ALERTA: { label: 'Alerta', colors: StatusColors.danger },
  };
  const severities = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta', MUY_ALTA: 'Muy alta' };
  return { ...statuses[evaluation.status], severity: evaluation.severity === null ? null : severities[evaluation.severity] };
}
