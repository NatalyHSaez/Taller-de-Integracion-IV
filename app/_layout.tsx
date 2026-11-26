import '@/composition/configure/configure-dashboard';
import '@/composition/configure/configure-notifications';
import '@/composition/configure/configure-monitoring';
import '@/composition/configure/configure-relationships';
import '@/composition/configure/configure-identity';
import '@/composition/configure/configure-app-state';
import { useEffect } from "react";
import { startPushNavigation } from "@/src/modules/notifications/application/use-cases/push-navigation";
import { startPushReception } from "@/src/modules/notifications/application/use-cases/push-reception";
import { AccessBoundary } from "@/src/modules/identity/presentation/components/access-boundary";
import { AppHeader } from "@/src/modules/dashboard/presentation/components/app-header";
import { Colors } from "@/src/shared/presentation/theme";
import { AppStateProvider } from "@/src/core/presentation/session/app-state-context";
import { AuthProvider, useAuth } from "@/src/modules/identity/presentation/hooks/use-auth";
import { useColorScheme } from "@/src/shared/presentation/hooks/use-color-scheme";

import { Stack, useRootNavigationState, useRouter } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(auth)",
};

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { loading } = useAuth();
  const router = useRouter();
  const rootKey = useRootNavigationState()?.key;

  useEffect(() => {
    if (loading || !rootKey) return;
    return startPushNavigation(() => router.navigate("/notificaciones"));
  }, [loading, rootKey, router]);

  const themeName = colorScheme === "dark" ? "dark" : "light";
  const appColors = Colors[themeName];

  const baseNavigationTheme = themeName === "dark" ? DarkTheme : DefaultTheme;

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
            title: "Registrar medición",
          }}
        />

        <Stack.Screen
          name="historial"
          options={{
            headerShown: true,
            title: "Historial",
          }}
        />

        <Stack.Screen
          name="lectura/[readingId]"
          options={{
            headerShown: true,
            title: "Detalle de lectura",
          }}
        />

        <Stack.Screen
          name="notificaciones"
          options={{
            headerShown: true,
            title: "Notificaciones",
          }}
        />

        <Stack.Screen
          name="programas"
          options={{
            headerShown: true,
            title: "Programas",
            header: () => (
              <AppHeader back title="Programas" subtitle="Qué se mide en cada programa" />
            ),
          }}
        />

        <Stack.Screen
          name="perfil"
          options={{
            headerShown: true,
            title: "Perfil",
            header: () => (
              <AppHeader back title="Mi perfil" subtitle="Datos personales y red de cuidado" />
            ),
          }}
        />
      </Stack>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => startPushReception(), []);
  return (
    <AuthProvider>
      <AppStateProvider>
        <RootNavigator />
      </AppStateProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
