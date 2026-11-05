/* global projectRequire, mockModule */
/**
 * Dobles de prueba de la capa HTTP y de sesión. Se instalan antes de requerir
 * los servicios. Nada sale a la red: cada llamada queda registrada.
 */
const CLINICAL_PARAMETERS = [
  { code: 'SBP', name: 'Presión sistólica', valueType: 'INTEGER', unit: 'mmHg', technicalMin: 50, technicalMax: 300 },
  { code: 'DBP', name: 'Presión diastólica', valueType: 'INTEGER', unit: 'mmHg', technicalMin: 30, technicalMax: 200 },
  { code: 'HEART_RATE', name: 'Frecuencia cardíaca', valueType: 'INTEGER', unit: 'bpm', technicalMin: 20, technicalMax: 250 },
  { code: 'GLUCOSE', name: 'Glucosa capilar', valueType: 'NUMBER', unit: 'mg/dL', technicalMin: 20, technicalMax: 800 },
  { code: 'WEIGHT', name: 'Peso corporal', valueType: 'NUMBER', unit: 'kg', technicalMin: 1, technicalMax: 400 },
];
const PARAMETER_LIMITS = [{ parameterCode: 'SBP', minValue: 60, maxValue: 280, unit: 'mmHg' }];
/** Respuesta real de GET /health-conditions en domicilia (sin conditionId ni active). */
const HEALTH_CONDITIONS = [
  { code: 'DM2', name: 'Diabetes mellitus tipo 2', parameters: [{ code: 'GLUCOSE', required: true }, { code: 'WEIGHT', required: false }] },
  { code: 'HTA', name: 'Hipertensión arterial', parameters: [{ code: 'SBP', required: true }, { code: 'DBP', required: true }, { code: 'HEART_RATE', required: false }] },
];

function installFakes({ mode = 'backend', role = 'PATIENT', userId = '11111111-1111-4111-8111-111111111111' } = {}) {
  const calls = { post: [], get: [], dataGet: [], demoSave: 0 };
  const replies = { post: [], get: [] };

  const nextReply = (queue, method, path) => {
    const reply = queue.shift();
    if (!reply) throw new Error(`Sin respuesta preparada para ${method} ${path}`);
    return typeof reply === 'function' ? reply() : reply;
  };

  mockModule('services/api.ts', {
    apiClient: {
      post: async (path, body) => {
        calls.post.push({ path, body });
        return nextReply(replies.post, 'POST', path);
      },
      get: async (path) => {
        calls.get.push({ path });
        return nextReply(replies.get, 'GET', path);
      },
    },
  });
  const session = { role };
  mockModule('services/auth-session.ts', {
    authSession: {
      mode: () => mode,
      user: () => ({ id: userId, fullName: 'Prueba', email: 'p@x.cl', roles: [session.role] }),
      subscribe: () => () => {},
    },
  });
  // Paciente elegido en el selector real (solo lo usan los cuidadores).
  const selection = { selectedPatient: null };
  mockModule('services/app-state.ts', {
    appState: { snapshot: () => ({ selectedPatient: selection.selectedPatient }) },
  });
  mockModule('services/demo-store.ts', {
    demo: {
      save: () => { calls.demoSave += 1; },
      patient: () => ({ id: 'demo-patient', name: 'Demo', email: 'd@x.cl' }),
      snapshot: () => ({ vozActiva: false }),
      permissions: () => ({ read: true, write: true, alerts: true }),
    },
  });
  mockModule('services/data/index.ts', {
    dataClient: {
      get: async (path) => {
        calls.dataGet.push(path);
        if (path === '/clinical-parameters') return CLINICAL_PARAMETERS;
        if (path === '/parameter-limits') return PARAMETER_LIMITS;
        if (path === '/health-conditions') return HEALTH_CONDITIONS;
        throw new Error(`GET inesperado ${path}`);
      },
      invalidate() {},
    },
  });
  mockModule('services/mocks/index.ts', { mockApi: {} });

  return {
    calls,
    /** Prepara la próxima respuesta (objeto, o función que puede lanzar). */
    replyPost: (reply) => replies.post.push(reply),
    replyGet: (reply) => replies.get.push(reply),
    userId,
    /** Cambia el rol del usuario de la sesión (PATIENT, CAREGIVER...). */
    setRole: (value) => { session.role = value; },
    /** Simula el paciente elegido en "Mis pacientes". */
    selectPatient: (patient) => { selection.selectedPatient = patient; },
  };
}

/** Error con la forma que produce services/errors para respuestas HTTP. */
function apiError(code, status, details = {}, message = `${code} (prueba)`) {
  const { ApiError } = projectRequire('services/errors/index.ts');
  return new ApiError({ code, status, message, details });
}

module.exports = { installFakes, apiError, CLINICAL_PARAMETERS, HEALTH_CONDITIONS };
