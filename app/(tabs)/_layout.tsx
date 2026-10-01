import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs, usePathname, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { useAppState } from '@/hooks/use-app-state';
import { useDemo } from '@/hooks/use-demo';
import { BrandColors, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

function SharedHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, selectedPatient } = useAppState();
  const { relations } = useDemo();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const pendingCount = relations.filter((relation) =>
    relation.status === 'pending' && relation.patientId === selectedPatient?.id
  ).length;
  const date = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' }).format(new Date());
  const isCaregiver = user?.role === 'caregiver';
  const patientName = selectedPatient?.name;
  let heading = `Hola, ${user?.name.split(' ')[0] ?? ''}`;
  let subtitle = isCaregiver && patientName ? `Acompañas a ${patientName}` : 'Resumen de salud';
  if (pathname === '/seguimiento') {
    heading = 'Seguimiento';
    subtitle = isCaregiver && patientName ? `Mediciones de ${patientName}` : 'Tus mediciones';
  } else if (pathname === '/alertas') {
    heading = 'Alertas';
    subtitle = isCaregiver && patientName ? `Avisos de ${patientName}` : 'Avisos importantes';
  } else if (pathname === '/menu') {
    heading = 'Menú';
    subtitle = 'Opciones de tu cuenta';
  }

  return (
    <View style={[styles.sharedHeader, { backgroundColor: theme.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerDate, { color: theme.primary }]}>{date}</Text>
        <Text style={[styles.headerGreeting, { color: theme.text }]}>{heading}</Text>
        <Text style={[styles.headerSubtitle, { color: theme.mutedText }]} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable accessibilityLabel="Abrir notificaciones" accessibilityRole="button"
          onPress={() => router.push('/notificaciones')} style={styles.notificationButton}>
          <MaterialCommunityIcons name="bell-outline" size={23} color={theme.primary} />
          {pendingCount > 0 && <View style={[styles.notificationDot, { backgroundColor: theme.danger }]} />}
        </Pressable>
        <Pressable accessibilityLabel="Abrir perfil" accessibilityRole="button"
          onPress={() => router.push('/perfil')}
          style={[styles.avatar, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
          <Text style={[styles.avatarText, { color: theme.primary }]}>{user?.name.slice(0, 2).toUpperCase()}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const tint = theme.primary;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarHideOnKeyboard: true,
        headerShown: true,
        header: () => <SharedHeader />,
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
        options={{ href: null, headerShown: false, tabBarStyle: { display: 'none' }, title: 'Vínculos' }}
      />
      <Tabs.Screen name="atencion" options={{ href: null }} />
      <Tabs.Screen name="graficos" options={{ href: null }} />
      <Tabs.Screen name="documentos" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  sharedHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16, paddingHorizontal: 20 },
  headerCopy: { flex: 1, paddingRight: 8 },
  headerDate: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4, textTransform: 'uppercase' },
  headerGreeting: { fontSize: 29, fontWeight: '800', letterSpacing: -0.6, lineHeight: 36 },
  headerSubtitle: { fontSize: 14, lineHeight: 20 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  notificationButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 40 },
  notificationDot: { borderRadius: 5, height: 8, position: 'absolute', right: 5, top: 7, width: 8 },
  avatar: { alignItems: 'center', borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, height: 46, justifyContent: 'center', width: 46 },
  avatarText: { fontSize: 14, fontWeight: '800' },
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
