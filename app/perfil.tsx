import { useRouter } from 'expo-router';
import { Action, Copy, FlowPage } from '@/components/flow-ui';
import { useDemo } from '@/hooks/use-demo';
import { demo } from '@/services/demo-store';
export default function Profile() {
  const { user } = useDemo(); const router = useRouter();
  return <FlowPage title="Mi cuenta"><Copy>{user?.name}</Copy><Copy>{user?.email}</Copy><Copy>{user?.role === 'patient' ? 'Paciente' : 'Cuidador'}</Copy><Action label="Administrar vínculos" onPress={() => router.push('/vinculos')} /><Action secondary label="Cerrar sesión" onPress={() => { demo.logout(); router.replace('/(auth)/login'); }} /></FlowPage>;
}
