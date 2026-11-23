import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Action } from '@/src/shared/presentation/components/flow-ui';
import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { BrandColors, Colors, MeasurementColors, StatusColors } from '@/src/shared/presentation/theme';
import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';
import type { Measurement, MeasurementType } from '@/src/modules/monitoring/domain/measurement';

import { useAuth } from '@/src/modules/identity/presentation/hooks/use-auth';
import { appState } from '@/src/core/application/session/app-state';
import { createHomeSummary } from '@/src/modules/dashboard/application/home-summary';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Solo estas tres categorías tienen tarjeta de resumen y colores propios. */
type SummaryMeasurementType = Extract<MeasurementType, 'blood_pressure' | 'glucose' | 'weight'>;

type MeasurementSummary = {
  type: SummaryMeasurementType;
  label: string;
  icon: IconName;
  value: string;
  unit?: string;
  recordedAt: string;
};

function getLatestMeasurement(type: SummaryMeasurementType, measurements: Measurement[]): Measurement | undefined {
  return measurements.filter((measurement) => measurement.type === type).sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
  )[0];
}

function getMeasurementSummary(type: SummaryMeasurementType, measurements: Measurement[]): MeasurementSummary | undefined {
  const measurement = getLatestMeasurement(type, measurements);
  if (!measurement) return undefined;

  if (measurement.type === 'blood_pressure') {
    return {
      type,
      label: 'Presión',
      icon: 'heart-pulse',
      value: `${measurement.systolic}/${measurement.diastolic}`,
      unit: 'mmHg',
      recordedAt: measurement.measuredAt,
    };
  }

  return {
    type,
    label: measurement.type === 'glucose' ? 'Glucosa' : 'Peso',
    icon: measurement.type === 'glucose' ? 'water-outline' : 'scale-bathroom',
    value: String(measurement.value),
    unit: measurement.unit,
    recordedAt: measurement.measuredAt,
  };
}

function formatMeasurementDate(date: string) {
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(
    new Date(date)
  );
}

/**
 * Reinicia el resumen y sus solicitudes cuando cambia la cuenta o el modo
 * de sesión. Así no se comparten resultados anteriores entre usuarios.
 */
export default function ResumenScreen() {
  const { user, sessionMode } = useAppState();
  const sessionKey = `${sessionMode ?? 'none'}:${user?.id ?? 'none'}`;
  return <ResumenContent key={sessionKey} />;
}

