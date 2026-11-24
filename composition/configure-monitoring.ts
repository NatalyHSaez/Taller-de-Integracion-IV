import { configureMonitoring } from '../src/modules/monitoring/application/monitoring-port';
import { monitoringApi } from '../src/modules/monitoring/infrastructure/monitoring-api';
import { getPatientCaregivers, getPatientDoctors } from '../src/modules/relationships/application/relationship-actions';
configureMonitoring({ ...monitoringApi, listCaregivers: getPatientCaregivers, listDoctors: getPatientDoctors });

import { configureReadingQueries } from '../src/modules/monitoring/application/reading-query-port';
import * as readingQueries from '../src/modules/monitoring/infrastructure/readings-api';
configureReadingQueries(readingQueries);
