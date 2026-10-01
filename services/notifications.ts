import type { Notificacion } from '@/constants/notifications-mock';
import { demo } from './demo-store';

const read = new Set<string>();

function describeMeasurement(m: ReturnType<typeof demo.measurements>[number]): string {
  if (m.type === 'blood_pressure') return `Presión arterial: ${m.systolic}/${m.diastolic} mmHg, ${m.heartRate} lpm`;
  if (m.type === 'glucose') return `Glucosa: ${m.value} mg/dL`;
  return `Peso: ${m.value} kg`;
}

export function getDemoNotifications(): Notificacion[] {
  const user = demo.user();
  if (!user) return [];

  const deVinculos = demo.snapshot().relations
    .filter((r) => (user.role === 'patient' ? r.patientId === user.patientId && r.status === 'pending' : r.caregiverId === user.id))
    .map((r) => ({
      id: `${r.id}-${r.status}`,
      titulo:
        r.status === 'pending' ? 'Solicitud de vínculo pendiente'
        : r.status === 'approved' ? 'Vínculo aprobado'
        : r.status === 'rejected' ? 'Solicitud rechazada'
        : 'Acceso retirado',
      descripcion:
        user.role === 'patient'
          ? `${demo.snapshot().accounts.find((a) => a.id === r.caregiverId)?.name} solicita acompañarte. Revisa su identidad y permisos en Vínculos.`
          : 'Consulta el estado y tus pacientes en Vínculos.',
      hora: '',
      leida: read.has(`${user.id}:${r.id}-${r.status}`),
    }));

  const deMediciones = demo.measurements()
    .slice()
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
    .map((m) => ({
      id: `measurement-${m.id}`,
      titulo: 'Dato guardado',
      descripcion: `${describeMeasurement(m)}. Registrado por ${m.recordedBy ?? 'ti'}.`,
      hora: new Date(m.measuredAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      leida: read.has(`${user.id}:measurement-${m.id}`),
    }));

  const prefs = demo.snapshot().notificationPrefs;
  return [
    ...(prefs.mediciones ? deMediciones : []),
    ...(prefs.vinculos ? deVinculos : []),
  ];
}

export async function getNotifications(): Promise<Notificacion[]> {
  return getDemoNotifications();
}

export async function getNotificationById(id: string) {
  return getDemoNotifications().find((n) => n.id === id);
}

export async function markNotificationRead(id: string) {
  if (demo.user()) read.add(`${demo.user()!.id}:${id}`);
}