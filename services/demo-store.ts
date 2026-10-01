import type { CurrentUserResponse } from '../types/api';
import type { Measurement } from '../types/measurement';
import {
  MOCK_ACCOUNTS,
  MOCK_CAREGIVER_RELATIONSHIPS,
  MOCK_PATIENTS,
  MOCK_READINGS,
} from './mocks/api-data';
import { readingsToMeasurements } from './mocks/measurement-mapper';

export type Permissions = { alerts: boolean; read: boolean; write: boolean };
export type Account = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'patient' | 'caregiver';
  patientId?: string;
};
export type Profile = {
  id: string;
  name: string;
  email: string;
  code: string;
  expires: number;
  activated: boolean;
};
export type Invitation = { token: string; patientId: string; expires: number };
export type Relation = {
  id: string;
  patientId: string;
  caregiverId: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  permissions: Permissions;
};
type State = {
  accounts: Account[];
  profiles: Profile[];
  invitations: Invitation[];
  relations: Relation[];
  measurements: Measurement[];
  userId?: string;
  selectedId?: string;
  pendingToken?: string;
};

const emptyPermissions = (): Permissions => ({ alerts: false, read: false, write: false });

const initialAccounts: Account[] = MOCK_ACCOUNTS
  .filter((account) => account.role === 'PATIENT' || account.role === 'CAREGIVER')
  .map((account) => ({
    id: account.userId,
    name: `${account.firstName} ${account.lastName}`,
    email: account.email,
    password: account.password,
    role: account.role === 'PATIENT' ? 'patient' : 'caregiver',
    patientId: account.patientId,
  }));

const initialProfiles: Profile[] = MOCK_PATIENTS.map((patient) => {
  const account = MOCK_ACCOUNTS.find((item) => item.patientId === patient.patientId);

  return {
    id: patient.patientId,
    name: `${patient.firstName} ${patient.lastName}`,
    email: account?.email ?? `${patient.patientId}@mock.local`,
    code: 'DEMO-ACTIVATED',
    expires: 0,
    activated: true,
  };
});

const initialRelations: Relation[] = MOCK_CAREGIVER_RELATIONSHIPS.map((relationship) => ({
  id: relationship.relationshipId,
  patientId: relationship.patientId,
  caregiverId: relationship.caregiverUserId,
  status: relationship.status === 'ACTIVE' ? 'approved' : 'revoked',
  permissions: {
    alerts: relationship.permissions.includes('ALERT_VIEW'),
    read: relationship.permissions.includes('MEASUREMENT_VIEW'),
    write: relationship.permissions.includes('MEASUREMENT_CREATE'),
  },
}));

/**
 * El almacén demo usa los mismos datos de services/mocks.
 * Por eso, al iniciar la app, las mediciones ficticias ya están disponibles en memoria.
 */
let state: State = {
  accounts: initialAccounts,
  profiles: initialProfiles,
  invitations: [],
  relations: initialRelations,
  measurements: readingsToMeasurements(MOCK_READINGS),
};

const listeners = new Set<() => void>();
const id = () => Math.random().toString(36).slice(2, 10).toUpperCase();
const update = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};
const fail = (message: string): never => {
  throw new Error(message);
};

function credentials(email: string, password: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    fail('Ingresa un correo válido.');
  }
  if (password.length < 8) {
    fail('La contraseña debe tener al menos 8 caracteres.');
  }
  if (state.accounts.some((a) => a.email === email.trim().toLowerCase())) {
    fail('Ya existe una cuenta con ese correo.');
  }
}

function backendRole(user: CurrentUserResponse): Account['role'] | null {
  if (user.roles.includes('paciente')) return 'patient';
  if (user.roles.includes('cuidador')) return 'caregiver';
  return null;
}

/**
 * Proyecta un usuario autenticado por el backend sobre los datos mock que todavía
 * usa la interfaz. No guarda la contraseña real y no reemplaza los datos clínicos
 * ficticios: solo crea el contexto local necesario para navegar mientras esos
 * endpoints todavía no están implementados.
 */
