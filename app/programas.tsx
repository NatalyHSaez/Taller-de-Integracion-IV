import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, StatusColors } from '@/constants/theme';
import { useClinicalParameters } from '@/hooks/use-clinical-parameters';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHealthConditions } from '@/hooks/use-health-conditions';
import type { ClinicalParameterCatalog } from '@/services/clinical-parameters';
import {
  ASSIGNED_CONDITIONS_API_AVAILABLE,
  type HealthProgram,
} from '@/services/health-conditions';
import type { ClinicalParameterCode } from '@/types/api';

type Theme = (typeof Colors)['light'] | (typeof Colors)['dark'];

/**
 * Vista informativa del catálogo GLOBAL de programas de seguimiento.
 *
 * Explica qué mediciones corresponden a cada programa. No muestra ni supone
 * condiciones asignadas al paciente, no permite seleccionarlas y no presenta
 * ningún programa como diagnóstico personal.
 */
export default function ProgramsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const { programs, loading, refreshing, error, refresh, retry } = useHealthConditions();
  const { catalog, refetch } = useParameterNames();

  const onRefresh = () => {
    refresh();
    refetch();
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroDecorationTop} />
          <View style={styles.heroDecorationBottom} />
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons
              name="book-open-page-variant-outline"
              size={30}
              color={BrandColors.onPrimary}
            />
          </View>
          <ThemedText
            lightColor={BrandColors.onPrimary}
            darkColor={BrandColors.onPrimary}
            style={styles.heroTitle}>
            Programas de seguimiento
          </ThemedText>
          <ThemedText
            lightColor={BrandColors.onPrimaryMuted}
            darkColor={BrandColors.onPrimaryMuted}
            style={styles.heroText}>
            Conoce qué mediciones se registran en cada programa disponible en el servicio.
          </ThemedText>
        </View>

        <Notice
          icon="information-outline"
          title="Información general"
          message="Este es el catálogo de programas que ofrece el servicio. No indica que una persona tenga alguna de estas condiciones ni reemplaza un diagnóstico médico."
        />

        <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
          Programas disponibles
        </ThemedText>

        {loading && !programs ? (
          <View style={styles.centered} accessibilityLabel="Cargando programas">
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.muted, { color: theme.mutedText }]}>
              Cargando programas…
            </ThemedText>
          </View>
        ) : error && !programs ? (
          <ErrorState message={error} onRetry={retry} theme={theme} />
        ) : programs && programs.length === 0 ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={40} color={theme.icon} />
            <ThemedText style={styles.emptyTitle}>No hay programas disponibles.</ThemedText>
            <ThemedText style={[styles.muted, { color: theme.mutedText }]}>
              Cuando el servicio publique programas, aparecerán aquí. Desliza hacia abajo para
              actualizar.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.list}>
            {error && (
              <ThemedText style={[styles.inlineError, { color: theme.danger }]}>
                No se pudo actualizar: {error} Se muestra la última información cargada.
              </ThemedText>
            )}
            {programs?.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                catalog={catalog}
                theme={theme}
              />
            ))}
          </View>
        )}

        <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
          Programas asignados
        </ThemedText>
        <AssignedConditionsSection theme={theme} />
      </ScrollView>
    </ThemedView>
  );
}

/** Nombres y unidades de parámetros desde /clinical-parameters (no constantes locales). */
function useParameterNames() {
  const { catalog, retry } = useClinicalParameters();
  return { catalog, refetch: retry };
}

