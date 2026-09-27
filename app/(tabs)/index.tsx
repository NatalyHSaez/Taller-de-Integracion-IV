import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getDemoAlerts } from '@/services/alerts';
import { BrandColors, Colors, MeasurementColors, StatusColors } from '@/constants/theme';
import { useDemo } from '@/hooks/use-demo';
import { Action } from '@/components/flow-ui';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Measurement, MeasurementType } from '@/types/measurement';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type MeasurementSummary = {
  type: MeasurementType;
  label: string;
  icon: IconName;
  value: string;
  unit?: string;
  recordedAt: string;
};

function getLatestMeasurement(type: MeasurementType, measurements: Measurement[]): Measurement | undefined {
  return measurements.filter((measurement) => measurement.type === type).sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
  )[0];
}

function getMeasurementSummary(type: MeasurementType, measurements: Measurement[]): MeasurementSummary | undefined {
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

export default function ResumenScreen() {
  const { user, measurements, permissions, relations } = useDemo();
  const pendingCount = relations.filter((r) => r.patientId === user?.patientId && r.status === 'pending').length;
  const router = useRouter();
  const colorScheme = useColorScheme();
  const themeName = colorScheme === 'dark' ? 'dark' : 'light';
  const theme = Colors[themeName];
  const measurementColors = MeasurementColors[themeName];
  const summaries = (['blood_pressure', 'glucose', 'weight'] as const)
    .map((type) => getMeasurementSummary(type, measurements))
    .filter((summary): summary is MeasurementSummary => Boolean(summary));
  const priorityAlert =
    permissions.alerts ? getDemoAlerts()[0] : undefined;

  const handleEmergencyPress = () => {
    Alert.alert(
      '¿Necesitas ayuda?',
      'Cuando los contactos de emergencia estén configurados, podrás avisarles desde aquí.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Entendido' },
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
            disabled={!permissions.write}
            accessibilityState={{ disabled: !permissions.write }}
            accessibilityRole="button"
            onPress={() => router.push('/registrar-medicion')}
            style={({ pressed }) => [styles.registerButton, !permissions.write && { opacity: 0.45 }, pressed && styles.pressed]}>
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

        {pendingCount > 0 && <Action label={`${pendingCount} solicitud(es) de cuidador · Revisar`} onPress={() => router.push('/vinculos')} />}
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
          <View style={[styles.emptyMeasurements, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
              <MaterialCommunityIcons color={theme.primary} name="heart-pulse" size={23} />
            </View>
            <View style={styles.emptyCopy}>
              <ThemedText style={styles.emptyTitle}>
                {permissions.read ? 'Aún no hay mediciones' : 'Mediciones no disponibles'}
              </ThemedText>
              <ThemedText style={[styles.emptyDescription, { color: theme.mutedText }]}>
                {permissions.read ? 'Registra la primera para verla aquí.' : 'El paciente aún no te ha dado acceso.'}
              </ThemedText>
            </View>
          </View>
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
          {permissions.write && <Pressable
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
