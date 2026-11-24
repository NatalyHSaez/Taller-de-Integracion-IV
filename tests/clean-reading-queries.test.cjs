const test = require('node:test');
const assert = require('node:assert/strict');
const port = projectRequire('src/modules/monitoring/application/reading-query-port.ts');
test('consultas sin composición rechazan en lugar de usar infraestructura implícita', async () => {
  await assert.rejects(port.getPatientReadings('p'), /no están configuradas/);
  await assert.rejects(port.getPatientReading('p','r'), /no están configuradas/);
  await assert.rejects(port.getPatientMeasurements('p'), /no están configuradas/);
});
test('consultas conservan identificadores y filtros al delegar al repositorio', async () => {
  const calls = [];
  port.configureReadingQueries({
    async getPatientReading(...args) { calls.push(args); return {readingId:'r'}; },
    async getPatientReadings(...args) { calls.push(args); return {items:[]}; },
    async getPatientMeasurements(...args) { calls.push(args); return []; },
  });
  assert.equal((await port.getPatientReading('p','r')).readingId,'r');
  await port.getPatientReadings('p',{page:2});
  await port.getPatientMeasurements('p',{parameterCode:'SBP'});
  assert.deepEqual(calls,[['p','r'],['p',{page:2}],['p',{parameterCode:'SBP'}]]);
});
