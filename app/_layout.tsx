import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

//Reemplazar por false, cuando este funcionando el login
const isLoggedIn = true; 

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const themeName = colorScheme === 'dark' ? 'dark' : 'light';
  const appColors = Colors[themeName];
  const baseNavigationTheme = themeName === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseNavigationTheme,
    colors: {
      ...baseNavigationTheme.colors,
      primary: appColors.primary,
      background: appColors.background,
      card: appColors.surface,
      text: appColors.text,
      border: appColors.border,
      notification: appColors.danger,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Protected guard={!isLoggedIn}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={isLoggedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="registrar-medicion" options={{ title: 'Registrar medición' }} />
          <Stack.Screen name="historial" options={{ title: 'Historial' }} />
          <Stack.Screen name="notificaciones" options={{ title: 'Notificaciones' }} />
          <Stack.Screen name="perfil" options={{ title: 'Perfil' }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
