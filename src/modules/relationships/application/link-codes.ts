import { consumeLinkCode as apiConsumeLinkCode, type ConsumeLinkCodeResponse } from '../infrastructure/relationships-api';
import { ApiError, normalizeApiError } from '../../../core/infrastructure/http/errors';

/**
 * Vinculación por código:
 *   POST /api/v1/patients/{patientId}/link-codes   (el paciente genera, 5 min, un uso)
 *   POST /api/v1/link-codes/consume               (el cuidador lo usa)
 *
 * - El QR contiene solo el campo `code`.
 * - Antes de enviar se normaliza: sin espacios ni guiones y en mayúsculas
 *   (igual que normalizar_codigo del backend). Si se escanea un enlace con
 *   ?code= o ?token=, se toma ese valor.
 * - Cada error del backend tiene un mensaje claro.
 * - Tras vincular, se guarda una confirmación para mostrarla en la lista.
 */

export const LINK_CODE_LIFETIME_SECONDS = 5 * 60;

export const LINK_TYPE_LABELS = { CAREGIVER: 'cuidador', DOCTOR: 'médico' } as const;

export function normalizeLinkCode(value: string | null | undefined): string {
  let text = (value ?? '').trim();
  const match = text.match(/[?&](?:token|code)=([^&#]+)/i);
  if (match) {
    try {
      text = decodeURIComponent(match[1]);
    } catch {
      text = match[1];
    }
  }
  return text.replace(/[\s-]+/g, '').toUpperCase();
}

/** Segundos que le quedan al código (nunca negativo). */
export function secondsLeft(expiresAt: string, now: number = Date.now()): number {
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now) / 1000));
}

/** 272 → "4:32". */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export type LinkCodeErrorInfo = {
  code: string;
  message: string;
  /** El código ya no sirve: hay que pedir uno nuevo al paciente. */
  needsNewCode: boolean;
};

const MESSAGES: Record<string, Omit<LinkCodeErrorInfo, 'code'>> = {
  INVALID_CODE_FORMAT: { message: 'El código tiene 6 caracteres (letras y números). Revísalo e inténtalo otra vez.', needsNewCode: false },
  CODE_NOT_FOUND: { message: 'El código no es válido. Revísalo e inténtalo otra vez.', needsNewCode: false },
  CODE_EXPIRED: { message: 'El código venció (dura 5 minutos). Pide al paciente que genere uno nuevo.', needsNewCode: true },
  CODE_USED: { message: 'Este código ya fue usado. Cada código sirve una sola vez; pide uno nuevo.', needsNewCode: true },
  CODE_REVOKED: { message: 'El paciente anuló este código al generar otro. Pídele el código nuevo.', needsNewCode: true },
  ROLE_NOT_ALLOWED: { message: 'Este código no corresponde a tu tipo de cuenta (es para cuidador o para médico).', needsNewCode: false },
  DOCTOR_NOT_VERIFIED: { message: 'Podrás vincular pacientes cuando tu registro profesional esté verificado.', needsNewCode: false },
  ALREADY_LINKED: { message: 'Ya estás vinculado con este paciente. Lo encontrarás en tu lista.', needsNewCode: false },
  SELF_LINK: { message: 'No puedes usar tu propio código. Debe usarlo otra persona.', needsNewCode: false },
  TOO_MANY_ATTEMPTS: { message: 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.', needsNewCode: false },
};

export function describeLinkCodeError(error: unknown): LinkCodeErrorInfo {
  const apiError = normalizeApiError(error);
  const known = MESSAGES[apiError.code];
  if (known) return { code: apiError.code, ...known };
  if (apiError.status === 429) return { code: 'TOO_MANY_ATTEMPTS', ...MESSAGES.TOO_MANY_ATTEMPTS };
  if (apiError.status === 401) {
    return { code: apiError.code, message: 'Tu sesión expiró. Vuelve a iniciar sesión.', needsNewCode: false };
  }
  return {
    code: apiError.code,
    message: apiError.status ? apiError.message : 'No se pudo vincular. Verifica tu conexión e inténtalo nuevamente.',
    needsNewCode: false,
  };
}

let lastConfirmation: ConsumeLinkCodeResponse | null = null;

/** Confirmación del último vínculo creado (se entrega una sola vez). */
export function takeLinkConfirmation(): ConsumeLinkCodeResponse | null {
  const value = lastConfirmation;
  lastConfirmation = null;
  return value;
}

/** Misma firma que infrastructure/relationships-api.ts: normaliza, consume y traduce errores. */
export async function consumeLinkCode(code: string): Promise<ConsumeLinkCodeResponse> {
  const normalized = normalizeLinkCode(code);
  if (!normalized) {
    throw new ApiError({ code: 'INVALID_CODE_FORMAT', message: 'Escribe o escanea el código del paciente.' });
  }
  try {
    const result = await apiConsumeLinkCode(normalized);
    lastConfirmation = result;
    return result;
  } catch (error) {
    const info = describeLinkCodeError(error);
    const status = normalizeApiError(error).status;
    throw new ApiError({ code: info.code, status, message: info.message });
  }
}
