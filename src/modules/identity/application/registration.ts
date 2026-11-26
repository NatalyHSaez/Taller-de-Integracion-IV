import type { RegisterRequest } from '../../../core/infrastructure/http/dto';
import { normalizeApiError } from '../../../core/infrastructure/http/errors';

export type RegistrationForm = {
  fullName: string;
  email: string;
  password: string;
  confirmation: string;
  role: 'PATIENT' | 'CAREGIVER';
  birthDate: string;
  privacyAccepted: boolean;
};

/** Fecha civil local: no convertir a UTC, para evitar cambiar el día. */
export function parseBirthDate(value: string, today = new Date()): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error('Ingresa tu fecha de nacimiento como DD/MM/AAAA.');
  const [, dd, mm, yyyy] = match;
  const day = Number(dd), month = Number(mm), year = Number(yyyy);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (year < 1 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('La fecha de nacimiento no es válida.');
  }
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date > end) throw new Error('La fecha de nacimiento no puede ser futura.');
  return `${yyyy}-${mm}-${dd}`;
}

export function buildRegistrationRequest(form: RegistrationForm): RegisterRequest {
  const fullName = form.fullName.trim();
  const email = form.email.trim().toLowerCase();
  if (fullName.length < 3 || fullName.length > 200) throw new Error('El nombre debe tener entre 3 y 200 caracteres.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ingresa un correo electrónico válido.');
  if (form.password.length < 8 || form.password.length > 128) throw new Error('La contraseña debe tener entre 8 y 128 caracteres.');
  if (form.password !== form.confirmation) throw new Error('Las contraseñas no coinciden.');
  if (!form.privacyAccepted) throw new Error('Debes aceptar la Política de Privacidad para crear tu cuenta.');
  const base = { fullName, email, password: form.password };
  return form.role === 'PATIENT'
    ? { ...base, role: 'PATIENT', birthDate: parseBirthDate(form.birthDate) }
    : { ...base, role: 'CAREGIVER' };
}

export function registrationErrorMessage(cause: unknown): string {
  const error = normalizeApiError(cause);
  if (error.code === 'REQUEST_TIMEOUT' || error.code === 'NETWORK_ERROR') {
    return 'No pudimos confirmar si la cuenta se creó. Revisa tu conexión e intenta iniciar sesión antes de volver a registrarte.';
  }
  if (error.status === 422) {
    return 'Revisa el nombre, correo, contraseña y fecha de nacimiento. El servidor no pudo validar los datos.';
  }
  if (error.status !== undefined && error.status >= 500) {
    return 'El servidor no pudo confirmar el registro. Intenta iniciar sesión o vuelve a intentarlo más tarde.';
  }
  return error.message;
}