function openBackendDemoSession(user: CurrentUserResponse) {
  const role = backendRole(user);
  if (!role) {
    fail('La aplicación móvil actual solo admite pacientes y cuidadores.');
  }

  const existingAccount = state.accounts.find((account) => account.id === user.id);

  if (role === 'patient') {
    const patientId = `backend-patient-${user.id}`;
    const templatePatientId = initialProfiles[0]?.id;

    const account: Account = existingAccount ?? {
      id: user.id,
      name: user.nombre_completo,
      email: user.correo.toLowerCase(),
      password: '',
      role: 'patient',
      patientId,
    };

    const profileExists = state.profiles.some((profile) => profile.id === patientId);
    const profile: Profile = {
      id: patientId,
      name: user.nombre_completo,
      email: user.correo.toLowerCase(),
      code: 'BACKEND-SESSION',
      expires: 0,
      activated: true,
    };

    const hasMeasurements = state.measurements.some(
      (measurement) => measurement.patientId === patientId,
    );

    const clonedMeasurements =
      !hasMeasurements && templatePatientId
        ? state.measurements
            .filter((measurement) => measurement.patientId === templatePatientId)
            .map((measurement) => ({
              ...measurement,
              id: `backend-${user.id}-${measurement.id}`,
              patientId,
            }))
        : [];

    update({
      accounts: existingAccount
        ? state.accounts.map((item) =>
            item.id === user.id
              ? {
                  ...item,
                  name: user.nombre_completo,
                  email: user.correo.toLowerCase(),
                  role: 'patient',
                  patientId,
                }
              : item,
          )
        : [...state.accounts, account],
      profiles: profileExists
        ? state.profiles.map((item) => (item.id === patientId ? profile : item))
        : [...state.profiles, profile],
      measurements:
        clonedMeasurements.length > 0
          ? [...state.measurements, ...clonedMeasurements]
          : state.measurements,
      userId: user.id,
      selectedId: patientId,
    });
    return;
  }

  // Cuidador real + pacientes ficticios mientras Relaciones todavía siga mockeado.
  const account: Account = existingAccount ?? {
    id: user.id,
    name: user.nombre_completo,
    email: user.correo.toLowerCase(),
    password: '',
    role: 'caregiver',
  };

  const templateRelations = initialRelations.filter((relation) => relation.status === 'approved');
  const relationsToCreate = templateRelations
    .filter(
      (template) =>
        !state.relations.some(
          (relation) =>
            relation.caregiverId === user.id && relation.patientId === template.patientId,
        ),
    )
    .map((template) => ({
      ...template,
      id: `backend-${user.id}-${template.id}`,
      caregiverId: user.id,
      permissions: { ...template.permissions },
    }));

  const nextAccounts = existingAccount
    ? state.accounts.map((item) =>
        item.id === user.id
          ? {
              ...item,
              name: user.nombre_completo,
              email: user.correo.toLowerCase(),
              role: 'caregiver' as const,
              patientId: undefined,
            }
          : item,
      )
    : [...state.accounts, account];

  const nextRelations =
    relationsToCreate.length > 0
      ? [...state.relations, ...relationsToCreate]
      : state.relations;

  const availablePatientIds = nextRelations
    .filter((relation) => relation.caregiverId === user.id && relation.status === 'approved')
    .map((relation) => relation.patientId);

  update({
    accounts: nextAccounts,
    relations: nextRelations,
    userId: user.id,
    selectedId: availablePatientIds.length === 1 ? availablePatientIds[0] : undefined,
  });
}

