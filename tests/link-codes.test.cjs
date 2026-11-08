/* global projectRequire, mockModule, __dirname */
/**
 * Vinculación por código: normalización, cuenta regresiva de 5 minutos,
 * un solo uso, errores del backend, confirmación y tipos CAREGIVER/DOCTOR.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ApiError } = projectRequire('src/core/infrastructure/http/errors/index.ts');
const apiError = (code, status) => new ApiError({ code, status, message: `backend ${code}` });

/** Backend simulado con la lógica de relaciones/rutas.py (usar_codigo). */
const codes = new Map();
const sentCodes = [];
mockModule('src/modules/relationships/infrastructure/relationships-api.ts', {
  async consumeLinkCode(code) {
    sentCodes.push(code);
    if (!/^[A-Z0-9]{6}$/.test(code)) throw apiError('INVALID_CODE_FORMAT', 422);
    const row = codes.get(code);
    if (!row) throw apiError('CODE_NOT_FOUND', 404);
    if (row.status === 'used') throw apiError('CODE_USED', 410);
    row.status = 'used';
    return { relationshipId: 'rel-1', relationshipType: row.type, patientId: 'pia', patientName: 'Pía', permissions: [], linkedAt: '2026-11-06T10:00:00Z' };
  },
});

const links = projectRequire('src/modules/relationships/application/link-codes.ts');
const read = (...p) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8').replace(/\r/g, '');

test('normaliza espacios, guiones y minúsculas (también enlaces escaneados)', () => {
  assert.equal(links.normalizeLinkCode(' ab-12 cd '), 'AB12CD');
  assert.equal(links.normalizeLinkCode('ab 1-2\tcd'), 'AB12CD');
  assert.equal(links.normalizeLinkCode('domicilia://invitacion?code=ab-12cd&x=1'), 'AB12CD');
  assert.equal(links.normalizeLinkCode('https://x.cl/i?token=xy%2034zw'), 'XY34ZW');
  assert.equal(links.normalizeLinkCode(null), '');
});

test('cuenta regresiva: 5 minutos y luego vencido', () => {
  const start = Date.parse('2026-11-06T10:00:00Z');
  const expiresAt = new Date(start + links.LINK_CODE_LIFETIME_SECONDS * 1000).toISOString();
  assert.equal(links.secondsLeft(expiresAt, start), 300);
  assert.equal(links.formatCountdown(links.secondsLeft(expiresAt, start)), '5:00');
  assert.equal(links.formatCountdown(links.secondsLeft(expiresAt, start + 28_000)), '4:32');
  assert.equal(links.secondsLeft(expiresAt, start + 300_000), 0);
  assert.equal(links.secondsLeft(expiresAt, start + 999_000), 0, 'nunca negativo');
  assert.equal(links.secondsLeft('no es fecha', start), 0);
});

test('un código se consume una sola vez y deja la confirmación del vínculo', async () => {
  codes.set('AB12CD', { type: 'CAREGIVER', status: 'pending' });
  const result = await links.consumeLinkCode(' ab-12 cd ');
  assert.equal(sentCodes.at(-1), 'AB12CD', 'se envía normalizado');
  assert.equal(result.relationshipId, 'rel-1');

  const confirmation = links.takeLinkConfirmation();
  assert.equal(confirmation.patientName, 'Pía');
  assert.equal(links.LINK_TYPE_LABELS[confirmation.relationshipType], 'cuidador');
  assert.equal(links.takeLinkConfirmation(), null, 'la confirmación se muestra una vez');

  await assert.rejects(links.consumeLinkCode('AB12CD'), /ya fue usado/);
  assert.equal(links.takeLinkConfirmation(), null, 'un intento fallido no deja confirmación');
});

test('código vacío no llama al backend', async () => {
  const before = sentCodes.length;
  await assert.rejects(links.consumeLinkCode('  - '), /Escribe o escanea/);
  assert.equal(sentCodes.length, before);
});

test('mensajes para vencido, usado, anulado, rol, ya vinculado, propio código e intentos', () => {
  const cases = {
    CODE_EXPIRED: [410, /venció/, true],
    CODE_USED: [410, /ya fue usado/, true],
    CODE_REVOKED: [410, /anuló/, true],
    ROLE_NOT_ALLOWED: [403, /tipo de cuenta/, false],
    ALREADY_LINKED: [409, /Ya estás vinculado/, false],
    SELF_LINK: [409, /propio código/, false],
    TOO_MANY_ATTEMPTS: [429, /Demasiados intentos/, false],
    INVALID_CODE_FORMAT: [422, /6 caracteres/, false],
    CODE_NOT_FOUND: [404, /no es válido/, false],
  };
  for (const [code, [status, pattern, needsNewCode]] of Object.entries(cases)) {
    const info = links.describeLinkCodeError(apiError(code, status));
    assert.match(info.message, pattern, code);
    assert.equal(info.needsNewCode, needsNewCode, code);
  }
  assert.match(links.describeLinkCodeError(new TypeError('Network request failed')).message, /conexión/);
});

test('pantallas: QR solo con code, cuenta regresiva, código para médico y confirmación', () => {
  const vinculos = read('app', '(tabs)', 'vinculos.tsx');
  assert.match(vinculos, /<QRCode value=\{realLinkCode\.code\}/, 'el QR del cuidador contiene solo code');
  assert.match(vinculos, /<LinkCodeCountdown\s+expiresAt=\{realLinkCode\.expiresAt\}/);
  assert.match(vinculos, /<DoctorLinkCodeCard patientId=\{user\.id\} \/>/);

  const doctor = read('src', 'modules', 'relationships', 'presentation', 'components', 'doctor-link-code-card.tsx');
  assert.match(doctor, /createPatientLinkCode\(patientId, 'DOCTOR'\)/);
  assert.match(doctor, /<QRCode value=\{linkCode\.code\}/);

  const invitacion = read('app', 'invitacion.tsx');
  assert.match(invitacion, /import \{ consumeLinkCode \} from '@\/src\/modules\/relationships\/application\/link-codes';/);
  assert.match(invitacion, /<CameraView/, 'lectura por cámara');
  const realStart = invitacion.indexOf("sessionMode === 'backend' && user?.role === 'caregiver' ? (");
  const realEnd = invitacion.indexOf('    ) : (\n      <>', realStart);
  assert.ok(realStart > 0 && realEnd > realStart);
  assert.doesNotMatch(invitacion.slice(realStart, realEnd), /demo\.|invitations|inspect\(/, 'el flujo real no usa invitaciones simuladas');
  const linkFn = invitacion.slice(invitacion.indexOf('async function linkRealPatient'), invitacion.indexOf('function inspect('));
  assert.match(linkFn, /await consumeLinkCode\(/);
  assert.doesNotMatch(linkFn, /demo\./);

  const select = read('app', '(auth)', 'select-patient.tsx');
  assert.match(select, /takeLinkConfirmation\(\)/);
  assert.match(select, /Te vinculaste con/);
});
