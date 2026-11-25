import { configureMonitoring } from '../../src/modules/monitoring/application/ports/monitoring-port';
import { monitoringApi } from '../../src/modules/monitoring/infrastructure/api/monitoring-api';
import { getPatientCaregivers, getPatientDoctors } from '../../src/modules/relationships/application/use-cases/relationship-actions';
configureMonitoring({ ...monitoringApi, listCaregivers: getPatientCaregivers, listDoctors: getPatientDoctors });

import { configureReadingQueries } from '../../src/modules/monitoring/application/ports/reading-query-port';
import * as readingQueries from '../../src/modules/monitoring/infrastructure/api/readings-api';
configureReadingQueries(readingQueries);
