import { useState } from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Action, Card, Copy } from '@/components/flow-ui';
import { LinkCodeCountdown } from '@/components/relationships/link-code-countdown';
import { createPatientLinkCode, type LinkCodeResponse } from '@/services/api';

/**
 * Código de vinculación para un médico (tipo DOCTOR). El médico lo ingresa en
 * la web para médicos. Mismo comportamiento que el código del cuidador:
 * 5 minutos, un solo uso, y el QR contiene solo `code`.
 */
export function DoctorLinkCodeCard({ patientId }: { patientId: string }) {
  const [linkCode, setLinkCode] = useState<LinkCodeResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [message, setMessage] = useState('');

  async function generate() {
    setMessage('');
    setLinkCode(null);
    setShowQr(false);
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
    <Card>
      <Copy>Invitar médico</Copy>
      <Copy>
        Genera un código temporal para que tu médico se vincule desde la web para médicos.
        El código dura 5 minutos y solo puede usarse una vez.
      </Copy>

      <Action
        label={generating ? 'Generando código...' : linkCode ? 'Generar nuevo código para médico' : 'Generar código para médico'}
        onPress={() => { if (!generating) void generate(); }}
      />

      {linkCode && (
        <>
          <Copy>Código: {linkCode.code}</Copy>
          <LinkCodeCountdown
            expiresAt={linkCode.expiresAt}
            onExpired={() => {
              setLinkCode(null);
              setShowQr(false);
              setMessage('El código para médico venció. Genera uno nuevo.');
            }}
          />
          <Action secondary label={showQr ? 'Ocultar QR' : 'Mostrar QR escaneable'} onPress={() => setShowQr((v) => !v)} />
          {showQr && (
            <View style={{ alignItems: 'center', paddingVertical: 12, gap: 8 }}>
              <View style={{ padding: 14, backgroundColor: '#FFFFFF' }}>
                <QRCode value={linkCode.code} size={220} />
              </View>
              <Copy>El QR contiene solo el código temporal de un solo uso.</Copy>
            </View>
          )}
          <Action
            label="Compartir código"
            onPress={() => {
              void Share.share({
                message: `Código de vinculación Domicilia para médico: ${linkCode.code}\nVence en 5 minutos y sirve una sola vez.`,
              }).catch(() => setMessage('No fue posible compartir el código.'));
            }}
          />
        </>
      )}

      {!!message && <Copy>{message}</Copy>}
    </Card>
  );
}
