import Feather from '@expo/vector-icons/Feather';
import { Link, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NOTIFICACIONES_INICIALES } from '@/constants/notifications-mock';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type TabIconName = ComponentProps<typeof Feather>['name'];

function TabBarIcon({
  color,
  focused,
  name,
}: {
  color: string;
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

function TabBarLabel({ color, focused, label }: { color: string; focused: boolean; label: string }) {
  return (
    <Text style={[styles.tabLabel, focused && styles.tabLabelFocused, { color }]}>{label}</Text>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const tint = theme.tint;
  const noLeidas = NOTIFICACIONES_INICIALES.filter((n) => !n.leida).length;

  const headerRight = () => (
    <View style={{ flexDirection: 'row', gap: 16, marginRight: 16 }}>
      <Link href="/notificaciones" style={{ position: 'relative' }}>
        <IconSymbol size={22} name="bell.fill" color={tint} />
        {noLeidas > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              backgroundColor: '#C1443A',
              borderRadius: 8,
              minWidth: 16,
              height: 16,
              paddingHorizontal: 3,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{noLeidas}</Text>
          </View>
        )}
      </Link>
      <Link href="/perfil">
        <IconSymbol size={22} name="person.fill" color={tint} />
      </Link>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarHideOnKeyboard: true,
        headerShown: true,
        headerRight,
        tabBarButton: HapticTab,
        tabBarItemStyle: styles.tabBarItem,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: colorScheme === 'dark' ? '#30383C' : '#E5EBEE',
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 2,
          paddingTop: 7,
          shadowColor: '#000000',
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
      <Tabs.Screen name="vinculos" options={{ href: null }} />
      <Tabs.Screen name="atencion" options={{ href: null }} />
      <Tabs.Screen name="graficos" options={{ href: null }} />
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
});
