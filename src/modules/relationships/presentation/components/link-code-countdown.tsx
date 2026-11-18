import { useEffect, useRef, useState } from 'react';

import { Text } from 'react-native';

import { StatusColors } from '@/src/shared/presentation/theme';
import { formatCountdown, secondsLeft } from '@/src/modules/relationships/application/link-codes';

/**
 * Cuenta regresiva del código de vinculación ("Vence en 4:32").
 * Al llegar a cero avisa una sola vez con onExpired.
 */
export function LinkCodeCountdown({ expiresAt, onExpired }: { expiresAt: string; onExpired: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = secondsLeft(expiresAt, now);
  const notified = useRef(false);
  const onExpiredRef = useRef(onExpired);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    notified.current = false;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (remaining === 0 && !notified.current) {
      notified.current = true;
      onExpiredRef.current();
    }
  }, [remaining]);

  return (
    <Text style={{ color: StatusColors.warning.foreground, fontSize: 14, fontWeight: '700' }}>
      {remaining > 0 ? `Vence en ${formatCountdown(remaining)} (un solo uso).` : 'Código vencido.'}
    </Text>
  );
}
