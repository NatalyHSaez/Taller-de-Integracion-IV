import type { Measurement } from '@/src/modules/monitoring/domain/measurement';
import type { AlertaItem, MedicationInfo } from './generate-pdf';
import type { PatientAlert } from '@/src/modules/evaluation/domain/alert';
import type { PatientCondition } from '@/src/modules/monitoring/domain/patient-condition';

type PatientInfo = {
  name: string;
  rut?: string;
  age?: number;
  role: string;
};

type ReportData = {
  patient: PatientInfo;
  measurements: Measurement[];
  alerts: AlertaItem[];
  realAlerts: PatientAlert[];
  conditions: PatientCondition[];
  medications: MedicationInfo[];
  generatedAt: Date;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(dateStr: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function getSeverityColor(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'ALERTA':
    case 'HIGH':
    case 'CRITICAL':
      return '#DC2626';
    case 'ADVERTENCIA':
    case 'MEDIUM':
    case 'WARNING':
      return '#D97706';
    case 'NORMAL':
    case 'LOW':
    case 'INFO':
      return '#059669';
    default:
      return '#6B7280';
  }
}

function getSeverityLabel(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'ALERTA':
    case 'HIGH':
    case 'CRITICAL':
      return '🔴 Alerta';
    case 'ADVERTENCIA':
    case 'MEDIUM':
    case 'WARNING':
      return '🟡 Advertencia';
    case 'NORMAL':
    case 'LOW':
    case 'INFO':
      return '🟢 Normal';
    default:
      return severity;
  }
}

function formatFrequency(hours: number): string {
  if (hours === 24) return 'Una vez al día';
  if (hours === 12) return 'Cada 12 horas';
  if (hours === 8) return 'Cada 8 horas';
  if (hours === 6) return 'Cada 6 horas';
  if (hours === 4) return 'Cada 4 horas';
  if (hours < 1) return `Cada ${Math.round(hours * 60)} minutos`;
  return `Cada ${hours} horas`;
}

function groupMeasurementsByType(measurements: Measurement[]) {
  const bp = measurements
    .filter((m): m is Extract<Measurement, { type: 'blood_pressure' }> => m.type === 'blood_pressure')
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

  const glucose = measurements
    .filter((m): m is Extract<Measurement, { type: 'glucose' }> => m.type === 'glucose')
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

  const weight = measurements
    .filter((m): m is Extract<Measurement, { type: 'weight' }> => m.type === 'weight')
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

  return { bp, glucose, weight };
}

function buildSvgChart(
  data: { label: string; value: number }[],
  color: string,
  unit: string,
  title: string,
  secondaryData?: { label: string; value: number }[],
  secondaryColor?: string,
): string {
  if (data.length === 0) return '';

  const width = 500;
  const height = 180;
  const padL = 50;
  const padR = 20;
  const padT = 10;
  const padB = 40;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const allValues = [...data.map((d) => d.value), ...(secondaryData?.map((d) => d.value) ?? [])];
  const minV = Math.floor(Math.min(...allValues) * 0.9);
  const maxV = Math.ceil(Math.max(...allValues) * 1.1);
  const range = maxV - minV || 1;

  const toX = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * chartW;
  const toY = (v: number) => padT + chartH - ((v - minV) / range) * chartH;

  // Build polyline points
  const points = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');
  const secondaryPoints = secondaryData
    ? secondaryData.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ')
    : '';

  // Grid lines (3 horizontal)
  const gridLines = [0, 0.5, 1]
    .map((f) => {
      const y = padT + chartH * (1 - f);
      const val = Math.round(minV + range * f);
      return `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="#E5E7EB" stroke-width="1"/>
              <text x="${padL - 8}" y="${y + 4}" text-anchor="end" fill="#9CA3AF" font-size="10">${val}</text>`;
    })
    .join('');

  // X-axis labels (show up to 6)
  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((d, _, arr) => {
      const idx = data.indexOf(d);
      return `<text x="${toX(idx)}" y="${height - 5}" text-anchor="middle" fill="#9CA3AF" font-size="9" transform="rotate(-25,${toX(idx)},${height - 5})">${d.label}</text>`;
    })
    .join('');

  // Data dots
  const dots = data
    .map(
      (d, i) =>
        `<circle cx="${toX(i)}" cy="${toY(d.value)}" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>`,
    )
    .join('');

  const secondaryDots = secondaryData
    ? secondaryData
        .map(
          (d, i) =>
            `<circle cx="${toX(i)}" cy="${toY(d.value)}" r="3" fill="${secondaryColor}" stroke="white" stroke-width="1.5"/>`,
        )
        .join('')
    : '';

  return `
    <div style="margin-bottom:16px;">
      <p style="font-size:13px;font-weight:600;color:#374151;margin:0 0 6px 0;">${title} (${unit})</p>
      <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;">
        ${gridLines}
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
        ${secondaryPoints ? `<polyline points="${secondaryPoints}" fill="none" stroke="${secondaryColor}" stroke-width="2" stroke-linejoin="round" stroke-dasharray="5,3"/>` : ''}
        ${dots}
        ${secondaryDots}
        ${xLabels}
      </svg>
      ${secondaryData ? `<p style="font-size:10px;color:#9CA3AF;margin:4px 0 0 0;">— Línea sólida: sistólica &nbsp; - - Línea punteada: diastólica</p>` : ''}
    </div>`;
}

