/* global projectRequire */
const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakes, apiError } = require('../support/fakes.cjs');
installFakes();
const { configureMonitoring } = projectRequire('src/modules/monitoring/application/ports/monitoring-port.ts');
const { clinicalParametersService } = projectRequire('src/modules/monitoring/application/use-cases/clinical-parameters.ts');
const { healthConditionsService } = projectRequire('src/modules/monitoring/application/use-cases/health-conditions.ts');
const { buildCreateReadingRequest } = projectRequire('src/modules/monitoring/application/use-cases/readings.ts');
const parameter = { code: 'WEIGHT', name: 'Peso', valueType: 'numeric', unit: 'kg', technicalMin: 2, technicalMax: 400 };
const limit = { parameterCode: 'WEIGHT', technicalMin: 3, technicalMax: 390, unit: 'kg' };
const program = { code: 'DM2', name: 'Diabetes mellitus tipo 2', parameters: [{ code: 'WEIGHT', required: false }] };
const invalid = { code: 'INVALID_API_RESPONSE' };
function setup({ catalog = [parameter], limits = [limit], programs = [program], limitError } = {}) {
  configureMonitoring({
    async listClinicalParameters() { return catalog; },
    async listParameterLimits() { if (limitError) throw limitError; return limits; },
    async listHealthConditions() { return programs; },
  });
}
test('catálogos: technicalMin/technicalMax prevalecen sin mezclar fuentes', async () => {
  setup({ limits: [{ ...limit, technicalMax: null }] });
  const result = (await clinicalParametersService.list()).WEIGHT;
  assert.deepEqual([result.technicalMin, result.technicalMax, result.limitsSource], [3, null, 'parameter-limits']);
});
test('catálogos: unidades incompatibles, límites antiguos o inválidos usan respaldo real', async () => {
  for (const limits of [[{ ...limit, unit: 'lb' }], [{ parameterCode: 'WEIGHT', minValue: 1, maxValue: 999, unit: 'kg' }], [{ ...limit, technicalMin: Infinity }], [limit, limit], [{ ...limit, technicalMin: 500 }], [{ ...limit, unit: null }]]) {
    setup({ limits });
    const result = (await clinicalParametersService.list()).WEIGHT;
    assert.deepEqual([result.technicalMin, result.technicalMax, result.limitsSource], [2, 400, 'clinical-parameters']);
  }
});
test('catálogos: no convierte 401 ni 403 del endpoint opcional en éxito', async () => {
  for (const status of [401, 403]) {
    setup({ limitError: apiError('FORBIDDEN', status) });
    await assert.rejects(clinicalParametersService.list(), { status });
  }
});
test('catálogos: distingue catálogo vacío real de respuestas incompletas o duplicadas', async () => {
  setup({ catalog: [] });
  assert.deepEqual(await clinicalParametersService.list(), {});
  for (const catalog of [null, [parameter, parameter], [{ ...parameter, technicalMin: undefined }], [{ ...parameter, technicalMax: NaN }], [{ ...parameter, technicalMin: 500 }], [{ ...parameter, name: '' }]]) {
    setup({ catalog });
    await assert.rejects(clinicalParametersService.list(), invalid);
  }
});
test('catálogos: conserva unidad nula y no habilita tipos de medición no implementados', async () => {
  setup({ catalog: [{ ...parameter, unit: null, technicalMin: null, technicalMax: null }, { ...parameter, code: 'NEW' }], limits: [] });
  const catalog = await clinicalParametersService.list();
  assert.deepEqual(Object.keys(catalog), ['WEIGHT']);
  assert.equal(catalog.WEIGHT.unit, null);
  assert.equal(catalog.WEIGHT.limitsSource, 'none');
  const body = buildCreateReadingRequest({ codes: ['WEIGHT'], values: { WEIGHT: '70,5' }, catalog, context: null, measuredAt: new Date() });
  assert.deepEqual(body.measurements, [{ parameterCode: 'WEIGHT', value: 70.5, unit: null }]);
});
test('programas: conserva required explícito y usa code como identificador', async () => {
  setup();
  assert.deepEqual(await healthConditionsService.list(), [{ id: 'DM2', ...program }]);
  setup({ programs: [] });
  assert.deepEqual(await healthConditionsService.list(), []);
});
test('programas: rechaza formatos históricos, required ausente y duplicados', async () => {
  for (const programs of [null, [program, program], [{ code: 'DM2', name: 'Diabetes', requiredParameters: ['WEIGHT'] }], [{ ...program, parameters: ['WEIGHT'] }], [{ ...program, parameters: [{ code: 'WEIGHT' }] }], [{ ...program, parameters: [...program.parameters, ...program.parameters] }]]) {
    setup({ programs });
    await assert.rejects(healthConditionsService.list(), invalid);
  }
});