function ProgramCard({
  program,
  catalog,
  theme,
}: {
  program: HealthProgram;
  catalog: ClinicalParameterCatalog | null;
  theme: Theme;
}) {
  const parameters = program.parameters;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      accessible
      accessibilityLabel={`Programa ${program.name}`}>
      <View style={styles.cardHeader}>
        <View style={[styles.codeChip, { backgroundColor: theme.primarySoft }]}>
          <ThemedText style={[styles.codeText, { color: theme.primary }]}>{program.code}</ThemedText>
        </View>
        <ThemedText style={styles.cardTitle}>{program.name}</ThemedText>
      </View>

      <ThemedText style={[styles.cardLabel, { color: theme.mutedText }]}>
        Mediciones que se registran en este programa
      </ThemedText>

      {parameters === null ? (
        <ThemedText style={[styles.muted, styles.left, { color: theme.mutedText }]}>
          El servicio aún no informa qué mediciones corresponden a este programa.
        </ThemedText>
      ) : parameters.length === 0 ? (
        <ThemedText style={[styles.muted, styles.left, { color: theme.mutedText }]}>
          Este programa no tiene mediciones asociadas.
        </ThemedText>
      ) : (
        <View style={styles.parameters}>
          {parameters.map(({ code, required }) => {
            const definition = catalog?.[code as ClinicalParameterCode];
            return (
              <View key={code} style={styles.parameterRow}>
                <MaterialCommunityIcons
                  name={required ? 'check-circle-outline' : 'circle-outline'}
                  size={18}
                  color={required ? theme.primary : theme.icon}
                />
                <ThemedText style={styles.parameterText}>
                  {definition ? definition.name : code}
                  <ThemedText style={{ color: theme.mutedText }}>
                    {definition ? ` · ${definition.unit}` : ''}
                    {required ? '' : ' · opcional'}
                  </ThemedText>
                </ThemedText>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/**
 * Espacio reservado para las condiciones asignadas al paciente.
 * No inventa datos: mientras no exista la API, solo lo explica.
 */
function AssignedConditionsSection({ theme }: { theme: Theme }) {
  if (!ASSIGNED_CONDITIONS_API_AVAILABLE) {
    return (
      <View
        style={[styles.card, styles.placeholder, { borderColor: theme.border }]}
        accessible
        accessibilityLabel="Programas asignados: información aún no disponible">
        <MaterialCommunityIcons name="account-clock-outline" size={28} color={theme.icon} />
        <ThemedText style={styles.placeholderTitle}>Aún no disponible</ThemedText>
        <ThemedText style={[styles.muted, { color: theme.mutedText }]}>
          El catálogo de arriba no informa qué programas tiene asignados cada paciente. Esa
          información se mostrará aquí cuando el servicio la entregue; para conocerla, consulta
          con tu equipo de salud.
        </ThemedText>
      </View>
    );
  }

  // Cuando exista la API de condiciones asignadas, su lista se renderiza aquí.
  return null;
}

function Notice({
  icon,
  title,
  message,
}: {
  icon: 'information-outline';
  title: string;
  message: string;
}) {
  return (
    <View style={[styles.notice, { backgroundColor: StatusColors.info.background }]}>
      <MaterialCommunityIcons name={icon} size={22} color={StatusColors.info.foreground} />
      <View style={styles.noticeBody}>
        <ThemedText style={[styles.noticeTitle, { color: StatusColors.info.foreground }]}>
          {title}
        </ThemedText>
        <ThemedText
          lightColor={StatusColors.info.foreground}
          darkColor={StatusColors.info.foreground}
          style={styles.noticeText}>
          {message}
        </ThemedText>
      </View>
    </View>
  );
}

function ErrorState({
  message,
  onRetry,
  theme,
}: {
  message: string;
  onRetry: () => void;
  theme: Theme;
}) {
  return (
    <View style={styles.centered}>
      <MaterialCommunityIcons name="cloud-alert-outline" size={40} color={theme.danger} />
      <ThemedText style={styles.emptyTitle}>No se pudieron cargar los programas.</ThemedText>
      <ThemedText style={[styles.muted, { color: theme.mutedText }]}>{message}</ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [
          styles.retryButton,
          { backgroundColor: theme.primary },
          pressed && styles.pressed,
        ]}>
        <ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary} style={styles.retryText}>
          Reintentar
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 16 },
  hero: {
    backgroundColor: BrandColors.primary,
    borderRadius: 22,
    minHeight: 168,
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
  heroTitle: { fontSize: 25, fontWeight: '800', lineHeight: 31, marginTop: 13 },
  heroText: { fontSize: 15, lineHeight: 22, marginTop: 5, maxWidth: 305 },
  notice: { borderRadius: 14, flexDirection: 'row', gap: 10, padding: 14 },
  noticeBody: { flex: 1, gap: 2 },
  noticeTitle: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  noticeText: { fontSize: 14, lineHeight: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', lineHeight: 24, marginTop: 4 },
  list: { gap: 12 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 16,
  },
  cardHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  codeChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  codeText: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: '700', lineHeight: 23 },
  cardLabel: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  parameters: { gap: 6 },
  parameterRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  parameterText: { flex: 1, fontSize: 15, lineHeight: 21 },
  placeholder: { alignItems: 'center', borderStyle: 'dashed' },
  placeholderTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  centered: { alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', lineHeight: 25, textAlign: 'center' },
  muted: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  left: { textAlign: 'left' },
  inlineError: { fontSize: 14, lineHeight: 20 },
  retryButton: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 20,
  },
  retryText: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