function ResumenContent() {
  const { user, selectedPatient, permissions, sessionMode } = useAppState();
  const { user: authUser } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const themeName = colorScheme === 'dark' ? 'dark' : 'light';
  const theme = Colors[themeName];
  const measurementColors = MeasurementColors[themeName];

  const isRealSession = sessionMode === 'backend';
  // El paciente se identifica por su usuario; el cuidador elige un paciente vinculado.
  const emergencyPatientId = authUser?.roles.includes('PATIENT')
    ? authUser.id : selectedPatient?.id ?? null;
  const homePatientId = isRealSession && permissions.read ? emergencyPatientId : null;
  const homeRole = user?.role === 'patient' ? 'patient' : 'caregiver';

  // Mantener un único estado de resumen para la sesión actual.
  const [homeStore] = useState(() => createHomeSummary());
  const home = useSyncExternalStore(homeStore.subscribe, homeStore.getState, homeStore.getState);

  useEffect(() => {
    void homeStore.setPatient(homePatientId, homeRole);
  }, [homeStore, homePatientId, homeRole]);

  // Al regresar a Inicio se vuelven a solicitar las últimas mediciones y alertas.
  const isFocused = useIsFocused();
  const firstFocus = useRef(true);
  useEffect(() => {
    if (!isFocused) return;
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    void homeStore.refresh();
    if (isRealSession && homeRole === 'caregiver') {
      void appState.loadRealPatients().catch(() => {});
    }
  }, [homeStore, isFocused, homeRole, isRealSession]);

  const homeReady = isRealSession && Boolean(homePatientId) && home.patientId === homePatientId;
  const homeLoading = isRealSession && Boolean(homePatientId) &&
    (!homeReady || (home.loading && !home.loaded));
  const homeError = homeReady ? home.error : null;

  // En modo real prevalecen los permisos del vínculo vigente; la API
  // debe volver a comprobarlos en cada registro.
  const canRegisterMeasurement = Boolean(emergencyPatientId && permissions.write &&
    homeReady && home.canRegister && !homeError);
  const summaryMeasurements = homeReady && !homeError && permissions.read
    ? home.measurements : [];
  const summaries = (['blood_pressure', 'glucose', 'weight'] as const)
    .map(type => getMeasurementSummary(type, summaryMeasurements))
    .filter((summary): summary is MeasurementSummary => Boolean(summary));
  const priorityAlert = permissions.alerts && homeReady && !homeError && home.alert
    ? { parametro: home.alert.explanation || `Alerta de severidad ${home.alert.severity.toLowerCase()}` }
    : undefined;

  const handleEmergencyPress = () => {
    Alert.alert(
      '¿Necesitas ayuda?',
      'Selecciona a quién deseas llamar.',
      [
        {
          text: 'Servicio de emergencias (131)',
          onPress: () => {
            Alert.alert(
              'Confirmar llamada',
              '¿Deseas abrir el teléfono para llamar al SAMU (131)?',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Abrir teléfono',
                  onPress: () => {
                    Linking.openURL('tel:131').catch(() => {
                      Alert.alert(
                        'No se pudo abrir el teléfono',
                        'Tu dispositivo no pudo abrir el marcador telefónico.'
                      );
                    });
                  },
                },
              ]
            );
          },
        },
        
        // El contacto personal requiere un endpoint real del backend.
        // Hasta disponer de él, no se consulta ni guarda información local.

        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };


  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.hero}>
          <View style={styles.heroDecoration} />
          <View style={styles.heroHeading}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons color={BrandColors.onPrimary} name="heart-pulse" size={25} />
            </View>
            <View style={styles.heroCopy}>
              <ThemedText lightColor={BrandColors.onPrimaryMuted} darkColor={BrandColors.onPrimaryMuted} style={styles.heroEyebrow}>TU SALUD, A MANO</ThemedText>
              <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.heroTitle}>¿Qué necesitas hacer?</ThemedText>
            </View>
          </View>
          <View style={styles.actions}>
          <Pressable
            accessibilityLabel="Registrar medición"
            disabled={!canRegisterMeasurement}
            accessibilityState={{ disabled: !canRegisterMeasurement }}
            accessibilityRole="button"
            onPress={() => router.push('/registrar-medicion')}
            style={({ pressed }) => [styles.registerButton, !canRegisterMeasurement && { opacity: 0.45 }, pressed && styles.pressed]}>
            <MaterialCommunityIcons color={theme.primary} name="plus-circle-outline" size={22} />
            <ThemedText
              lightColor={theme.primary}
              darkColor={theme.primary}
              style={styles.registerButtonText}>
              Registrar
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityHint="Solicita confirmación antes de avisar a un contacto"
            accessibilityLabel="Solicitar ayuda"
            accessibilityRole="button"
            onPress={handleEmergencyPress}
            style={({ pressed }) => [
              styles.emergencyButton,
              { backgroundColor: BrandColors.overlay, borderColor: BrandColors.overlayBorderStrong },
              pressed && styles.pressed,
            ]}>
            <MaterialCommunityIcons color={BrandColors.onPrimary} name="phone-alert-outline" size={21} />
            <ThemedText lightColor={BrandColors.onPrimary} darkColor={BrandColors.onPrimary} style={styles.emergencyButtonText}>Emergencia</ThemedText>
          </Pressable>
          </View>
        </View>

        {user?.role === 'caregiver' && <Action secondary label="Mis pacientes y vínculos" onPress={() => router.push('/(auth)/select-patient')} />}

        <View style={styles.sectionHeader}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
            Tus mediciones
          </ThemedText>
          <Pressable accessibilityRole="link" onPress={() => router.navigate('/seguimiento')}>
            <ThemedText style={[styles.link, { color: theme.primary }]}>Ver todas</ThemedText>
          </Pressable>
        </View>

        {summaries.length === 0 ? (
          <Pressable
            accessibilityRole={homeError?.kind === 'network' ? 'button' : undefined}
            accessibilityLabel={homeError?.kind === 'network' ? 'Reintentar cargar mediciones' : undefined}
            disabled={homeError?.kind !== 'network'}
            onPress={() => { void homeStore.refresh(); }}
            style={[styles.emptyMeasurements, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
              <MaterialCommunityIcons color={theme.primary} name="heart-pulse" size={23} />
            </View>
            <View style={styles.emptyCopy}>
              <ThemedText style={styles.emptyTitle}>
                {!emergencyPatientId
                  ? 'Mediciones no disponibles'
                  : !permissions.read
                    ? 'Mediciones no disponibles'
                    : homeLoading
                      ? 'Cargando mediciones…'
                      : homeError
                        ? homeError.kind === 'network'
                          ? 'No se pudieron cargar las mediciones'
                          : 'Mediciones no disponibles'
                        : 'Aún no hay mediciones'}
              </ThemedText>
              <ThemedText style={[styles.emptyDescription, { color: theme.mutedText }]}>
                {!emergencyPatientId
                  ? 'Selecciona un paciente vinculado para consultar sus mediciones.'
                  : !permissions.read
                    ? 'No tienes permiso para consultar las mediciones de este paciente.'
                    : homeLoading
                      ? 'Un momento, por favor.'
                      : homeError
                        ? homeError.message
                        : canRegisterMeasurement
                          ? 'Registra la primera para verla aquí.'
                          : 'Todavía no hay mediciones registradas.'}
              </ThemedText>
            </View>
          </Pressable>
        ) : <View style={styles.measurementsGrid}>
          {summaries.map((summary) => {
            const colors = measurementColors[summary.type];
            return (
              <Pressable
                accessibilityLabel={`Ver seguimiento de ${summary.label.toLowerCase()}`}
                accessibilityRole="button"
                key={summary.type}
                onPress={() => router.navigate('/seguimiento')}
                style={({ pressed }) => [
                  styles.measurementCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.measurementIcon, { backgroundColor: colors.background }]}>
                  <MaterialCommunityIcons color={colors.accent} name={summary.icon} size={19} />
                </View>
                <ThemedText style={[styles.measurementLabel, { color: theme.mutedText }]}>
                  {summary.label}
                </ThemedText>
                <ThemedText style={styles.measurementValue}>{summary.value}</ThemedText>
                {summary.unit && (
                  <ThemedText style={[styles.measurementUnit, { color: theme.mutedText }]}>
                    {summary.unit}
                  </ThemedText>
                )}
                <ThemedText style={[styles.measurementDate, { color: theme.mutedText }]}>
                  {formatMeasurementDate(summary.recordedAt)}
                </ThemedText>
              </Pressable>
            );
          })}
          {canRegisterMeasurement && <Pressable
            accessibilityLabel="Registrar otra medición"
            accessibilityRole="button"
            onPress={() => router.push('/registrar-medicion')}
            style={({ pressed }) => [styles.addMeasurement, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }, pressed && styles.pressed]}>
            <MaterialCommunityIcons color={theme.primary} name="plus" size={26} />
            <ThemedText style={[styles.addMeasurementText, { color: theme.primary }]}>Registrar</ThemedText>
          </Pressable>}
        </View>}

        {priorityAlert && (
          <Pressable
            accessibilityLabel="Ver alerta activa"
            accessibilityRole="button"
            onPress={() => router.navigate('/alertas')}
            style={({ pressed }) => [
              styles.alertCard,
              {
                backgroundColor: StatusColors.warning.background,
                borderColor: StatusColors.warning.foreground,
              },
              pressed && styles.pressed,
            ]}>
            <MaterialCommunityIcons
              color={StatusColors.warning.foreground}
              name="alert-circle-outline"
              size={22}
            />
            <View style={styles.alertCopy}>
              <ThemedText style={[styles.alertTitle, { color: StatusColors.warning.foreground }]}>
                Tienes una alerta activa
              </ThemedText>
              <ThemedText style={styles.alertMessage} numberOfLines={1}>
                {priorityAlert.parametro}
              </ThemedText>
            </View>
            <MaterialCommunityIcons
              color={StatusColors.warning.foreground}
              name="chevron-right"
              size={22}
            />
          </Pressable>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 20, paddingHorizontal: 20, paddingBottom: 32 },
  hero: { backgroundColor: BrandColors.primary, borderRadius: 26, gap: 20, overflow: 'hidden', padding: 20 },
  heroDecoration: { backgroundColor: BrandColors.heroHighlight, borderRadius: 90, height: 175, opacity: 0.28, position: 'absolute', right: -38, top: -75, width: 175 },
  heroHeading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  heroIcon: { alignItems: 'center', backgroundColor: BrandColors.overlayStrong, borderRadius: 13, height: 47, justifyContent: 'center', width: 47 },
  heroCopy: { flex: 1 },
  heroEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  heroTitle: { fontSize: 20, fontWeight: '800', lineHeight: 26, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  registerButton: { alignItems: 'center', backgroundColor: BrandColors.onPrimary, borderRadius: 13, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 48 },
  registerButtonText: { fontSize: 15, fontWeight: '800' },
  emergencyButton: { alignItems: 'center', borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 48 },
  emergencyButtonText: { fontSize: 14, fontWeight: '800' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { fontSize: 19, fontWeight: '800', lineHeight: 25 },
  link: { fontSize: 13, fontWeight: '700' },
  measurementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  emptyMeasurements: { alignItems: 'center', borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 86, padding: 14 },
  emptyIcon: { alignItems: 'center', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  emptyCopy: { flex: 1, gap: 3 },
  emptyTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  emptyDescription: { fontSize: 13, lineHeight: 18 },
  measurementCard: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, minHeight: 152, padding: 15, width: '47%' },
  addMeasurement: { alignItems: 'center', borderRadius: 20, borderStyle: 'dashed', borderWidth: 1.5, gap: 6, justifyContent: 'center', minHeight: 152, width: '47%' },
  addMeasurementText: { fontSize: 13, fontWeight: '700' },
  measurementIcon: { alignItems: 'center', borderRadius: 9, height: 32, justifyContent: 'center', marginBottom: 9, width: 32 },
  measurementLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2, textTransform: 'uppercase' },
  measurementValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.7, lineHeight: 27, marginTop: 2 },
  measurementUnit: { fontSize: 10, fontWeight: '700', lineHeight: 14 },
  measurementDate: { fontSize: 10, lineHeight: 14, marginTop: 'auto' },
  alertCard: { alignItems: 'center', borderLeftWidth: 4, borderRadius: 14, flexDirection: 'row', gap: 10, minHeight: 67, padding: 12 },
  alertCopy: { flex: 1, gap: 1 },
  alertTitle: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  alertMessage: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  pressed: { opacity: 0.76 },
});
