import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from 'react-native';

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Declaramos los grupos sin Stack.Protected para habilitar la navegación directa */}
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notificaciones" options={{ headerShown: true, title: 'Notificaciones' }} />
        <Stack.Screen name="perfil" options={{ headerShown: true, title: 'Perfil' }} />
        <Stack.Screen name="alertas" options={{ headerShown: true, title: 'Alertas' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}