import { useEffect, useRef, useState } from 'react';

import { Copy } from '@/src/shared/presentation/components/flow-ui';
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
    <Copy>
      {remaining > 0 ? `Vence en ${formatCountdown(remaining)} (un solo uso).` : 'Código vencido.'}
    </Copy>
  );
}
