import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

import { buildReportHtml } from './pdf-report-builder';
import type { Measurement } from '@/src/modules/monitoring/domain/measurement';
import type { AlertaItem } from '@/src/modules/demo/infrastructure/data/alerts-mock';

type GenerateOptions = {
  patientName: string;
  patientRut?: string;
  measurements: Measurement[];
  alerts: AlertaItem[];
};

export async function generateMeasurementsPdf(options: GenerateOptions): Promise<void> {
  const { patientName, patientRut, measurements, alerts } = options;

  if (measurements.length === 0) {
    Alert.alert('Sin datos', 'No hay mediciones registradas para generar el reporte.');
    return;
  }

  try {
    const html = buildReportHtml({
      patient: {
        name: patientName,
        rut: patientRut,
        role: 'patient',
      },
      measurements,
      alerts,
      generatedAt: new Date(),
    });

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Resumen de mediciones',
        UTI: 'com.adobe.pdf',
      });
    } else {
      // Fallback: abrir diálogo de impresión
      await Print.printAsync({ uri });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido';
    Alert.alert('Error', `No se pudo generar el PDF: ${message}`);
  }
}
