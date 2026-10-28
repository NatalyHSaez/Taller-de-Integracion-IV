import type { CurrentUserResponse, UserRole } from "../types/api";
import type { Measurement } from "../types/measurement";
import {
  MOCK_ACCOUNTS,
  MOCK_CAREGIVER_RELATIONSHIPS,
  MOCK_PATIENTS,
  MOCK_READINGS,
} from "./mocks/api-data";
import { readingsToMeasurements } from "./mocks/measurement-mapper";

export type Permissions = {
  alerts: boolean;
  read: boolean;
  write: boolean;
};

export type Account = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "patient" | "caregiver";
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

export type Invitation = {
  token: string;
  patientId: string;
  expires: number;
};

export type Relation = {
  id: string;
  patientId: string;
  caregiverId: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  permissions: Permissions;
};

export type NotificationPrefs = {
  mediciones: boolean;
  vinculos: boolean;
};

type State = {
  accounts: Account[];
  profiles: Profile[];
  invitations: Invitation[];
  relations: Relation[];
  measurements: Measurement[];
  notificationPrefs: NotificationPrefs;
  vozActiva: boolean;
  vozVolumen: number;
  userId?: string;
  selectedId?: string;
  pendingToken?: string;
};

type BackendUserLike = {
  id?: string;
  nombre_completo?: string;
  correo?: string;
  roles?: string[];
  rol?: string;
};

const emptyPermissions = (): Permissions => ({
  alerts: false,
  read: false,
  write: false,
});

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }

  return value;
}

const structuredAccounts: Account[] = MOCK_ACCOUNTS.filter(
  (account) => account.role === "PATIENT" || account.role === "CAREGIVER",
).map((account) => ({
  id: account.userId,
  name: `${account.firstName} ${account.lastName}`,
  email: account.email.toLowerCase(),
  password: account.password,
  role: account.role === "PATIENT" ? "patient" : "caregiver",
  patientId: account.patientId,
}));

const extraAccounts: Account[] = [
  {
    id: "demo-patient-gmail-user",
    name: "Paciente Demo",
    email: "demopaciente@gmail.com",
    password: "123456",
    role: "patient",
    patientId: "demo-patient-gmail",
  },
];

const initialAccounts: Account[] = [
  ...structuredAccounts,
  ...extraAccounts.filter(
    (extra) =>
      !structuredAccounts.some((account) => account.email === extra.email),
  ),
];

const structuredProfiles: Profile[] = MOCK_PATIENTS.map((patient) => {
  const account = MOCK_ACCOUNTS.find(
    (item) => item.patientId === patient.patientId,
  );

  return {
    id: patient.patientId,
    name: `${patient.firstName} ${patient.lastName}`,
    email: account?.email.toLowerCase() ?? `${patient.patientId}@mock.local`,
    code: "DEMO-ACTIVATED",
    expires: 0,
    activated: true,
  };
});

const extraProfiles: Profile[] = [
  {
    id: "demo-patient-gmail",
    name: "Paciente Demo",
    email: "demopaciente@gmail.com",
    code: "DEMO-GMAIL-ACTIVATED",
    expires: 0,
    activated: true,
  },
];

const initialProfiles: Profile[] = [
  ...structuredProfiles,
  ...extraProfiles.filter(
    (extra) => !structuredProfiles.some((profile) => profile.id === extra.id),
  ),
];

const initialRelations: Relation[] = MOCK_CAREGIVER_RELATIONSHIPS.map(
  (relationship) => ({
    id: relationship.relationshipId,
    patientId: relationship.patientId,
    caregiverId: relationship.caregiverUserId,
    status: relationship.status === "ACTIVE" ? "approved" : "revoked",
    permissions: {
      alerts: relationship.permissions.includes("ALERT_VIEW"),
      read: relationship.permissions.includes("MEASUREMENT_VIEW"),
      write: relationship.permissions.includes("MEASUREMENT_CREATE"),
    },
  }),
);

let state: State = {
  accounts: initialAccounts,
  profiles: initialProfiles,
  invitations: [],
  relations: initialRelations,
  measurements: readingsToMeasurements(MOCK_READINGS),
  notificationPrefs: {
    mediciones: true,
    vinculos: true,
  },
  vozActiva: true,
  vozVolumen: 0.6,
};

