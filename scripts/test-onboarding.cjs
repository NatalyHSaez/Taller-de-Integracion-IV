// Run with npm run test:onboarding. Uses only fictitious data and an isolated store.
const assert = require('node:assert/strict');
const { demo } = require('../tmp/onboarding-tests/services/demo-store.js');
demo.login('paciente@ejemplo.com', 'Paciente123');
assert.equal(demo.user().role, 'patient');
assert.equal(demo.patient().id, 'demo-patient');
demo.logout();
const password = 'Prueba123';
const none = { alerts: false, read: false, write: false };
const full = { alerts: true, read: true, write: true };
let checks = 0;
function check(name, run) { run(); checks++; console.log(`OK ${name}`); }
const first = demo.registerPatient('Paciente Uno', 'uno@ejemplo.com');
check('No login before activation', () => assert.throws(() => demo.login(first.email, password)));
check('Wrong activation code and email rejected', () => {
  assert.throws(() => demo.activate('bad-code', first.email, password));
  assert.throws(() => demo.activate(first.code, 'otro@ejemplo.com', password));
});
check('Reserved patient email cannot register as caregiver', () => assert.throws(() => demo.registerCaregiver('Otro', first.email, password)));
demo.activate(first.code, first.email, password);
check('Activation links existing clinical profile', () => assert.equal(demo.patient().id, first.id));
check('Activation code cannot be reused', () => assert.throws(() => demo.activate(first.code, first.email, password)));
const expiredToken = demo.invite();
const invitation = demo.invite();
check('Renewed invitation invalidates previous code', () => assert.throws(() => demo.invitation(expiredToken.token)));
demo.remember(invitation.token); demo.logout();
demo.registerCaregiver('Cuidadora Demo', 'familiar@ejemplo.com', password);
const caregiver = demo.user();
check('Invitation survives logout and registration', () => assert.equal(demo.snapshot().pendingToken, invitation.token));
check('New caregiver has no patients or permissions', () => { assert.equal(demo.patients().length, 0); assert.deepEqual(demo.permissions(), none); });
demo.request(invitation.token);
const request = demo.snapshot().relations[0];
check('Request grants no clinical access', () => { assert.equal(demo.patients().length, 0); assert.throws(() => demo.select(first.id)); assert.deepEqual(demo.measurements(), []); });
check('Duplicate request rejected', () => assert.throws(() => demo.request(invitation.token)));
check('Caregiver cannot approve their own request', () => assert.throws(() => demo.decide(request.id, 'approved', full)));
const measurement = { id: '', type: 'weight', value: 70, unit: 'kg', measuredAt: new Date().toISOString() };
check('Pending caregiver cannot write', () => assert.throws(() => demo.save(measurement)));
demo.logout(); demo.login(first.email, password); demo.decide(request.id, 'approved', { ...none, read: true });
demo.logout(); demo.login(caregiver.email, password);
check('Single approved patient automatically selected', () => assert.equal(demo.patient().id, first.id));
demo.remember(invitation.token); demo.logout(); demo.login(caregiver.email, password);
check('Approved invitation does not interrupt later logins', () => assert.equal(demo.snapshot().pendingToken, undefined));
check('Read permission does not grant write permission', () => assert.throws(() => demo.save(measurement)));
demo.logout(); demo.login(first.email, password); demo.decide(request.id, 'revoked');
demo.logout(); demo.login(caregiver.email, password);
check('Revocation removes access', () => { assert.equal(demo.patient(), undefined); assert.deepEqual(demo.permissions(), none); });
demo.request(invitation.token); const secondRequest = demo.snapshot().relations.at(-1);
demo.logout(); demo.login(first.email, password); demo.decide(secondRequest.id, 'rejected');
demo.logout(); demo.login(caregiver.email, password);
check('Rejected request gives no access', () => assert.equal(demo.patients().length, 0));
demo.request(invitation.token); const thirdRequest = demo.snapshot().relations.at(-1);
demo.logout(); demo.login(first.email, password); demo.decide(thirdRequest.id, 'approved', full);
demo.logout(); demo.login(caregiver.email, password); demo.save(measurement);
check('Measurement has patient and author', () => { const saved = demo.measurements()[0]; assert.equal(saved.patientId, first.id); assert.equal(saved.recordedById, caregiver.id); });
const second = demo.registerPatient('Paciente Dos', 'dos@ejemplo.com');
demo.logout(); demo.activate(second.code, second.email, password);
check('Patients do not share measurement history', () => assert.equal(demo.measurements().length, 0));
const invitation2 = demo.invite(); demo.logout(); demo.login(caregiver.email, password); demo.request(invitation2.token);
const fourthRequest = demo.snapshot().relations.at(-1);
demo.logout(); demo.login(second.email, password); demo.decide(fourthRequest.id, 'approved', full);
demo.logout(); demo.login(caregiver.email, password);
check('Multiple patients require a selection', () => { assert.equal(demo.patients().length, 2); assert.equal(demo.patient(), undefined); });
demo.select(second.id);
check('Selection scopes measurement history', () => assert.equal(demo.measurements().length, 0));
check('Incorrect password rejected', () => assert.throws(() => demo.login(caregiver.email, 'incorrect')));
const originalNow = Date.now;
try {
  Date.now = () => originalNow() + 2 * 86400000;
  check('Expired caregiver invitation rejected', () => assert.throws(() => demo.invitation(invitation2.token)));
} finally { Date.now = originalNow; }
const third = demo.registerPatient('Paciente Tres', 'tres@ejemplo.com');
try {
  Date.now = () => originalNow() + 2 * 86400000;
  check('Expired activation rejected', () => assert.throws(() => demo.activate(third.code, third.email, password)));
} finally { Date.now = originalNow; }
console.log(`${checks} onboarding checks passed.`);
