import { ALERTAS_INICIALES, type AlertaItem } from '@/constants/alerts-mock';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// TODO: reemplazar 'me' por el id real del paciente autenticado cuando exista
// el contexto de sesión (viene de Identity, /api/v1/me).
export async function getAlerts(): Promise<AlertaItem[]> {
  if (!API_URL) {
    console.warn('[alerts] EXPO_PUBLIC_API_URL no configurada, usando datos mock.');
    return ALERTAS_INICIALES;
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/patients/me/alerts`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as AlertaItem[];
  } catch (err) {
    console.warn('[alerts] Backend no disponible todavía, usando datos mock.', err);
    return ALERTAS_INICIALES;
  }
}