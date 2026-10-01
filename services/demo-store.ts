import type { Measurement } from '../types/measurement';

export type Permissions = { alerts: boolean; read: boolean; write: boolean };
export type Account = { id: string; name: string; email: string; password: string; role: 'patient' | 'caregiver'; patientId?: string };
export type Profile = { id: string; name: string; email: string; code: string; expires: number; activated: boolean };
export type Invitation = { token: string; patientId: string; expires: number };
export type Relation = { id: string; patientId: string; caregiverId: string; status: 'pending' | 'approved' | 'rejected' | 'revoked'; permissions: Permissions };
type State = { accounts: Account[]; profiles: Profile[]; invitations: Invitation[]; relations: Relation[]; measurements: Measurement[]; userId?: string; selectedId?: string; pendingToken?: string };
const emptyPermissions = (): Permissions => ({ alerts: false, read: false, write: false });
// Cuenta ficticia del almacén demo: disponible nuevamente después de cada recarga.
let state: State = {
  accounts: [{ id: 'demo-patient-user', name: 'Juan Pérez', email: 'paciente@ejemplo.com', password: 'Paciente123', role: 'patient', patientId: 'demo-patient', },
    { id: 'demo-caregiver-user', name: 'Ana Martínez', email: 'cuidador@ejemplo.com', password: 'Cuidador123', role: 'caregiver', },],
  profiles: [{ id: 'demo-patient', name: 'Juan Pérez', email: 'paciente@ejemplo.com', code: 'DEMO-ACTIVATED', expires: 0, activated: true, },],
  invitations: [],
  relations: [{ id: 'demo-relation', patientId: 'demo-patient', caregiverId: 'demo-caregiver-user', status: 'approved', permissions: { alerts: true, read: true, write: true, },},],
  measurements: [],
};
const listeners = new Set<() => void>();
const id = () => Math.random().toString(36).slice(2, 10).toUpperCase();
const update = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); };
const fail = (message: string): never => { throw new Error(message); };
function credentials(email: string, password: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fail('Ingresa un correo válido.');
  if (password.length < 8) fail('La contraseña debe tener al menos 8 caracteres.');
  if (state.accounts.some((a) => a.email === email.trim().toLowerCase())) fail('Ya existe una cuenta con ese correo.');
}
export const demo = {
  snapshot: () => state,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  user: () => state.accounts.find((a) => a.id === state.userId),
  patients: () => {
    const user = demo.user();
    return state.profiles.filter((p) => p.id === user?.patientId || state.relations.some((r) => r.patientId === p.id && r.caregiverId === user?.id && r.status === 'approved'));
  },
  patient: () => demo.patients().find((p) => p.id === (demo.user()?.patientId ?? state.selectedId)),
  permissions: (): Permissions => demo.user()?.role === 'patient' ? { alerts: true, read: true, write: true } : state.relations.find((r) => r.caregiverId === state.userId && r.patientId === state.selectedId && r.status === 'approved')?.permissions ?? emptyPermissions(),
  registerPatient(name: string, email: string) {
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fail('Completa el nombre y un correo válido.');
    email = email.trim().toLowerCase();
    if (state.profiles.some((p) => p.email === email) || state.accounts.some((a) => a.email === email)) fail('Ese correo ya está registrado.');
    const profile: Profile = { id: id(), name: name.trim(), email, code: `PAC-${id()}`, expires: Date.now() + 86400000, activated: false };
    update({ profiles: [...state.profiles, profile] });
    return profile;
  },
  activate(code: string, email: string, password: string) {
    credentials(email, password);
    const p = state.profiles.find((p) => p.code === code.trim().toUpperCase() && p.email === email.trim().toLowerCase());
    if (!p || p.activated || p.expires <= Date.now()) fail('Invitación inválida, vencida o ya utilizada. Verifica también tu correo.');
    const profile = p!;
    const account: Account = { id: id(), name: profile.name, email: profile.email, password, role: 'patient', patientId: profile.id };
    update({ accounts: [...state.accounts, account], profiles: state.profiles.map((p) => p.id === profile.id ? { ...p, activated: true } : p), userId: account.id, selectedId: profile.id });
  },
  registerCaregiver(name: string, email: string, password: string) {
    credentials(email, password);
    if (state.profiles.some((p) => p.email === email.trim().toLowerCase())) fail('Este correo tiene una invitación de paciente. Activa esa cuenta con el código del centro.');
    if (!name.trim()) fail('Ingresa tu nombre.');
    const account: Account = { id: id(), name: name.trim(), email: email.trim().toLowerCase(), password, role: 'caregiver' };
    update({ accounts: [...state.accounts, account], userId: account.id, selectedId: undefined });
  },
  login(email: string, password: string) {
    const account = state.accounts.find((a) => a.email === email.trim().toLowerCase() && a.password === password);
    if (!account) fail('Correo o contraseña incorrectos. Activa o crea tu cuenta primero.');
    update({ userId: account!.id, selectedId: account!.patientId });
    const pending = state.invitations.find((i) => i.token === state.pendingToken);
    if (pending && state.relations.some((r) => r.patientId === pending.patientId && r.caregiverId === account!.id && ['pending', 'approved'].includes(r.status))) update({ pendingToken: undefined });
    const patients = demo.patients();
    if (patients.length === 1) update({ selectedId: patients[0].id });
  },
  logout: () => update({ userId: undefined, selectedId: undefined }),
  updateProfile(name: string, email: string) {
  const user = demo.user();

  if (!user) fail('No hay un usuario autenticado.');

  name = name.trim();
  email = email.trim().toLowerCase();

  if (!name) fail('Ingresa tu nombre.');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('Ingresa un correo electrónico válido.');
  }

  if (
    state.accounts.some(
      (a) => a.id !== user!.id && a.email === email
    )
  ) {
    fail('Ya existe una cuenta con ese correo.');
  }

  const patientId = user!.patientId;

  if (
    state.profiles.some(
      (p) => p.id !== patientId && p.email === email
    )
  ) {
    fail('Ese correo ya está registrado.');
  }

  update({
    accounts: state.accounts.map((a) =>
      a.id === user!.id ? { ...a, name, email } : a
    ),

    profiles: patientId
      ? state.profiles.map((p) =>
          p.id === patientId ? { ...p, name, email } : p
        )
      : state.profiles,
  });
},
  select(patientId: string) {
    if (!demo.patients().some((p) => p.id === patientId)) fail('No tienes acceso a este paciente.');
    update({ selectedId: patientId });
  },
  invite() {
    const user = demo.user();
    if (user?.role !== 'patient') return fail('Solo el paciente puede invitar.');
    const invitation = { token: `CUID-${id()}`, patientId: user.patientId!, expires: Date.now() + 3600000 };
    update({ invitations: [...state.invitations.filter((i) => i.patientId !== user.patientId), invitation] });
    return invitation;
  },
  remember: (token?: string) => update({ pendingToken: token }),
  invitation(token: string) {
    const invitation = state.invitations.find((i) => i.token === token.trim().toUpperCase() && i.expires > Date.now());
    if (!invitation) return fail('La invitación no existe o venció. Solicita una nueva al paciente.');
    return invitation;
  },
  request(token: string) {
    if (demo.user()?.role !== 'caregiver') fail('Inicia sesión con una cuenta de cuidador.');
    const invitation = demo.invitation(token);
    if (state.relations.some((r) => r.patientId === invitation.patientId && r.caregiverId === state.userId && ['pending', 'approved'].includes(r.status))) fail('Ya tienes una solicitud pendiente o un vínculo aprobado.');
    const relation: Relation = { id: id(), patientId: invitation.patientId, caregiverId: state.userId!, status: 'pending', permissions: emptyPermissions() };
    update({ relations: [...state.relations, relation], pendingToken: undefined });
  },
  decide(relationId: string, status: Relation['status'], permissions = emptyPermissions()) {
    const relation = state.relations.find((r) => r.id === relationId);
    if (demo.user()?.role !== 'patient' || relation?.patientId !== demo.user()?.patientId) fail('Solo el paciente puede autorizar este vínculo.');
    if (!relation || (status === 'approved' && relation.status !== 'pending')) fail('Esta solicitud ya fue resuelta.');
    update({ relations: state.relations.map((r) => r.id === relationId ? { ...r, status, permissions: status === 'approved' ? { ...permissions } : emptyPermissions() } : r) });
  },
  measurements: () => demo.permissions().read ? state.measurements.filter((m) => m.patientId === demo.patient()?.id) : [],
  save(measurement: Measurement) {
    const patient = demo.patient(); const user = demo.user();
    if (!patient || !user || !demo.permissions().write) fail('No tienes permiso para registrar mediciones.');
    update({ measurements: [...state.measurements, { ...measurement, id: id(), patientId: patient!.id, recordedBy: user!.name, recordedById: user!.id }] });
  },
};
