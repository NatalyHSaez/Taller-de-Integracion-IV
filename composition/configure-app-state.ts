import { configureAppState } from '../src/core/application/session/app-state';
import { dataClient } from '../src/core/infrastructure/http/data';
import { getMePatients } from '../src/modules/relationships/infrastructure/relationships-api';

/** Único punto donde se conectan los adaptadores reales del estado global. */
configureAppState({
  listLinkedPatients: getMePatients,
  clearClinicalCache: () => dataClient.clearCache(),
});
