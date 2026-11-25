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

import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { BrandColors, Colors, StatusColors } from '@/src/shared/presentation/theme';
import { useClinicalParameters } from '@/src/modules/monitoring/presentation/hooks/use-clinical-parameters';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';
import { useHealthConditions } from '@/src/modules/monitoring/presentation/hooks/use-health-conditions';
import type { ClinicalParameterCatalog } from '@/src/modules/monitoring/application/use-cases/clinical-parameters';
import {
  type HealthProgram,
} from '@/src/modules/monitoring/application/use-cases/health-conditions';
import { usePatientConditions } from '@/src/modules/monitoring/presentation/hooks/use-patient-conditions';
import type { ClinicalParameterCode } from '@/src/modules/monitoring/domain/contracts';

type Theme = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** Catálogo global y condiciones asignadas, consultados por separado. */
export default function ProgramsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const { programs, loading, refreshing, error, refresh, retry } = useHealthConditions();
  const { catalog, refetch } = useParameterNames();
  const assigned = usePatientConditions();

  const onRefresh = () => {
    refresh();
    refetch();
    void assigned.refresh();
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
            refreshing={refreshing || assigned.loading}
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
        <AssignedConditionsSection theme={theme} assigned={assigned} />
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

      {parameters.length === 0 ? (
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
                    {definition?.unit ? ` · ${definition.unit}` : ''}
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

function AssignedConditionsSection({ theme, assigned }: { theme: Theme; assigned: ReturnType<typeof usePatientConditions> }) {
  if (!assigned.allowed) return <ThemedText style={[styles.muted, { color: theme.mutedText }]}>{assigned.patientId ? 'No tienes permiso para consultar las condiciones asignadas.' : 'Selecciona un paciente para consultar sus condiciones.'}</ThemedText>;
  if (assigned.loading) return <ActivityIndicator accessibilityLabel="Cargando condiciones asignadas" color={theme.primary} />;
  if (assigned.error) return <View style={styles.centered}>
    <ThemedText style={{ color: theme.danger }}>{assigned.error}</ThemedText>
    <Pressable accessibilityRole="button" onPress={assigned.refresh} style={[styles.retryButton, { backgroundColor: theme.primary }]}><ThemedText lightColor={theme.onPrimary} darkColor={theme.onPrimary}>Reintentar</ThemedText></Pressable>
  </View>;
  return <View style={styles.list}>
    <ThemedText style={{ color: theme.mutedText }}>Paciente: {assigned.patientName}</ThemedText>
    {assigned.items?.length === 0 && <ThemedText>No hay condiciones asignadas.</ThemedText>}
    {assigned.items?.map(item => <View key={item.conditionCode} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.codeChip, { backgroundColor: theme.primarySoft }]}><ThemedText style={[styles.codeText, { color: theme.primary }]}>{item.conditionCode}</ThemedText></View>
        <ThemedText style={styles.cardTitle}>{item.name}</ThemedText>
      </View>
      <ThemedText>Estado: {item.status === 'active' ? 'Activa' : item.status}</ThemedText>
      <ThemedText style={{ color: theme.mutedText }}>Fecha de inicio: {item.startedAt ? item.startedAt.split('-').reverse().join('/') : 'Sin información'}</ThemedText>
    </View>)}
  </View>;
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
