import { Stack } from 'expo-router';

import { AppHeader } from '@/src/modules/dashboard/presentation/components/app-header';

export default function DocumentosLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Documentos',
          header: () => <AppHeader back title="Documentos" subtitle="Recetas, órdenes y archivos" />,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Detalle del documento',
          header: () => <AppHeader back title="Documento" subtitle="Detalle del archivo" />,
        }}
      />
      <Stack.Screen
        name="subir"
        options={{
          title: 'Subir documento',
          header: () => <AppHeader back title="Subir documento" subtitle="Adjuntar archivo clínico" />,
        }}
      />
    </Stack>
  );
}
