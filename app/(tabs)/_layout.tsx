import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/src/shared/presentation/components/haptic-tab';
import { BrandColors, Colors } from '@/src/shared/presentation/theme';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';
import { AppHeader } from '@/src/modules/dashboard/presentation/components/app-header';

type TabIconName = ComponentProps<typeof Feather>['name'];

function TabBarIcon({
  color,
  focused,
  name,
}: {
  color: ColorValue;
  focused: boolean;
  name: TabIconName;
}) {
  return (
    <View style={styles.tabIconContainer}>
      <Feather color={color} name={name} size={22} />
      {focused && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
    </View>
  );
}

function TabBarLabel({ color, focused, label }: { color: ColorValue; focused: boolean; label: string }) {
  return (
    <Text style={[styles.tabLabel, focused && styles.tabLabelFocused, { color }]}>{label}</Text>
  );
}

function GraphicsHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View
      style={[
        styles.graphicsHeader,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          borderBottomColor: theme.border,
        },
      ]}>
      <Pressable
        accessibilityLabel="Volver"
        accessibilityRole="button"
        onPress={() => router.replace('/seguimiento')}
        hitSlop={10}
        style={({ pressed }) => [
          styles.graphicsBackButton,
          pressed && { opacity: 0.5 },
        ]}>
        <MaterialCommunityIcons
          name="arrow-left"
          size={26}
          color={theme.text}
        />
      </Pressable>

      <Text style={[styles.graphicsHeaderTitle, { color: theme.text }]}>
        Gráficos
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const tint = theme.primary;

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarHideOnKeyboard: true,
        headerShown: true,
        header: () => <AppHeader />,
        tabBarButton: HapticTab,
        tabBarItemStyle: styles.tabBarItem,
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 2,
          paddingTop: 7,
          shadowColor: BrandColors.neutralShadow,
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: colorScheme === 'dark' ? 0.12 : 0.04,
          shadowRadius: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarAccessibilityLabel: 'Ir a Inicio',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon color={color} focused={focused} name="home" />
          ),
          tabBarLabel: ({ color, focused }) => (
            <TabBarLabel color={color} focused={focused} label="Inicio" />
          ),
        }}
      />
      <Tabs.Screen
        name="seguimiento"
        options={{
          title: 'Seguimiento',
          tabBarAccessibilityLabel: 'Ir a Seguimiento',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon color={color} focused={focused} name="activity" />
          ),
          tabBarLabel: ({ color, focused }) => (
            <TabBarLabel color={color} focused={focused} label="Seguimiento" />
          ),
        }}
      />
      <Tabs.Screen
        name="alertas"
        options={{
          title: 'Alertas',
          tabBarAccessibilityLabel: 'Ir a Alertas',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon color={color} focused={focused} name="alert-triangle" />
          ),
          tabBarLabel: ({ color, focused }) => (
            <TabBarLabel color={color} focused={focused} label="Alertas" />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menú',
          tabBarAccessibilityLabel: 'Ir al Menú',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon color={color} focused={focused} name="menu" />
          ),
          tabBarLabel: ({ color, focused }) => (
            <TabBarLabel color={color} focused={focused} label="Menú" />
          ),
        }}
      />
      <Tabs.Screen
        name="vinculos"
        options={{
          href: null,
          title: 'Vínculos',
          header: () => <AppHeader back title="Vínculos" subtitle="Cuidadores y profesionales" />,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="atencion"
        options={{
          href: null,
          title: 'Atención médica',
          header: () => <AppHeader back title="Atención médica" subtitle="Tus canales de atención" />,
        }}
      />
      <Tabs.Screen
        name="graficos"
        options={{
          href: null,
          title: 'Gráficos',
          headerShown: true,
          header: () => <GraphicsHeader />,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen name="documentos" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarItem: {
    paddingVertical: 1,
  },
  tabIconContainer: {
    alignItems: 'center',
    height: 29,
    justifyContent: 'flex-start',
    paddingTop: 1,
    position: 'relative',
    width: 32,
  },
  activeIndicator: {
    borderRadius: 2,
    bottom: 0,
    height: 2,
    position: 'absolute',
    width: 18,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
  },
  tabLabelFocused: {
    fontWeight: '600',
  },
  graphicsHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 12,
  },

  graphicsBackButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  graphicsHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 4,
  },
});
