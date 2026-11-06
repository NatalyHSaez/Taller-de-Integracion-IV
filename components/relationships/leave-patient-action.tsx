import { useState } from 'react';

import { Action, Copy } from '@/components/flow-ui';
import { confirmAction, leaveCaregiverRelationship } from '@/services/relationship-actions';

/**
 * El cuidador deja de acompañar a un paciente (DELETE de su propio vínculo).
 * Pide confirmación; cancelar no revoca. Después actualiza la lista.
 */
export function LeavePatientAction({
  patientId,
  patientName,
  onLeft,
}: {
  patientId: string;
  patientName: string;
  onLeft: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function leave() {
    const confirmed = await confirmAction({
      title: 'Dejar de acompañar',
      message: `¿Quieres dejar de acompañar a ${patientName}? Perderás el acceso a su información hasta que te vuelva a invitar.`,
      confirmLabel: 'Dejar de acompañar',
    });
    if (!confirmed) return;
    setBusy(true);
    setMessage('');
    try {
      await leaveCaregiverRelationship(patientId);
      await onLeft();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo dejar el vínculo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Action
        secondary
        disabled={busy}
        label={busy ? 'Procesando...' : 'Dejar de acompañar'}
        onPress={() => { if (!busy) void leave(); }}
      />
      {!!message && <Copy>{message}</Copy>}
    </>
  );
}
