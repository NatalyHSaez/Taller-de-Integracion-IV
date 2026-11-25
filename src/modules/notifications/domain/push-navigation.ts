/** Señal de pulsación. Nunca contiene una ruta, un paciente ni contenido del aviso. */
export type PushOpenOrigin = 'initial' | 'live';
export type PushNavigationPort = {
  subscribe(onOpen: (origin: PushOpenOrigin) => void): Promise<(() => void) | null>;
};
