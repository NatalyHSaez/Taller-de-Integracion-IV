import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function DocumentosLayout() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme === 'dark' ? 'dark' : 'light'].tint;

  const headerRight = () => (
    <View style={{ flexDirection: 'row', gap: 16, marginRight: 16 }}>
      <Link href="/notificaciones">
        <IconSymbol size={22} name="bell.fill" color={tint} />
      </Link>
      <Link href="/perfil">
        <IconSymbol size={22} name="person.fill" color={tint} />
      </Link>
    </View>
  );

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Documentos', headerRight }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle del documento' }} />
    </Stack>
  );
}