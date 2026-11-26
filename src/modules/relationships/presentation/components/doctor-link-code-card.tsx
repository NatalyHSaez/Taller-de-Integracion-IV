import { useState } from 'react';

import { createPatientLinkCode } from '@/src/modules/relationships/application/use-cases/link-codes';
import type { LinkCodeResponse } from '@/src/modules/relationships/domain/relationships';
import {
  LinkButton,
  LinkCodeDisplay,
  Notice,
  Panel,
  PanelHeader,
} from '@/src/modules/relationships/presentation/components/links-ui';

/**
 * Código de vinculación para un médico (tipo DOCTOR). El médico lo ingresa en
 * la web para médicos. Mismo comportamiento que el código del cuidador:
 * 5 minutos, un solo uso, y el QR contiene solo `code`.
 */
export function DoctorLinkCodeCard({ patientId }: { patientId: string }) {
  const [linkCode, setLinkCode] = useState<LinkCodeResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  async function generate() {
    setMessage('');
    setLinkCode(null);
    setGenerating(true);
    try {
      setLinkCode(await createPatientLinkCode(patientId, 'DOCTOR'));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No fue posible generar el código.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        role="doctor"
        icon="stethoscope"
        title="Invitar médico"
        description="Tu médico ingresa el código en la web para médicos. Dura 5 minutos y sirve una sola vez."
      />

      {linkCode && (
        <LinkCodeDisplay
          code={linkCode.code}
          expiresAt={linkCode.expiresAt}
          onExpired={() => {
            setLinkCode(null);
            setMessage('El código para médico venció. Genera uno nuevo.');
          }}
          qrHint="El QR contiene solo el código temporal de un solo uso."
          shareMessage={`Código de vinculación Domicilia para médico: ${linkCode.code}\nVence en 5 minutos y sirve una sola vez.`}
          onShareError={() => setMessage('No fue posible compartir el código.')}
        />
      )}

      <LinkButton
        variant={linkCode ? 'secondary' : 'primary'}
        icon={linkCode ? 'refresh' : 'key-plus'}
        busy={generating}
        label={generating ? 'Generando código...' : linkCode ? 'Generar nuevo código para médico' : 'Generar código para médico'}
        onPress={() => { if (!generating) void generate(); }}
      />

      {!!message && <Notice tone="error" text={message} />}
    </Panel>
  );
}