function buildMeasurementTable(
  title: string,
  headers: string[],
  rows: string[][],
  color: string,
): string {
  if (rows.length === 0) return '';

  const headerCells = headers.map((h) => `<th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;border-bottom:2px solid ${color};">${h}</th>`).join('');
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td style="padding:7px 12px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;">${cell}</td>`).join('')}</tr>`,
    )
    .join('');

  return `
    <div style="margin-bottom:20px;">
      <h3 style="font-size:14px;color:${color};margin:0 0 8px 0;font-weight:600;">${title}</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;">
        <thead><tr style="background:#F9FAFB;">${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
}

/* ------------------------------------------------------------------ */
/*  Sección de condiciones de salud                                    */
/* ------------------------------------------------------------------ */
function buildConditionsSection(conditions: PatientCondition[]): string {
  if (conditions.length === 0) return '';

  const items = conditions
    .map((c) => {
      const statusColor = c.status === 'ACTIVE' ? '#DC2626' : '#059669';
      const statusLabel = c.status === 'ACTIVE' ? 'Activa' : c.status;
      const since = c.startedAt ? ` · Desde ${formatShortDate(c.startedAt)}` : '';
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid #F3F4F6;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};flex-shrink:0;"></span>
          <div>
            <p style="font-size:12px;font-weight:600;color:#1F2937;margin:0;">${c.name}</p>
            <p style="font-size:10px;color:#6B7280;margin:2px 0 0 0;">Código: ${c.conditionCode} · Estado: ${statusLabel}${since}</p>
          </div>
        </div>`;
    })
    .join('');

  return `
    <div style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#1E3A5F;border-bottom:2px solid #E5E7EB;padding-bottom:6px;margin:24px 0 12px 0;">🏥 Condiciones de salud</h2>
      <div style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
        ${items}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/*  Sección de medicamentos                                            */
/* ------------------------------------------------------------------ */
function buildMedicationsSection(medications: MedicationInfo[]): string {
  if (medications.length === 0) return '';

  const headerCells = ['Medicamento', 'Dosis', 'Frecuencia']
    .map((h) => `<th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;border-bottom:2px solid #0EA5E9;">${h}</th>`)
    .join('');

  const rows = medications
    .map(
      (m) => `
      <tr>
        <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#1F2937;border-bottom:1px solid #F3F4F6;">💊 ${m.name}</td>
        <td style="padding:8px 12px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;">${m.dose}</td>
        <td style="padding:8px 12px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;">${formatFrequency(m.frequencyHours)}</td>
      </tr>`,
    )
    .join('');

  return `
    <div style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#1E3A5F;border-bottom:2px solid #E5E7EB;padding-bottom:6px;margin:24px 0 12px 0;">💊 Medicamentos</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;">
        <thead><tr style="background:#F0F9FF;">${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ------------------------------------------------------------------ */
/*  Sección de alertas reales del backend                              */
/* ------------------------------------------------------------------ */
function buildRealAlertsSection(realAlerts: PatientAlert[]): string {
  const open = realAlerts.filter((a) => a.status === 'OPEN');
  if (open.length === 0) return '';

  const items = open
    .map((a) => {
      const color = getSeverityColor(a.severity);
      const label = getSeverityLabel(a.severity);
      const date = formatShortDate(a.createdAt);
      return `
        <div style="border-left:4px solid ${color};background:#FAFAFA;border-radius:6px;padding:10px 14px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:600;color:${color};">${label}</span>
            <span style="font-size:10px;color:#9CA3AF;">${date}</span>
          </div>
          <p style="font-size:11px;color:#374151;margin:0;">${a.explanation}</p>
          <p style="font-size:9px;color:#D1D5DB;margin:4px 0 0 0;">Código: ${a.ruleCode}</p>
        </div>`;
    })
    .join('');

  return `
    <div style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#1E3A5F;border-bottom:2px solid #E5E7EB;padding-bottom:6px;margin:24px 0 12px 0;">🚨 Alertas clínicas abiertas (${open.length})</h2>
      ${items}
    </div>`;
}

export function buildReportHtml(data: ReportData): string {
  const { patient, measurements, alerts, realAlerts, conditions, medications, generatedAt } = data;
  const { bp, glucose, weight } = groupMeasurementsByType(measurements);

  // --- Conditions section ---
  const conditionsSection = buildConditionsSection(conditions);

  // --- Medications section ---
  const medicationsSection = buildMedicationsSection(medications);

  // --- Charts ---
  const bpChart =
    bp.length > 1
      ? buildSvgChart(
          bp.map((m) => ({ label: formatShortDate(m.measuredAt), value: m.systolic })),
          '#3B82F6',
          'mmHg',
          'Presión arterial',
          bp.map((m) => ({ label: formatShortDate(m.measuredAt), value: m.diastolic })),
          '#93C5FD',
        )
      : '';

  const glucoseChart =
    glucose.length > 1
      ? buildSvgChart(
          glucose.map((m) => ({ label: formatShortDate(m.measuredAt), value: m.value })),
          '#8B5CF6',
          'mg/dL',
          'Glucosa en sangre',
        )
      : '';

  const weightChart =
    weight.length > 1
      ? buildSvgChart(
          weight.map((m) => ({ label: formatShortDate(m.measuredAt), value: m.value })),
          '#10B981',
          'kg',
          'Peso corporal',
        )
      : '';

  const chartsSection =
    bpChart || glucoseChart || weightChart
      ? `<div style="page-break-inside:avoid;">
           <h2 style="font-size:16px;color:#1E3A5F;border-bottom:2px solid #E5E7EB;padding-bottom:6px;margin:24px 0 12px 0;">📈 Evolución de mediciones</h2>
           ${bpChart}${glucoseChart}${weightChart}
         </div>`
      : '';

  // --- Tables ---
  const bpTable = buildMeasurementTable(
    '❤️ Presión arterial',
    ['Fecha', 'Sistólica', 'Diastólica', 'Pulso'],
    bp.map((m) => [
      formatShortDate(m.measuredAt),
      `${m.systolic} mmHg`,
      `${m.diastolic} mmHg`,
      `${m.heartRate} lpm`,
    ]),
    '#3B82F6',
  );

  const glucoseTable = buildMeasurementTable(
    '💧 Glucosa',
    ['Fecha', 'Valor'],
    glucose.map((m) => [formatShortDate(m.measuredAt), `${m.value} ${m.unit}`]),
    '#8B5CF6',
  );

  const weightTable = buildMeasurementTable(
    '⚖️ Peso',
    ['Fecha', 'Valor'],
    weight.map((m) => [formatShortDate(m.measuredAt), `${m.value} ${m.unit}`]),
    '#10B981',
  );

  const tablesSection =
    bpTable || glucoseTable || weightTable
      ? `<div style="page-break-inside:avoid;">
           <h2 style="font-size:16px;color:#1E3A5F;border-bottom:2px solid #E5E7EB;padding-bottom:6px;margin:24px 0 12px 0;">📋 Detalle de mediciones</h2>
           ${bpTable}${glucoseTable}${weightTable}
         </div>`
      : '<p style="color:#9CA3AF;font-style:italic;">No hay mediciones registradas.</p>';

  // --- Stats summary ---
  const stats: string[] = [];
  if (bp.length > 0) {
    const avgSys = Math.round(bp.reduce((s, m) => s + m.systolic, 0) / bp.length);
    const avgDia = Math.round(bp.reduce((s, m) => s + m.diastolic, 0) / bp.length);
    const avgHr = Math.round(bp.reduce((s, m) => s + m.heartRate, 0) / bp.length);
    stats.push(`
      <div style="flex:1;min-width:140px;background:#EFF6FF;border-radius:10px;padding:12px;text-align:center;">
        <p style="font-size:10px;color:#6B7280;margin:0;">Presión promedio</p>
        <p style="font-size:20px;font-weight:700;color:#3B82F6;margin:4px 0 0 0;">${avgSys}/${avgDia}</p>
        <p style="font-size:10px;color:#9CA3AF;margin:2px 0 0 0;">mmHg · FC ${avgHr} lpm</p>
      </div>`);
  }
  if (glucose.length > 0) {
    const avgGluc = Math.round(glucose.reduce((s, m) => s + m.value, 0) / glucose.length);
    stats.push(`
      <div style="flex:1;min-width:140px;background:#F5F3FF;border-radius:10px;padding:12px;text-align:center;">
        <p style="font-size:10px;color:#6B7280;margin:0;">Glucosa promedio</p>
        <p style="font-size:20px;font-weight:700;color:#8B5CF6;margin:4px 0 0 0;">${avgGluc}</p>
        <p style="font-size:10px;color:#9CA3AF;margin:2px 0 0 0;">mg/dL</p>
      </div>`);
  }
  if (weight.length > 0) {
    const latest = weight[weight.length - 1].value;
    const first = weight[0].value;
    const diff = latest - first;
    const sign = diff > 0 ? '+' : '';
    stats.push(`
      <div style="flex:1;min-width:140px;background:#ECFDF5;border-radius:10px;padding:12px;text-align:center;">
        <p style="font-size:10px;color:#6B7280;margin:0;">Peso actual</p>
        <p style="font-size:20px;font-weight:700;color:#10B981;margin:4px 0 0 0;">${latest}</p>
        <p style="font-size:10px;color:#9CA3AF;margin:2px 0 0 0;">kg (${sign}${diff.toFixed(1)})</p>
      </div>`);
  }

  const statsSection =
    stats.length > 0
      ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin:16px 0;">${stats.join('')}</div>`
      : '';

  // --- Legacy demo alerts ---
  const significantAlerts = alerts.filter(
    (a) => a.severidad.toUpperCase() !== 'NORMAL',
  );
  const legacyAlertsSection =
    significantAlerts.length > 0
      ? `<div style="page-break-inside:avoid;">
           <h2 style="font-size:16px;color:#1E3A5F;border-bottom:2px solid #E5E7EB;padding-bottom:6px;margin:24px 0 12px 0;">⚠️ Alertas significativas</h2>
           ${significantAlerts
             .map(
               (a) => `
             <div style="border-left:4px solid ${getSeverityColor(a.severidad)};background:#FAFAFA;border-radius:6px;padding:10px 14px;margin-bottom:8px;">
               <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                 <span style="font-size:12px;font-weight:600;color:${getSeverityColor(a.severidad)};">${getSeverityLabel(a.severidad)} — ${a.parametro}</span>
                 <span style="font-size:10px;color:#9CA3AF;">${a.fecha}</span>
               </div>
               <p style="font-size:11px;color:#374151;margin:0;">${a.mensaje}</p>
               ${a.comparacion ? `<p style="font-size:10px;color:#6B7280;margin:4px 0 0 0;">${a.comparacion}</p>` : ''}
             </div>`,
             )
             .join('')}
         </div>`
      : '';

  // --- Real alerts from backend ---
  const realAlertsSection = buildRealAlertsSection(realAlerts);

  // Combined alert count for header
  const totalAlertCount = significantAlerts.length + realAlerts.filter((a) => a.status === 'OPEN').length;

  // --- Full HTML ---
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Informe Clínico — ${patient.name}</title>
  <style>
    @page { margin: 20mm 15mm; size: A4; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1F2937; margin: 0; padding: 0; font-size: 12px; line-height: 1.5; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1E3A5F,#2563EB);color:white;padding:24px 28px;border-radius:0 0 16px 16px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <h1 style="margin:0;font-size:22px;font-weight:700;">Informe Clínico del Paciente</h1>
        <p style="margin:4px 0 0 0;font-size:12px;opacity:0.85;">Reporte integral generado por Domicilia</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:11px;opacity:0.75;">Generado el</p>
        <p style="margin:2px 0 0 0;font-size:13px;font-weight:600;">${formatDate(generatedAt)}</p>
      </div>
    </div>
  </div>

  <div style="padding:20px 28px;">
    <!-- Patient info -->
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
      <h2 style="font-size:14px;color:#1E3A5F;margin:0 0 8px 0;">👤 Datos del paciente</h2>
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        <div>
          <p style="font-size:10px;color:#6B7280;margin:0;">Nombre</p>
          <p style="font-size:13px;font-weight:600;color:#1F2937;margin:2px 0 0 0;">${patient.name}</p>
        </div>
        ${patient.rut ? `<div><p style="font-size:10px;color:#6B7280;margin:0;">RUT</p><p style="font-size:13px;font-weight:600;color:#1F2937;margin:2px 0 0 0;">${patient.rut}</p></div>` : ''}
        ${patient.age ? `<div><p style="font-size:10px;color:#6B7280;margin:0;">Edad</p><p style="font-size:13px;font-weight:600;color:#1F2937;margin:2px 0 0 0;">${patient.age} años</p></div>` : ''}
        <div>
          <p style="font-size:10px;color:#6B7280;margin:0;">Total de registros</p>
          <p style="font-size:13px;font-weight:600;color:#1F2937;margin:2px 0 0 0;">${measurements.length}</p>
        </div>
        <div>
          <p style="font-size:10px;color:#6B7280;margin:0;">Alertas activas</p>
          <p style="font-size:13px;font-weight:600;color:${totalAlertCount > 0 ? '#DC2626' : '#059669'};margin:2px 0 0 0;">${totalAlertCount}</p>
        </div>
        <div>
          <p style="font-size:10px;color:#6B7280;margin:0;">Medicamentos</p>
          <p style="font-size:13px;font-weight:600;color:#0EA5E9;margin:2px 0 0 0;">${medications.length}</p>
        </div>
      </div>
    </div>

    <!-- Conditions -->
    ${conditionsSection}

    <!-- Medications -->
    ${medicationsSection}

    <!-- Stats -->
    ${statsSection}

    <!-- Charts -->
    ${chartsSection}

    <!-- Tables -->
    ${tablesSection}

    <!-- Real alerts -->
    ${realAlertsSection}

    <!-- Legacy alerts -->
    ${legacyAlertsSection}

    <!-- Footer -->
    <div style="margin-top:32px;padding-top:12px;border-top:1px solid #E5E7EB;text-align:center;">
      <p style="font-size:9px;color:#D1D5DB;margin:0;">
        Este documento es un informe clínico informativo generado automáticamente por la aplicación Domicilia.
        No reemplaza una evaluación médica profesional. Fecha de generación: ${formatDate(generatedAt)}.
      </p>
    </div>
  </div>
</body>
</html>`;
}