export const demo = {
  snapshot: () => state,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  startBackendSession: (user: CurrentUserResponse) => openBackendDemoSession(user),
  user: () => state.accounts.find((a) => a.id === state.userId),
  patients: () => {
    const user = demo.user();
    return state.profiles.filter(
      (p) =>
        p.id === user?.patientId ||
        state.relations.some(
          (r) =>
            r.patientId === p.id &&
            r.caregiverId === user?.id &&
            r.status === 'approved',
        ),
    );
  },
  patient: () =>
    demo
      .patients()
      .find((p) => p.id === (demo.user()?.patientId ?? state.selectedId)),
  permissions: (): Permissions =>
    demo.user()?.role === 'patient'
      ? { alerts: true, read: true, write: true }
      : state.relations.find(
          (r) =>
            r.caregiverId === state.userId &&
            r.patientId === state.selectedId &&
            r.status === 'approved',
        )?.permissions ?? emptyPermissions(),
  registerPatient(name: string, email: string) {
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fail('Completa el nombre y un correo válido.');
    }
    email = email.trim().toLowerCase();
    if (
      state.profiles.some((p) => p.email === email) ||
      state.accounts.some((a) => a.email === email)
    ) {
      fail('Ese correo ya está registrado.');
    }
    const profile: Profile = {
      id: id(),
      name: name.trim(),
      email,
      code: `PAC-${id()}`,
      expires: Date.now() + 86400000,
      activated: false,
    };
    update({ profiles: [...state.profiles, profile] });
    return profile;
  },
  activate(code: string, email: string, password: string) {
    credentials(email, password);
    const p = state.profiles.find(
      (profile) =>
        profile.code === code.trim().toUpperCase() &&
        profile.email === email.trim().toLowerCase(),
    );
    if (!p || p.activated || p.expires <= Date.now()) {
      fail('Invitación inválida, vencida o ya utilizada. Verifica también tu correo.');
    }
    const profile = p!;
    const account: Account = {
      id: id(),
      name: profile.name,
      email: profile.email,
      password,
      role: 'patient',
      patientId: profile.id,
    };
    update({
      accounts: [...state.accounts, account],
      profiles: state.profiles.map((item) =>
        item.id === profile.id ? { ...item, activated: true } : item,
      ),
      userId: account.id,
      selectedId: profile.id,
    });
  },
  registerCaregiver(name: string, email: string, password: string) {
    credentials(email, password);
    if (state.profiles.some((p) => p.email === email.trim().toLowerCase())) {
      fail('Este correo tiene una invitación de paciente. Activa esa cuenta con el código del centro.');
    }
    if (!name.trim()) {
      fail('Ingresa tu nombre.');
    }
    const account: Account = {
      id: id(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: 'caregiver',
    };
    update({ accounts: [...state.accounts, account], userId: account.id, selectedId: undefined });
  },
  login(email: string, password: string) {
    const account = state.accounts.find(
      (a) => a.email === email.trim().toLowerCase() && a.password === password,
    );
    if (!account) {
      fail('Correo o contraseña incorrectos. Activa o crea tu cuenta primero.');
    }
    const loggedAccount = account!;
    update({ userId: loggedAccount.id, selectedId: loggedAccount.patientId });
    const pending = state.invitations.find((i) => i.token === state.pendingToken);
    if (
      pending &&
      state.relations.some(
        (r) =>
          r.patientId === pending.patientId &&
          r.caregiverId === loggedAccount.id &&
          ['pending', 'approved'].includes(r.status),
      )
    ) {
      update({ pendingToken: undefined });
    }
    const patients = demo.patients();
    if (patients.length === 1) {
      update({ selectedId: patients[0].id });
    }
  },
  logout: () => update({ userId: undefined, selectedId: undefined }),
  select(patientId: string) {
    if (!demo.patients().some((p) => p.id === patientId)) {
      fail('No tienes acceso a este paciente.');
    }
    update({ selectedId: patientId });
  },
  invite() {
    const user = demo.user();
    if (user?.role !== 'patient') {
      return fail('Solo el paciente puede invitar.');
    }
    const invitation = {
      token: `CUID-${id()}`,
      patientId: user.patientId!,
      expires: Date.now() + 3600000,
    };
    update({
      invitations: [...state.invitations.filter((i) => i.patientId !== user.patientId), invitation],
    });
    return invitation;
  },
  remember: (token?: string) => update({ pendingToken: token }),
  invitation(token: string) {
    const invitation = state.invitations.find(
      (i) => i.token === token.trim().toUpperCase() && i.expires > Date.now(),
    );
    if (!invitation) {
      return fail('La invitación no existe o venció. Solicita una nueva al paciente.');
    }
    return invitation;
  },
  request(token: string) {
    if (demo.user()?.role !== 'caregiver') {
      fail('Inicia sesión con una cuenta de cuidador.');
    }
    const invitation = demo.invitation(token);
    if (
      state.relations.some(
        (r) =>
          r.patientId === invitation.patientId &&
          r.caregiverId === state.userId &&
          ['pending', 'approved'].includes(r.status),
      )
    ) {
      fail('Ya tienes una solicitud pendiente o un vínculo aprobado.');
    }
    const relation: Relation = {
      id: id(),
      patientId: invitation.patientId,
      caregiverId: state.userId!,
      status: 'pending',
      permissions: emptyPermissions(),
    };
    update({ relations: [...state.relations, relation], pendingToken: undefined });
  },
  decide(
    relationId: string,
    status: Relation['status'],
    permissions = emptyPermissions(),
  ) {
    const relation = state.relations.find((r) => r.id === relationId);
    if (demo.user()?.role !== 'patient' || relation?.patientId !== demo.user()?.patientId) {
      fail('Solo el paciente puede autorizar este vínculo.');
    }
    if (!relation || (status === 'approved' && relation.status !== 'pending')) {
      fail('Esta solicitud ya fue resuelta.');
    }
    update({
      relations: state.relations.map((r) =>
        r.id === relationId
          ? {
              ...r,
              status,
              permissions: status === 'approved' ? { ...permissions } : emptyPermissions(),
            }
          : r,
      ),
    });
  },
  measurements: () =>
    demo.permissions().read
      ? state.measurements.filter((m) => m.patientId === demo.patient()?.id)
      : [],
  save(measurement: Measurement) {
    const patient = demo.patient();
    const user = demo.user();
    if (!patient || !user || !demo.permissions().write) {
      fail('No tienes permiso para registrar mediciones.');
    }
    update({
      measurements: [
        ...state.measurements,
        {
          ...measurement,
          id: id(),
          patientId: patient!.id,
          recordedBy: user!.name,
          recordedById: user!.id,
        },
      ],
    });
  },
};
