import { configureHomeSummary } from '../../src/modules/dashboard/application/ports/home-summary-port';
import { loadChartMeasurements } from '../../src/modules/monitoring/application/use-cases/measurement-series';
import { backendAlertsService } from '../../src/modules/evaluation/infrastructure/api/alerts-api';
import { relationshipsRepository } from '../../src/modules/relationships/application/ports/relationships-port';

configureHomeSummary({
  measurements: (patientId) => loadChartMeasurements(patientId),
  openAlerts: (patientId) => backendAlertsService.list(patientId, 'OPEN'),
  async caregiverPermissions(patientId) {
    const mine = await relationshipsRepository().getMePatients();
    return mine.find((item) => item.patientId === patientId && item.relationshipType === 'CAREGIVER')?.permissions ?? [];
  },
});
