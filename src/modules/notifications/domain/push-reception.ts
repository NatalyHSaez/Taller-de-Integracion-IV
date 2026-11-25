/** Señal de recepción: nunca expone el payload, título, cuerpo ni datos clínicos. */
export type PushReceptionPort = {
  subscribe(onReceived: () => void): Promise<(() => void) | null>;
};
