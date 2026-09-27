import type { Notificacion } from '@/constants/notifications-mock';
import { demo } from './demo-store';
const read = new Set<string>();
export function getDemoNotifications(): Notificacion[] {
  const user = demo.user();
  if (!user) return [];
  return demo.snapshot().relations.filter((r) => user.role === 'patient' ? r.patientId === user.patientId && r.status === 'pending' : r.caregiverId === user.id).map((r) => ({
    id: `${r.id}-${r.status}`, titulo: r.status === 'pending' ? 'Solicitud de vínculo pendiente' : r.status === 'approved' ? 'Vínculo aprobado' : r.status === 'rejected' ? 'Solicitud rechazada' : 'Acceso retirado',
    descripcion: user.role === 'patient' ? `${demo.snapshot().accounts.find((a) => a.id === r.caregiverId)?.name} solicita acompañarte. Revisa su identidad y permisos en Vínculos.` : 'Consulta el estado y tus pacientes en Vínculos.',
    hora: '', leida: read.has(`${user.id}:${r.id}-${r.status}`),
  }));
}
export async function getNotifications(): Promise<Notificacion[]> { return getDemoNotifications(); }
export async function getNotificationById(id: string) { return getDemoNotifications().find((n) => n.id === id); }
export async function markNotificationRead(id: string) { if (demo.user()) read.add(`${demo.user()!.id}:${id}`); }
