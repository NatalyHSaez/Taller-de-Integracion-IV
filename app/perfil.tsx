import { useRouter } from 'expo-router';

import { Action, Copy, FlowPage } from '@/components/flow-ui';
import { useAppState } from '@/hooks/use-app-state';
import { authService } from '@/services/authservice';

export default function ProfileScreen() {
  const { user } = useAppState();
  const router = useRouter();

  async function logout() {
    await authService.logout();
    router.replace('/(auth)/login');
  }

  return (
    <FlowPage title="Mi cuenta">
      <Copy>{user?.name}</Copy>
      <Copy>{user?.email}</Copy>
      <Copy>{user?.role === 'patient' ? 'Paciente' : 'Cuidador'}</Copy>
      <Action label="Administrar vínculos" onPress={() => router.push('/vinculos')} />
      <Action secondary label="Cerrar sesión" onPress={() => void logout()} />
    </FlowPage>
  );
}