const listeners = new Set<() => void>();

const id = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const update = (patch: Partial<State>) => {
  state = {
    ...state,
    ...patch,
  };

  listeners.forEach((fn) => fn());
};

const fail = (message: string): never => {
  throw new Error(message);
};

function credentials(email: string, password: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    fail("Ingresa un correo válido.");
  }

  if (password.length < 8) {
    fail("La contraseña debe tener al menos 8 caracteres.");
  }

  if (
    state.accounts.some(
      (account) => account.email === email.trim().toLowerCase(),
    )
  ) {
    fail("Ya existe una cuenta con ese correo.");
  }
}

function backendRole(user: CurrentUserResponse): Account["role"] | null {
  if (user.roles.includes("paciente")) {
    return "patient";
  }

  if (user.roles.includes("cuidador")) {
    return "caregiver";
  }

  return null;
}

function normalizeBackendUser(user: BackendUserLike): CurrentUserResponse {
  const userId = requireValue(
    user.id ?? user.correo,
    "El usuario del backend no contiene un identificador válido.",
  );

  const rawRoles = user.roles ?? (user.rol ? [user.rol] : []);

  const roles = rawRoles
    .map((role) => role.toLowerCase())
    .map((role): UserRole | null => {
      if (role === "paciente" || role === "patient") {
        return "paciente";
      }

      if (role === "cuidador" || role === "caregiver") {
        return "cuidador";
      }

      if (role === "medico" || role === "doctor") {
        return "medico";
      }

      if (role === "administrador" || role === "admin") {
        return "administrador";
      }

      return null;
    })
    .filter((role): role is UserRole => role !== null);

  return {
    id: userId,
    nombre_completo: user.nombre_completo ?? "Usuario",
    correo: (user.correo ?? "").toLowerCase(),
    roles,
  };
}

