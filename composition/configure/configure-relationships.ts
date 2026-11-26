import { configureRelationships } from '../../src/modules/relationships/application/ports/relationships-port';
import * as relationshipsApi from '../../src/modules/relationships/infrastructure/api/relationships-api';

configureRelationships(relationshipsApi);
