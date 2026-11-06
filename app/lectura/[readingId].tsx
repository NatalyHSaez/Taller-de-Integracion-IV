import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReadingConfirmationModal } from '@/components/readings/reading-confirmation';
import { ReadingDetailView } from '@/components/readings/reading-detail-view';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAppState } from '@/hooks/use-app-state';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getPatientReading } from '@/services/api';
import { createReadingDetail, parameterName, type ReadingDetail } from '@/services/reading-detail';
import { type ConfirmReadingError, confirmReadingErrorFrom, readingsService } from '@/services/readings';
import { describeRecordedBy, linkedPeopleLoader, type LinkedPeople } from '@/services/recorded-by';

/**
 * Sesión de demostración (sin servidor): la lectura sale de los datos locales.
 * Nunca se usa como respaldo de una sesión real.
 */
async function demoReading(patientId: string, readingId: string): Promise<ReadingDetail> {
  const local = await readingsService.detail(patientId, readingId);
  return {
    readingId: local.readingId,
    patientId: local.patientId,
    measuredAt: local.measuredAt,
    status: 'EVALUATED',
    confirmationReasons: [],
    context: local.context,
    source: local.source,
    recordedBy: local.recordedByUserId,
    evaluation: null,
    measurements: local.measurements.map((measurement) => ({
      measurementId: measurement.measurementId,
      parameterCode: measurement.parameterCode,
      value: measurement.valueNumeric ?? 0,
      unit: measurement.unit,
      confirmedByUser: measurement.confirmedByUser,
    })),
  };
}

export default function ReadingDetailScreen() {
  const router = useRouter();
  const { readingId: rawReadingId } = useLocalSearchParams<{ readingId: string | string[] }>();
  const readingId = (Array.isArray(rawReadingId) ? rawReadingId[0] : rawReadingId) ?? null;
  const { selectedPatient, sessionMode } = useAppState();
  const { user: authUser } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const isBackend = sessionMode === 'backend';
  // patientId activo: el propio paciente o el elegido por el cuidador.
  const patientId = isBackend
    ? authUser?.roles.includes('PATIENT')
      ? authUser.id
      : authUser?.roles.includes('CAREGIVER')
        ? (selectedPatient?.id ?? null)
        : null
    : (selectedPatient?.id ?? null);

  const detail = useMemo(
    () => createReadingDetail(isBackend ? getPatientReading : demoReading),
    [isBackend],
  );
  const state = useSyncExternalStore(detail.subscribe, detail.getState, detail.getState);

  useEffect(() => {
    void detail.open(patientId, readingId);
  }, [detail, patientId, readingId]);

  // Al salir de la pantalla se detienen las consultas automáticas.
  useEffect(() => () => detail.dispose(), [detail]);

  const [confirming, setConfirming] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<ConfirmReadingError | null>(null);

  const reading = state.reading;

  // "Registrada por": el paciente resuelve los nombres con sus vínculos reales.
  const isPatientViewer = isBackend && Boolean(authUser?.roles.includes('PATIENT'));
  const [people, setPeople] = useState<{ patientId: string; value: LinkedPeople } | null>(null);
  const recordedById = reading?.recordedBy ?? null;
  useEffect(() => {
    if (!isPatientViewer || !patientId || !recordedById || recordedById === authUser?.id) return;
    let cancelled = false;
    linkedPeopleLoader
      .load(patientId)
      .then((value) => { if (!cancelled) setPeople({ patientId, value }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isPatientViewer, patientId, recordedById, authUser?.id]);
  const recordedByLabel = isBackend && reading && patientId
    ? describeRecordedBy({
        recordedBy: reading.recordedBy,
        patientId,
        patientName: selectedPatient?.name ?? null,
        viewer: authUser ? { id: authUser.id, fullName: authUser.fullName, isPatient: isPatientViewer } : null,
        people: people?.patientId === patientId ? people.value : null,
      })
    : null;
  const summary = reading
    ? reading.measurements
        .map((m) => `${parameterName(m.parameterCode)}: ${String(m.value).replace('.', ',')}${m.unit ? ` ${m.unit}` : ''}`)
        .join(' · ')
    : '';

  function goToHistory() {
    if (router.canGoBack()) router.back();
    else router.replace('/historial');
  }

  async function confirmReading() {
    if (!reading || confirmBusy) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await readingsService.confirm(reading.patientId, reading.readingId);
      setConfirming(false);
      await detail.refresh();
    } catch (cause) {
      setConfirmError(confirmReadingErrorFrom(cause));
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 36) }]}
        refreshControl={
          reading ? (
            <RefreshControl
              refreshing={state.refreshing}
              onRefresh={() => void detail.refresh()}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          ) : undefined
        }>
        <ReadingDetailView
          state={state}
          theme={theme}
          currentUserId={authUser?.id ?? null}
          recordedByLabel={recordedByLabel}
          onRefresh={() => void detail.refresh()}
          onConfirm={() => {
            setConfirmError(null);
            setConfirming(true);
          }}
          onGoToHistory={goToHistory}
        />
      </ScrollView>

      {confirming && reading && (
        <ReadingConfirmationModal
          visible
          reading={{
            patientId: reading.patientId,
            readingId: reading.readingId,
            status: reading.status,
            reasons: reading.confirmationReasons,
          }}
          summary={summary}
          busy={confirmBusy}
          error={confirmError}
          theme={theme}
          onConfirm={() => void confirmReading()}
          onCancel={() => setConfirming(false)}
          onRefresh={() => {
            setConfirming(false);
            void detail.refresh();
          }}
          onGoToHistory={goToHistory}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, padding: 16 },
});
