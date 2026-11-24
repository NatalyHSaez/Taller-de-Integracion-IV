import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/src/core/presentation/session/use-app-state';
import { useAuth } from '@/src/modules/identity/presentation/hooks/use-auth';
import {
  createReadingDetail,
  parameterName,
} from '@/src/modules/monitoring/application/reading-detail';
import {
  confirmReadingErrorFrom,
  readingsService,
  type ConfirmReadingError,
} from '@/src/modules/monitoring/application/readings';
import {
  describeRecordedBy,
  linkedPeopleLoader,
  type LinkedPeople,
} from '@/src/modules/monitoring/application/recorded-by';
import { getPatientReading } from '@/src/modules/monitoring/application/reading-query-port';
import { Colors } from '@/src/shared/presentation/theme';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';

import { ReadingDetailView, formatValue } from '../components/reading-detail-view';

export default function ReadingDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ readingId: string | string[] }>();
  const readingId = (Array.isArray(params.readingId) ? params.readingId[0] : params.readingId) ?? null;
  const { selectedPatient, permissions, sessionMode } = useAppState();
  const { user: authUser } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const isBackend = sessionMode === 'backend';
  const patientId = permissions.read ? (selectedPatient?.id ?? null) : null;
  const canConfirm = isBackend && permissions.write && permissions.read;

  const detail = useMemo(
    () => createReadingDetail(getPatientReading),
    [],
  );
  const state = useSyncExternalStore(detail.subscribe, detail.getState, detail.getState);

  useEffect(() => {
    void detail.open(patientId, readingId);
  }, [detail, patientId, readingId]);

  // Cancela el seguimiento automático cuando se abandona la pantalla.
  useEffect(() => () => detail.dispose(), [detail]);

  // Impide mostrar datos de otro paciente/lectura durante un cambio de sesión o navegación.
  const matchesScope = state.patientId === patientId && state.readingId === readingId;
  const reading = matchesScope && permissions.read && sessionMode ? state.reading : null;
  const visibleLoading = !matchesScope && !!patientId && !!readingId;
  const detailError = matchesScope ? state.error : null;

  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<ConfirmReadingError | null>(null);
  const targetKey = `${patientId ?? '-'}:${readingId ?? '-'}`;
  const confirmationOpen =
    confirmTarget === targetKey &&
    !!reading &&
    reading.status === 'REQUIRES_CONFIRMATION' &&
    canConfirm;

  const isPatientViewer = isBackend && Boolean(authUser?.roles.includes('PATIENT'));
  const [people, setPeople] = useState<{ patientId: string; value: LinkedPeople } | null>(null);
  const recordedById = reading?.recordedBy ?? null;

  useEffect(() => {
    if (!isPatientViewer || !patientId || !recordedById || recordedById === authUser?.id) return;
    let cancelled = false;
    linkedPeopleLoader.load(patientId)
      .then((value) => { if (!cancelled) setPeople({ patientId, value }); })
      .catch(() => { /* Sin vínculo disponible: mostrar información genérica. */ });
    return () => { cancelled = true; };
  }, [isPatientViewer, patientId, recordedById, authUser?.id]);

  const recordedByLabel = reading && patientId && isBackend
    ? describeRecordedBy({
        recordedBy: reading.recordedBy,
        patientId,
        patientName: selectedPatient?.name ?? null,
        viewer: authUser
          ? { id: authUser.id, fullName: authUser.fullName, isPatient: isPatientViewer }
          : null,
        people: people?.patientId === patientId ? people.value : null,
      })
    : reading?.recordedBy ?? null;

  const summary = reading
    ? reading.measurements
        .map((measurement) => `${parameterName(measurement.parameterCode)}: ${formatValue(measurement)}`)
        .join(' · ')
    : '';

  function goToHistory() {
    if (router.canGoBack()) router.back();
    else router.replace('/historial');
  }

  async function confirmReading() {
    if (!reading || !patientId || !readingId || !canConfirm || confirmBusy || reading.status !== 'REQUIRES_CONFIRMATION') return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await readingsService.confirm(patientId, readingId);
      setConfirmTarget(null);
      await detail.refresh();
    } catch (cause) {
      setConfirmError(confirmReadingErrorFrom(cause));
    } finally {
      setConfirmBusy(false);
    }
  }

  return <ReadingDetailView
    state={state} theme={theme} reading={reading}
    loading={visibleLoading || (matchesScope && state.loading && !reading)}
    detailError={detailError} isBackend={isBackend} canRead={permissions.read}
    canConfirm={canConfirm} patientId={patientId} readingId={readingId}
    patientName={selectedPatient?.name} recordedByLabel={recordedByLabel}
    bottomInset={insets.bottom} confirmationOpen={confirmationOpen}
    summary={summary} confirmBusy={confirmBusy} confirmError={confirmError}
    onRefresh={() => void detail.refresh()}
    onOpenConfirmation={() => { setConfirmError(null); setConfirmTarget(targetKey); }}
    onConfirm={() => void confirmReading()}
    onCancelConfirmation={() => { if (!confirmBusy) setConfirmTarget(null); }}
    onRefreshConfirmation={() => { setConfirmTarget(null); void detail.refresh(); }}
    onGoToHistory={goToHistory}
  />;
}
