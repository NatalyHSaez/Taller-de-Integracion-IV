import type { CreateReadingRequest, CreateReadingResponse } from '@/types/api';

import { readingErrorsFromApi, type ReadingFormErrors } from './reading-errors';
import { type ConfirmReadingError, confirmReadingErrorFrom } from './readings';

/** Lectura ya creada en el servicio. */
export type SubmittedReading = {
  patientId: string;
  readingId: string;
  status: string;
  /** Motivos tal como los entrega el backend; no se reinterpretan. */
  reasons: string[];
};

/**
 * Pasos del flujo de registro:
 * form → submitting → (confirming ↔ unconfirmed) → result
 */
export type ReadingFlowState =
  | { step: 'form'; errors: ReadingFormErrors | null }
  | { step: 'submitting' }
  | { step: 'confirming'; reading: SubmittedReading; busy: boolean; error: ConfirmReadingError | null }
  | { step: 'unconfirmed'; reading: SubmittedReading }
  | { step: 'result'; reading: SubmittedReading; refreshing: boolean; refreshError: string | null };

/** Operaciones del servicio que usa el flujo (inyectables para pruebas). */
export type ReadingFlowService = {
  create(patientId: string, request: CreateReadingRequest): Promise<CreateReadingResponse>;
  confirm(patientId: string, readingId: string): Promise<CreateReadingResponse>;
  status(patientId: string, readingId: string): Promise<CreateReadingResponse>;
};

function toReading(patientId: string, response: CreateReadingResponse): SubmittedReading {
  return {
    patientId,
    readingId: response.readingId,
    status: response.status ?? 'PENDING',
    reasons: response.confirmationReasons ?? [],
  };
}

/** Si la lectura requiere confirmación, se abre el modal; si no, el resultado. */
function afterServerResponse(reading: SubmittedReading): ReadingFlowState {
  return reading.status === 'REQUIRES_CONFIRMATION'
    ? { step: 'confirming', reading, busy: false, error: null }
    : { step: 'result', reading, refreshing: false, refreshError: null };
}

/**
 * Controlador del flujo de registro. No depende de React: la pantalla se
 * suscribe con useSyncExternalStore y las pruebas lo usan directamente.
 */
export function createReadingFlow(service: ReadingFlowService) {
  let state: ReadingFlowState = { step: 'form', errors: null };
  const listeners = new Set<() => void>();

  const set = (next: ReadingFlowState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  const readingOf = () =>
    state.step === 'confirming' || state.step === 'unconfirmed' || state.step === 'result'
      ? state.reading
      : null;

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Envía la lectura. Ignora toques mientras ya hay un envío en curso. */
    async submit(patientId: string, request: CreateReadingRequest): Promise<void> {
      if (state.step !== 'form') return;
      set({ step: 'submitting' });
      try {
        const response = await service.create(patientId, request);
        set(afterServerResponse(toReading(patientId, response)));
      } catch (cause) {
        set({ step: 'form', errors: readingErrorsFromApi(cause, request) });
      }
    },

    /** Confirmación consciente: solo se llama al endpoint desde aquí. */
    async confirm(): Promise<void> {
      if (state.step !== 'confirming' || state.busy) return;
      const { reading } = state;
      set({ step: 'confirming', reading, busy: true, error: null });
      try {
        const response = await service.confirm(reading.patientId, reading.readingId);
        set({
          step: 'result',
          reading: { ...reading, status: response.status ?? 'PENDING', reasons: reading.reasons },
          refreshing: false,
          refreshError: null,
        });
      } catch (cause) {
        set({ step: 'confirming', reading, busy: false, error: confirmReadingErrorFrom(cause) });
      }
    },

    /** Cancelar cierra el modal sin llamar al endpoint de confirmación. */
    cancel(): void {
      if (state.step !== 'confirming' || state.busy) return;
      set({ step: 'unconfirmed', reading: state.reading });
    },

    /** Vuelve a abrir la confirmación de una lectura cancelada. */
    reopen(): void {
      if (state.step !== 'unconfirmed') return;
      set({ step: 'confirming', reading: state.reading, busy: false, error: null });
    },

    /** Consulta el estado actual en el servicio. */
    async refresh(): Promise<void> {
      const reading = readingOf();
      if (!reading) return;
      if (state.step === 'result' && state.refreshing) return;
      set({ step: 'result', reading, refreshing: true, refreshError: null });
      try {
        const response = await service.status(reading.patientId, reading.readingId);
        set(
          afterServerResponse({
            ...reading,
            status: response.status ?? reading.status,
            reasons: response.confirmationReasons ?? reading.reasons,
          }),
        );
      } catch (cause) {
        const { message } = confirmReadingErrorFrom(cause);
        set({ step: 'result', reading, refreshing: false, refreshError: message });
      }
    },

    /** Nuevo registro desde cero. */
    reset(): void {
      set({ step: 'form', errors: null });
    },

    /** Limpia los errores mostrados en el formulario al editar. */
    clearErrors(): void {
      if (state.step === 'form' && state.errors) set({ step: 'form', errors: null });
    },

    /** Error local (antes de enviar) que se muestra en el formulario. */
    showFormErrors(errors: ReadingFormErrors): void {
      if (state.step === 'form') set({ step: 'form', errors });
    },
  };
}

export type ReadingFlow = ReturnType<typeof createReadingFlow>;
