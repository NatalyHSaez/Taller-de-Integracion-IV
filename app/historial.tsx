import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MeasurementCard } from '@/components/measurement-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors } from '@/constants/theme';
import { MEASUREMENTS_MOCK } from '@/data/measurements-mock';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Measurement, MeasurementFilter } from '@/types/measurement';

const FILTERS: { label: string; value: MeasurementFilter }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Presión', value: 'blood_pressure' },
  { label: 'Glucosa', value: 'glucose' },
  { label: 'Peso', value: 'weight' },
];

type MeasurementSection = {
  key: string;
  title: string;
  data: Measurement[];
};

function getLocalDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatSectionTitle(measuredAt: string) {
  const measurementDate = new Date(measuredAt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const measurementKey = getLocalDateKey(measurementDate);
  if (measurementKey === getLocalDateKey(today)) return 'Hoy';
  if (measurementKey === getLocalDateKey(yesterday)) return 'Ayer';

  const includeYear = measurementDate.getFullYear() !== today.getFullYear();
  return capitalize(
    new Intl.DateTimeFormat('es-CL', {
      day: 'numeric',
      month: 'long',
      ...(includeYear ? { year: 'numeric' } : {}),
    }).format(measurementDate),
  );
}

function buildSections(measurements: Measurement[]): MeasurementSection[] {
  const sorted = [...measurements].sort(
    (first, second) =>
      new Date(second.measuredAt).getTime() - new Date(first.measuredAt).getTime(),
  );
  const sections = new Map<string, MeasurementSection>();

  for (const measurement of sorted) {
    const key = getLocalDateKey(measurement.measuredAt);
    const existing = sections.get(key);

    if (existing) {
      existing.data.push(measurement);
    } else {
      sections.set(key, {
        key,
        title: formatSectionTitle(measurement.measuredAt),
        data: [measurement],
      });
    }
  }

  return Array.from(sections.values());
}

export default function MeasurementHistoryScreen() {
  const [activeFilter, setActiveFilter] = useState<MeasurementFilter>('all');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const accentColor = theme.primary;
  const borderColor = theme.border;
  const surfaceColor = theme.surface;

  const sections = useMemo(() => {
    const filtered =
      activeFilter === 'all'
        ? MEASUREMENTS_MOCK
        : MEASUREMENTS_MOCK.filter((measurement) => measurement.type === activeFilter);

    return buildSections(filtered);
  }, [activeFilter]);

  return (
    <ThemedView style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom + 20, 32) },
          sections.length === 0 && styles.emptyList,
        ]}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.hero}>
              <View style={styles.heroDecorationTop} />
              <View style={styles.heroDecorationBottom} />
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons name="clipboard-pulse-outline" size={30} color={BrandColors.onPrimary} />
              </View>
              <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.heroTitle}>
                Tus mediciones
              </ThemedText>
              <ThemedText lightColor={BrandColors.onPrimaryMuted} darkColor={BrandColors.onPrimaryMuted} style={styles.introduction}>
                Revisa tus registros de presión, glucosa y peso de manera simple y ordenada.
              </ThemedText>
            </View>
            <ThemedText accessibilityRole="header" style={styles.filterTitle}>
              Filtrar registros
            </ThemedText>
            <View accessibilityRole="tablist">
              <ScrollView
                horizontal
                contentContainerStyle={styles.filters}
                showsHorizontalScrollIndicator={false}>
                {FILTERS.map((filter) => {
                  const isActive = activeFilter === filter.value;
                  return (
                    <Pressable
                      key={filter.value}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`Filtrar por ${filter.label}`}
                      onPress={() => setActiveFilter(filter.value)}
                      style={({ pressed }) => [
                        styles.filterButton,
                        {
                          backgroundColor: isActive ? accentColor : surfaceColor,
                          borderColor: isActive ? accentColor : borderColor,
                        },
                        pressed && styles.filterPressed,
                      ]}>
                      <ThemedText
                        style={[styles.filterLabel, isActive && styles.filterLabelActive]}
                        lightColor={isActive ? theme.onPrimary : theme.text}
                        darkColor={isActive ? theme.onPrimary : theme.text}>
                        {filter.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
            <View style={[styles.sectionRule, { backgroundColor: borderColor }]} />
          </View>
        )}
        renderItem={({ item }) => <MeasurementCard measurement={item} />}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={40} color={theme.icon} />
            <ThemedText style={styles.emptyTitle}>Aún no hay mediciones registradas.</ThemedText>
            <ThemedText style={[styles.emptyMessage, { color: theme.icon }]}>
              Las mediciones que registres aparecerán aquí.
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
  },
  emptyList: { flexGrow: 1 },
  headerContent: {
    gap: 16,
    paddingTop: 16,
  },
  hero: {
    backgroundColor: BrandColors.primary,
    borderRadius: 22,
    minHeight: 176,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },
  heroDecorationTop: {
    backgroundColor: BrandColors.heroHighlight,
    borderRadius: 75,
    height: 150,
    opacity: 0.5,
    position: 'absolute',
    right: -45,
    top: -70,
    width: 150,
  },
  heroDecorationBottom: {
    backgroundColor: BrandColors.heroAccent,
    borderRadius: 60,
    bottom: -70,
    height: 120,
    left: -35,
    opacity: 0.3,
    position: 'absolute',
    width: 120,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: BrandColors.overlayStrong,
    borderColor: BrandColors.overlayBorderStrong,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
    marginTop: 13,
  },
  introduction: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
    maxWidth: 305,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  filterButton: {
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: 14,
    shadowColor: BrandColors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 1,
  },
  filterPressed: { opacity: 0.78 },
  filterLabel: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  filterLabelActive: {
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  itemSeparator: { height: 9 },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 6,
    textAlign: 'center',
  },
});
