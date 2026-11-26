import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

import { buildReportHtml } from './pdf-report-builder';
import type { Measurement } from '@/src/modules/monitoring/domain/measurement';
import type { PatientAlert } from '@/src/modules/evaluation/domain/alert';
import type { PatientCondition } from '@/src/modules/monitoring/domain/patient-condition';

/** Tipo de alerta para el reporte PDF (legado demo). */
export type AlertaItem = {
  id: string;
  severidad: string;
  parametro: string;
  mensaje: string;
  comparacion: string | null;
  fecha: string;
  leida: boolean;
};

export type MedicationInfo = {
  name: string;
  dose: string;
  frequencyHours: number;
};

type GenerateOptions = {
  patientName: string;
  patientRut?: string;
  patientAge?: number;
  measurements: Measurement[];
  alerts: AlertaItem[];
  realAlerts?: PatientAlert[];
  conditions?: PatientCondition[];
  medications?: MedicationInfo[];
};

/**
 * En web, expo-print simplemente llama window.print() sobre la pagina actual.
 * Para generar el informe real, creamos un iframe oculto con el HTML del reporte.
 */
function printHtmlOnWeb(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';

      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        reject(new Error('No se pudo acceder al iframe'));
        return;
      }

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (iframe.parentNode) document.body.removeChild(iframe);
            resolve();
          }, 1000);
        } catch (err) {
          if (iframe.parentNode) document.body.removeChild(iframe);
          reject(err);
        }
      }, 500);
    } catch (err) {
      reject(err);
    }
  });
}

export async function generateMeasurementsPdf(options: GenerateOptions): Promise<void> {
  const { patientName, patientRut, patientAge, measurements, alerts, realAlerts, conditions, medications } = options;

  if (measurements.length === 0) {
    Alert.alert('Sin datos', 'No hay mediciones registradas para generar el reporte.');
    return;
  }

  try {
    const html = buildReportHtml({
      patient: {
        name: patientName,
        rut: patientRut,
        age: patientAge,
        role: 'patient',
      },
      measurements,
      alerts,
      realAlerts: realAlerts ?? [],
      conditions: conditions ?? [],
      medications: medications ?? [],
      generatedAt: new Date(),
    });

    if (Platform.OS === 'web') {
      await printHtmlOnWeb(html);
      return;
    }

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Informe clinico del paciente',
        UTI: 'com.adobe.pdf',
      });
    } else {
      await Print.printAsync({ uri });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido';
    Alert.alert('Error', 'No se pudo generar el PDF: ' + message);
  }
}
