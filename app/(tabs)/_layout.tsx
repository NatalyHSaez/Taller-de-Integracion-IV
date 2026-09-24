import { Link, Tabs } from 'expo-router';
import { Text, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NOTIFICACIONES_INICIALES } from '@/constants/notifications-mock';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme === 'dark' ? 'dark' : 'light'].tint;
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
        headerShown: true,
        headerRight,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Resumen',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
  name="documentos"
  options={{
    title: 'Documentos',
    headerShown: false,
    tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.text.fill" color={color} />,
  }}
/>
      <Tabs.Screen
        name="graficos"
        options={{
          title: 'Gráficos',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.line.uptrend.xyaxis" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}