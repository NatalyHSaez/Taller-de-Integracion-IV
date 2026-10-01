import { AccessBoundary } from '@/components/access-boundary';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(auth)',
};

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { loading } = useAuth();

  const themeName = colorScheme === 'dark' ? 'dark' : 'light';
  const appColors = Colors[themeName];

  const baseNavigationTheme =
    themeName === 'dark' ? DarkTheme : DefaultTheme;

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

  if (loading) {
    return (
      <ThemeProvider value={navigationTheme}>
        <View
          style={[
            styles.loadingContainer,
            { backgroundColor: appColors.background },
          ]}
        >
          <ActivityIndicator size="large" color={appColors.primary} />
        </View>

        <StatusBar style="auto" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenLayout={({ children }) => (
          <AccessBoundary>{children}</AccessBoundary>
        )}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />

        <Stack.Screen
          name="registrar-medicion"
          options={{
            headerShown: true,
            title: 'Registrar medición',
          }}
        />

        <Stack.Screen
          name="historial"
          options={{
            headerShown: true,
            title: 'Historial',
          }}
        />

        <Stack.Screen
          name="notificaciones"
          options={{
            headerShown: true,
            title: 'Notificaciones',
          }}
        />

        <Stack.Screen
          name="perfil"
          options={{
            headerShown: true,
            title: 'Perfil',
          }}
        />
      </Stack>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});