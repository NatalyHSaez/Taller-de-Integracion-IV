// Datos de ejemplo compartidos entre la pantalla de Notificaciones y el badge
// del header. Cuando exista el endpoint real, esto se reemplaza por el fetch.
export type Notificacion = {
  id: string;
  titulo: string;
  descripcion: string;
  hora: string;
  leida: boolean;
};

export const NOTIFICACIONES_INICIALES: Notificacion[] = [
  { id: '1', titulo: 'Nueva alerta generada', descripcion: 'Presión sistólica con tendencia al alza sostenida durante 12 días.', hora: 'Hace 2 h', leida: false },
  { id: '2', titulo: 'Nueva indicación médica', descripcion: 'Dr. Alejandro Pérez agregó una indicación a tu ficha.', hora: 'Hace 5 h', leida: false },
  { id: '3', titulo: 'Consulta médica finalizada', descripcion: 'Tu consulta del 08 sep quedó marcada como finalizada.', hora: 'Ayer', leida: true },
  { id: '4', titulo: 'Cuidador vinculado', descripcion: 'Josefina Ríos ahora puede registrar mediciones por ti.', hora: 'Hace 3 días', leida: true },
];