function openBackendDemoSession(user: CurrentUserResponse) {
  const role = requireValue(
    backendRole(user),
    "La aplicación móvil actual solo admite pacientes y cuidadores.",
  );

  const existingAccount = state.accounts.find(
    (account) => account.id === user.id,
  );

  if (role === "patient") {
    const patientId = `backend-patient-${user.id}`;

    const templatePatientId = initialProfiles[0]?.id;

    const account: Account = existingAccount ?? {
      id: user.id,
      name: user.nombre_completo,
      email: user.correo.toLowerCase(),
      password: "",
      role: "patient",
      patientId,
    };

    const profileExists = state.profiles.some(
      (profile) => profile.id === patientId,
    );

    const profile: Profile = {
      id: patientId,
      name: user.nombre_completo,
      email: user.correo.toLowerCase(),
      code: "BACKEND-SESSION",
      expires: 0,
      activated: true,
    };

    const hasMeasurements = state.measurements.some(
      (measurement) => measurement.patientId === patientId,
    );

    const clonedMeasurements =
      !hasMeasurements && templatePatientId
        ? state.measurements
            .filter(
              (measurement) => measurement.patientId === templatePatientId,
            )
            .map((measurement) => ({
              ...measurement,

              id: `backend-${user.id}-${measurement.id}`,

              readingId: measurement.readingId
                ? `backend-${user.id}-${measurement.readingId}`
                : undefined,

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

                  password: "",

                  role: "patient",

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

  const account: Account = existingAccount ?? {
    id: user.id,
    name: user.nombre_completo,
    email: user.correo.toLowerCase(),
    password: "",
    role: "caregiver",
  };

  const templateRelations = initialRelations.filter(
    (relation) => relation.status === "approved",
  );

  const relationsToCreate: Relation[] = templateRelations
    .filter(
      (template) =>
        !state.relations.some(
          (relation) =>
            relation.caregiverId === user.id &&
            relation.patientId === template.patientId,
        ),
    )
    .map((template) => ({
      ...template,

      id: `backend-${user.id}-${template.id}`,

      caregiverId: user.id,

      permissions: {
        ...template.permissions,
      },
    }));

  const nextAccounts: Account[] = existingAccount
    ? state.accounts.map((item) =>
        item.id === user.id
          ? {
              ...item,

              name: user.nombre_completo,

              email: user.correo.toLowerCase(),

              password: "",

              role: "caregiver",

              patientId: undefined,
            }
          : item,
      )
    : [...state.accounts, account];

  const nextRelations: Relation[] =
    relationsToCreate.length > 0
      ? [...state.relations, ...relationsToCreate]
      : state.relations;

  const availablePatientIds = nextRelations
    .filter(
      (relation) =>
        relation.caregiverId === user.id && relation.status === "approved",
    )
    .map((relation) => relation.patientId);

  update({
    accounts: nextAccounts,

    relations: nextRelations,

    userId: user.id,

    selectedId:
      availablePatientIds.length === 1 ? availablePatientIds[0] : undefined,
  });
}

function getCurrentUser(): Account | undefined {
  return state.accounts.find((account) => account.id === state.userId);
}

function getPatients(): Profile[] {
  const user = getCurrentUser();

  return state.profiles.filter(
    (profile) =>
      profile.id === user?.patientId ||
      state.relations.some(
        (relation) =>
          relation.patientId === profile.id &&
          relation.caregiverId === user?.id &&
          relation.status === "approved",
      ),
  );
}

function getPatient(): Profile | undefined {
  const user = getCurrentUser();

  const patientId = user?.patientId ?? state.selectedId;

  if (!patientId) {
    return undefined;
  }

  return getPatients().find((profile) => profile.id === patientId);
}

function getPermissions(): Permissions {
  const user = getCurrentUser();

  if (user?.role === "patient") {
    return {
      alerts: true,
      read: true,
      write: true,
    };
  }

  return (
    state.relations.find(
      (relation) =>
        relation.caregiverId === state.userId &&
        relation.patientId === state.selectedId &&
        relation.status === "approved",
    )?.permissions ?? emptyPermissions()
  );
}

export const demo = {
  snapshot: () => state,

  subscribe: (fn: () => void) => {
    listeners.add(fn);

    return () => {
      listeners.delete(fn);
    };
  },

  startBackendSession: (user: CurrentUserResponse) => {
    openBackendDemoSession(user);
  },

  syncRealSession: (user: BackendUserLike) => {
    openBackendDemoSession(normalizeBackendUser(user));
  },

  user: getCurrentUser,

  patients: getPatients,

  patient: getPatient,

  permissions: getPermissions,

  registerPatient(name: string, email: string) {
    const cleanName = name.trim();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      fail("Completa el nombre y un correo válido.");
    }

    if (
      state.profiles.some((profile) => profile.email === cleanEmail) ||
      state.accounts.some((account) => account.email === cleanEmail)
    ) {
      fail("Ese correo ya está registrado.");
    }

    const profile: Profile = {
      id: id(),

      name: cleanName,

      email: cleanEmail,

      code: `PAC-${id()}`,

      expires: Date.now() + 86400000,

      activated: false,
    };

    update({
      profiles: [...state.profiles, profile],
    });

    return profile;
  },

  activate(code: string, email: string, password: string) {
    credentials(email, password);

    const profile = requireValue(
      state.profiles.find(
        (item) =>
          item.code === code.trim().toUpperCase() &&
          item.email === email.trim().toLowerCase(),
      ),
      "Invitación inválida, vencida o ya utilizada. Verifica también tu correo.",
    );

    if (profile.activated || profile.expires <= Date.now()) {
      fail(
        "Invitación inválida, vencida o ya utilizada. Verifica también tu correo.",
      );
    }

    const account: Account = {
      id: id(),

      name: profile.name,

      email: profile.email,

      password,

      role: "patient",

      patientId: profile.id,
    };

    update({
      accounts: [...state.accounts, account],

      profiles: state.profiles.map((item) =>
        item.id === profile.id
          ? {
              ...item,
              activated: true,
            }
          : item,
      ),

      userId: account.id,

      selectedId: profile.id,
    });
  },

  registerCaregiver(name: string, email: string, password: string) {
    credentials(email, password);

    const cleanName = name.trim();

    const cleanEmail = email.trim().toLowerCase();

    if (state.profiles.some((profile) => profile.email === cleanEmail)) {
      fail(
        "Este correo tiene una invitación de paciente. Activa esa cuenta con el código del centro.",
      );
    }

    if (!cleanName) {
      fail("Ingresa tu nombre.");
    }

    const account: Account = {
      id: id(),

      name: cleanName,

      email: cleanEmail,

      password,

      role: "caregiver",
    };

    update({
      accounts: [...state.accounts, account],

      userId: account.id,

      selectedId: undefined,
    });
  },

  login(email: string, password: string) {
    const loggedAccount = requireValue(
      state.accounts.find(
        (account) =>
          account.email === email.trim().toLowerCase() &&
          account.password === password,
      ),
      "Correo o contraseña incorrectos. Activa o crea tu cuenta primero.",
    );

    update({
      userId: loggedAccount.id,

      selectedId: loggedAccount.patientId,
    });

    const pending = state.invitations.find(
      (invitation) => invitation.token === state.pendingToken,
    );

    if (
      pending &&
      state.relations.some(
        (relation) =>
          relation.patientId === pending.patientId &&
          relation.caregiverId === loggedAccount.id &&
          ["pending", "approved"].includes(relation.status),
      )
    ) {
      update({
        pendingToken: undefined,
      });
    }

    const patients = getPatients();

    if (patients.length === 1) {
      update({
        selectedId: patients[0].id,
      });
    }
  },

  
  logout() {
    update({
      userId: undefined,
      selectedId: undefined,
      pendingToken: undefined,
    });
  },

  clearSessionData() {
    update({
      accounts: initialAccounts,
      profiles: initialProfiles,
      invitations: [],
      relations: initialRelations,
      measurements: readingsToMeasurements(MOCK_READINGS),
      userId: undefined,
      selectedId: undefined,
      pendingToken: undefined,
    });
  },

  select(patientId: string) {
    if (!getPatients().some((profile) => profile.id === patientId)) {
      fail("No tienes acceso a este paciente.");
    }

    update({
      selectedId: patientId,
    });
  },

  invite() {
    const user = requireValue(getCurrentUser(), "Debes iniciar sesión.");

    if (user.role !== "patient") {
      fail("Solo el paciente puede invitar.");
    }

    const patientId = requireValue(
      user.patientId,
      "El paciente autenticado no tiene un perfil asociado.",
    );

    const invitation: Invitation = {
      token: `CUID-${id()}`,

      patientId,

      expires: Date.now() + 3600000,
    };

    update({
      invitations: [
        ...state.invitations.filter((item) => item.patientId !== patientId),

        invitation,
      ],
    });

    return invitation;
  },

  remember(token?: string) {
    update({
      pendingToken: token,
    });
  },

  invitation(token: string) {
    return requireValue(
      state.invitations.find(
        (invitation) =>
          invitation.token === token.trim().toUpperCase() &&
          invitation.expires > Date.now(),
      ),
      "La invitación no existe o venció. Solicita una nueva al paciente.",
    );
  },

  request(token: string) {
    const user = requireValue(getCurrentUser(), "Debes iniciar sesión.");

    if (user.role !== "caregiver") {
      fail("Inicia sesión con una cuenta de cuidador.");
    }

    const invitation = requireValue(
      state.invitations.find(
        (item) =>
          item.token === token.trim().toUpperCase() &&
          item.expires > Date.now(),
      ),
      "La invitación no existe o venció. Solicita una nueva al paciente.",
    );

    if (
      state.relations.some(
        (relation) =>
          relation.patientId === invitation.patientId &&
          relation.caregiverId === user.id &&
          ["pending", "approved"].includes(relation.status),
      )
    ) {
      fail("Ya tienes una solicitud pendiente o un vínculo aprobado.");
    }

    const relation: Relation = {
      id: id(),

      patientId: invitation.patientId,

      caregiverId: user.id,

      status: "pending",

      permissions: emptyPermissions(),
    };

    update({
      relations: [...state.relations, relation],

      pendingToken: undefined,
    });
  },

  decide(
    relationId: string,
    status: Relation["status"],
    permissions = emptyPermissions(),
  ) {
    const user = requireValue(getCurrentUser(), "Debes iniciar sesión.");

    const relation = requireValue(
      state.relations.find((item) => item.id === relationId),
      "Esta solicitud ya no existe.",
    );

    if (user.role !== "patient" || relation.patientId !== user.patientId) {
      fail("Solo el paciente puede autorizar este vínculo.");
    }

    if (status === "approved" && relation.status !== "pending") {
      fail("Esta solicitud ya fue resuelta.");
    }

    update({
      relations: state.relations.map((item) =>
        item.id === relationId
          ? {
              ...item,

              status,

              permissions:
                status === "approved"
                  ? {
                      ...permissions,
                    }
                  : emptyPermissions(),
            }
          : item,
      ),
    });
  },

  measurements() {
    const patient = getPatient();

    if (!patient || !getPermissions().read) {
      return [];
    }

    return state.measurements.filter(
      (measurement) => measurement.patientId === patient.id,
    );
  },

  save(measurement: Measurement) {
    const patient = requireValue(
      getPatient(),
      "No existe un paciente seleccionado.",
    );

    const user = requireValue(getCurrentUser(), "Debes iniciar sesión.");

    if (!getPermissions().write) {
      fail("No tienes permiso para registrar mediciones.");
    }

    const readingId = measurement.readingId ?? id();

    update({
      measurements: [
        ...state.measurements,

        {
          ...measurement,

          id: id(),

          readingId,

          patientId: patient.id,

          recordedBy: user.name,

          recordedById: user.id,
        },
      ],
    });
  },

  setNotificationPrefs(prefs: Partial<NotificationPrefs>) {
    update({
      notificationPrefs: {
        ...state.notificationPrefs,
        ...prefs,
      },
    });
  },

  setVozActiva(value: boolean) {
    update({
      vozActiva: value,
    });
  },

  setVozVolumen(value: number) {
    update({
      vozVolumen: value,
    });
  },

  updateProfile(name: string, email: string) {
    const user = requireValue(getCurrentUser(), "Debes iniciar sesión.");

    const cleanName = name.trim();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      fail("Ingresa tu nombre.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      fail("Ingresa un correo válido.");
    }

    if (
      state.accounts.some(
        (account) => account.id !== user.id && account.email === cleanEmail,
      )
    ) {
      fail("Ese correo ya está en uso.");
    }

    update({
      accounts: state.accounts.map((account) =>
        account.id === user.id
          ? {
              ...account,

              name: cleanName,

              email: cleanEmail,
            }
          : account,
      ),

      profiles: user.patientId
        ? state.profiles.map((profile) =>
            profile.id === user.patientId
              ? {
                  ...profile,

                  name: cleanName,

                  email: cleanEmail,
                }
              : profile,
          )
        : state.profiles,
    });
  },

  updateEmail(email: string) {
    const user = requireValue(getCurrentUser(), "Debes iniciar sesión.");

    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      fail("Ingresa un correo válido.");
    }

    if (
      state.accounts.some(
        (account) => account.id !== user.id && account.email === cleanEmail,
      )
    ) {
      fail("Ese correo ya está en uso.");
    }

    update({
      accounts: state.accounts.map((account) =>
        account.id === user.id
          ? {
              ...account,
              email: cleanEmail,
            }
          : account,
      ),

      profiles: user.patientId
        ? state.profiles.map((profile) =>
            profile.id === user.patientId
              ? {
                  ...profile,
                  email: cleanEmail,
                }
              : profile,
          )
        : state.profiles,
    });
  },

  updatePassword(currentPassword: string, newPassword: string) {
    const user = requireValue(getCurrentUser(), "Debes iniciar sesión.");

    if (user.password !== currentPassword) {
      fail("La contraseña actual no coincide.");
    }

    if (newPassword.length < 8) {
      fail("La nueva contraseña debe tener al menos 8 caracteres.");
    }

    update({
      accounts: state.accounts.map((account) =>
        account.id === user.id
          ? {
              ...account,

              password: newPassword,
            }
          : account,
      ),
    });
  },
};
