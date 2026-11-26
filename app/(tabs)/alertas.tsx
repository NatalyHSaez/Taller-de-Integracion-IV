import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { AlertCard, AlertDetail, AlertsEmpty, AlertsHero, SECTION_TITLES } from '@/src/modules/evaluation/presentation/components/alerts-view';
import { ThemedText } from '@/src/shared/presentation/components/themed-text';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { Colors } from '@/src/shared/presentation/theme';
import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { useAuth } from '@/src/modules/identity/presentation/hooks/use-auth';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';
import { MOCK_ALERTS } from '@/src/modules/demo/infrastructure/mocks/api-data';
import { type AlertsService, type PatientAlert } from '@/src/modules/evaluation/domain/alert';
import { backendAlertsService, toPatientAlert } from '@/src/modules/evaluation/infrastructure/alerts-api';
import { createPatientAlerts } from '@/src/modules/evaluation/application/patient-alerts';

/**
 * Sesión de demostración (sin servidor): alertas de ejemplo del paciente
 * seleccionado. Las lecturas marcadas se recuerdan solo en memoria.
 */
const demoRead = new Set<string>();
const demoAlertsService: AlertsService = {
  async list(patientId, status) {
    return MOCK_ALERTS.filter((alert) => alert.patientId === patientId)
      .map((alert) => toPatientAlert({ ...alert, status: demoRead.has(alert.alertId) ? 'READ' : alert.status }))
      .filter((alert): alert is PatientAlert => alert !== null)
      .filter((alert) => !status || alert.status === status)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  async markRead(_patientId, alertId) {
    demoRead.add(alertId);
  },
};

export default function AlertasScreen() {
  const router = useRouter();
  const { selectedPatient, sessionMode } = useAppState();
  const { user: authUser } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const isBackend = sessionMode === 'backend';
  const patientId = isBackend
    ? authUser?.roles.includes('PATIENT')
      ? authUser.id
      : authUser?.roles.includes('CAREGIVER')
        ? (selectedPatient?.id ?? null)
        : null
    : (selectedPatient?.id ?? null);

  const alerts = useMemo(
    () => createPatientAlerts(isBackend ? backendAlertsService : demoAlertsService),
    [isBackend],
  );
  const state = useSyncExternalStore(alerts.subscribe, alerts.getState, alerts.getState);

  useEffect(() => {
    void alerts.setPatient(patientId);
  }, [alerts, patientId]);

  // Al volver a la pestaña se actualiza con lo que diga el backend.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void alerts.refresh();
    }, [alerts]),
  );

  const selected = state.selectedId ? alerts.selected() : null;
  const markError = state.markError;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={state.loaded ? state.items : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, (!state.loaded || state.items.length === 0) && styles.grow]}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => void alerts.refresh()}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <AlertsHero state={state} theme={theme} onFilter={(f) => void alerts.setFilter(f)} />
            {state.error && state.loaded && (
              <View
                accessibilityRole="alert"
                style={[styles.notice, { backgroundColor: theme.dangerBackground, borderColor: theme.dangerBorder }]}>
                <MaterialCommunityIcons name="cloud-alert-outline" size={20} color={theme.danger} />
                <ThemedText style={[styles.small, styles.noticeText, { color: theme.danger }]}>
                  No se pudo actualizar: {state.error.message}
                </ThemedText>
              </View>
            )}
            {markError && (
              <View
                accessibilityRole="alert"
                style={[styles.notice, { backgroundColor: theme.dangerBackground, borderColor: theme.dangerBorder }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.danger} />
                <ThemedText style={[styles.small, styles.noticeText, { color: theme.danger }]}>
                  {markError.message}
                </ThemedText>
                {markError.kind === 'network' && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Reintentar marcar como leída"
                    onPress={() => void alerts.markRead(markError.alertId)}>
                    <ThemedText style={[styles.small, styles.bold, { color: theme.primary }]}>Reintentar</ThemedText>
                  </Pressable>
                )}
              </View>
            )}
            {state.loaded && state.items.length > 0 && (
              <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
                {SECTION_TITLES[state.filter]}
              </ThemedText>
            )}
          </View>
        }
        ListEmptyComponent={<AlertsEmpty state={state} theme={theme} onRetry={() => void alerts.refresh()} />}
        renderItem={({ item }) => (
          <AlertCard
            alert={item}
            marking={state.marking.includes(item.id)}
            theme={theme}
            onMarkRead={(id) => void alerts.markRead(id)}
            onOpen={(id) => alerts.open(id)}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListFooterComponent={
          state.patientId ? (
            <View style={styles.disclaimer}>
              <MaterialCommunityIcons name="information-outline" size={16} color={theme.mutedText} />
              <ThemedText style={[styles.disclaimerText, { color: theme.mutedText }]}>
                Las alertas las genera el servicio de evaluación; no reemplazan la indicación de tu equipo de salud.
              </ThemedText>
            </View>
          ) : null
        }
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => alerts.close()}>
        <View style={styles.backdrop}>
          {selected && (
            <AlertDetail
              alert={selected}
              marking={state.marking.includes(selected.id)}
              theme={theme}
              onMarkRead={(id) => void alerts.markRead(id)}
              onOpenReading={(readingId) => {
                alerts.close();
                router.push({ pathname: '/lectura/[readingId]', params: { readingId } });
              }}
              onClose={() => alerts.close()}
            />
          )}
        </View>
      </Modal>
    </ThemedView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Mismos márgenes que Seguimiento.
  list: { paddingBottom: 32, paddingHorizontal: 16, paddingTop: 18 },
  grow: { flexGrow: 1 },
  header: { gap: 17, marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '700', lineHeight: 26, marginTop: 2 },
  separator: { height: 12 },
  small: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '700' },
  notice: { alignItems: 'center', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, padding: 12 },
  noticeText: { flex: 1 },
  disclaimer: { alignItems: 'flex-start', flexDirection: 'row', gap: 6, marginTop: 20, paddingHorizontal: 4 },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 17 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)', flex: 1, justifyContent: 'flex-end', padding: 12 },
});
