import { configureRelationships } from '../src/modules/relationships/application/relationships-port';
import * as relationshipsApi from '../src/modules/relationships/infrastructure/relationships-api';

configureRelationships(relationshipsApi);
