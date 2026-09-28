import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AccentColors, BrandColors, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TRACKING_CATEGORIES: { icon: IconName; label: string }[] = [
  { icon: 'heart-pulse', label: 'Presión' },
  { icon: 'water-outline', label: 'Glucosa' },
  { icon: 'scale-bathroom', label: 'Peso' },
];

export default function SeguimientoScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const accentColor = theme.primary;
  const surfaceColor = theme.surface;
  const borderColor = theme.border;
  const purple = AccentColors[isDark ? 'dark' : 'light'];

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroDecorationTop} />
          <View style={styles.heroDecorationBottom} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <ThemedText lightColor={BrandColors.onPrimaryEyebrow} darkColor={BrandColors.onPrimaryEyebrow} style={styles.eyebrow}>
                TU ESPACIO DE SALUD
              </ThemedText>
              <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.heroTitle}>
                Seguimiento diario
              </ThemedText>
            </View>
            <View style={styles.heroPulse}>
              <MaterialCommunityIcons name="heart-pulse" size={32} color={BrandColors.onPrimary} />
            </View>
          </View>

          <ThemedText lightColor={BrandColors.onPrimaryMuted} darkColor={BrandColors.onPrimaryMuted} style={styles.heroDescription}>
            Registra y consulta tus mediciones de forma simple y ordenada.
          </ThemedText>

          <View style={styles.categoryRow}>
            {TRACKING_CATEGORIES.map((category) => (
              <View key={category.label} style={styles.categoryItem}>
                <MaterialCommunityIcons name={category.icon} size={19} color={BrandColors.onPrimary} />
                <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.categoryLabel}>
                  {category.label}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
          ¿Qué deseas hacer?
        </ThemedText>

        <Pressable
          accessibilityLabel="Registrar medición"
          accessibilityHint="Abre el formulario para ingresar una nueva medición"
          accessibilityRole="button"
          onPress={() => router.push('/registrar-medicion')}
          style={({ pressed }) => [
            styles.primaryAction,
            { backgroundColor: surfaceColor, borderColor },
            pressed && styles.pressed,
          ]}>
          <View style={[styles.primaryActionIcon, { backgroundColor: theme.primarySoft }]}>
            <MaterialCommunityIcons name="heart-plus" size={29} color={accentColor} />
          </View>
          <View style={styles.primaryActionCopy}>
            <ThemedText style={styles.primaryActionTitle}>Registrar medición</ThemedText>
            <ThemedText style={[styles.actionDescription, { color: theme.icon }]}>
              Presión arterial, glucosa o peso
            </ThemedText>
          </View>
          <MaterialCommunityIcons name="arrow-right" size={22} color={accentColor} />
        </Pressable>

        <View style={styles.secondaryActions}>
          <Pressable
            accessibilityHint="Abre la lista de mediciones registradas"
            accessibilityLabel="Historial de mediciones"
            accessibilityRole="button"
            onPress={() => router.push('/historial')}
            style={({ pressed }) => [
              styles.secondaryCard,
              { backgroundColor: surfaceColor, borderColor },
              pressed && styles.pressed,
            ]}>
            <MaterialCommunityIcons
              name="clipboard-text-clock-outline"
              size={78}
              color={isDark ? BrandColors.primaryGhostDark : BrandColors.primaryGhost}
              style={styles.backgroundIcon}
            />
            <View style={[styles.secondaryIcon, { backgroundColor: theme.primarySoft }]}>
              <MaterialCommunityIcons name="history" size={27} color={accentColor} />
            </View>
            <View style={styles.secondaryCardFooter}>
              <ThemedText style={styles.secondaryTitle}>Mi historial</ThemedText>
              <MaterialCommunityIcons name="arrow-right" size={21} color={accentColor} />
            </View>
          </Pressable>

          <View
            accessible
            accessibilityLabel="Evolución y gráficos"
            style={[styles.secondaryCard, { backgroundColor: surfaceColor, borderColor }]}>
            <MaterialCommunityIcons
              name="chart-line"
              size={78}
              color={purple.purpleGhost}
              style={styles.backgroundIcon}
            />
            <View style={[styles.secondaryIcon, { backgroundColor: purple.purpleSoft }]}>
              <MaterialCommunityIcons name="chart-line" size={27} color={purple.purple} />
            </View>
            <View style={styles.secondaryCardFooterVertical}>
              <ThemedText style={styles.secondaryTitle}>Evolución y gráficos</ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: 17,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  hero: {
    backgroundColor: BrandColors.primary,
    borderRadius: 22,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },
  heroDecorationTop: {
    backgroundColor: BrandColors.heroHighlight,
    borderRadius: 80,
    height: 150,
    opacity: 0.5,
    position: 'absolute',
    right: -55,
    top: -65,
    width: 150,
  },
  heroDecorationBottom: {
    backgroundColor: BrandColors.heroAccent,
    borderRadius: 65,
    bottom: -70,
    height: 130,
    left: -45,
    opacity: 0.3,
    position: 'absolute',
    width: 130,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.7,
    lineHeight: 18,
  },
  heroTitle: {
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 33,
    marginTop: 4,
  },
  heroPulse: {
    alignItems: 'center',
    backgroundColor: BrandColors.overlay,
    borderColor: BrandColors.overlayBorder,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  heroDescription: {
    fontSize: 16,
    lineHeight: 23,
    marginTop: 14,
    maxWidth: 290,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  categoryItem: {
    alignItems: 'center',
    backgroundColor: BrandColors.overlaySubtle,
    borderColor: BrandColors.overlay,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 6,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginTop: 2,
  },
  primaryAction: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 92,
    padding: 14,
    shadowColor: BrandColors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  primaryActionIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  primaryActionCopy: {
    flex: 1,
    gap: 3,
  },
  primaryActionTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryCard: {
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 162,
    overflow: 'hidden',
    padding: 15,
    position: 'relative',
  },
  backgroundIcon: {
    bottom: -15,
    position: 'absolute',
    right: -14,
    transform: [{ rotate: '-10deg' }],
  },
  secondaryIcon: {
    alignItems: 'center',
    borderRadius: 11,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  secondaryCardFooter: {
    alignItems: 'flex-end',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryCardFooterVertical: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  secondaryTitle: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  pressed: { opacity: 0.78 },
});
