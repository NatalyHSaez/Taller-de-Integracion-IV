import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="registrar-medicion"
          options={{ headerShown: true, title: 'Registrar medición' }}
        />
        <Stack.Screen name="historial" options={{ headerShown: true, title: 'Historial' }} />
        <Stack.Screen
          name="notificaciones"
          options={{ headerShown: true, title: 'Notificaciones' }}
        />
        <Stack.Screen name="perfil" options={{ headerShown: true, title: 'Perfil' }} />
        <Stack.Screen name="alertas" options={{ headerShown: true, title: 'Alertas' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
