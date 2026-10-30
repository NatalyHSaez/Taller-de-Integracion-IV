import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandColors, Colors, MeasurementColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Measurement } from '@/types/measurement';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type MeasurementPresentation = {
  icon: IconName;
  label: string;
  value: string;
  unit: string;
  supportingText?: string;
  spokenValue: string;
  spokenSupportingText?: string;
};

function formatDecimal(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

function getPresentation(measurement: Measurement): MeasurementPresentation {
  switch (measurement.type) {
    case 'heart_rate':
      return { icon: 'heart-outline', label: 'Frecuencia cardíaca', value: String(measurement.value),
        unit: 'lpm', spokenValue: `${measurement.value} latidos por minuto` };
    case 'single_pressure':
      return { icon: 'heart-pulse',
        label: measurement.parameter === 'SBP' ? 'Presión sistólica' : 'Presión diastólica',
        value: String(measurement.value), unit: 'mmHg',
        spokenValue: `${measurement.value} milímetros de mercurio` };
    case 'blood_pressure':
      return {
        icon: 'heart-pulse',
        label: 'Presión arterial',
        value: `${measurement.systolic} / ${measurement.diastolic}`,
        unit: 'mmHg',
        supportingText: measurement.heartRate == null ? undefined : `Frecuencia cardíaca: ${measurement.heartRate} lpm`,
        spokenValue: `${measurement.systolic} sobre ${measurement.diastolic} milímetros de mercurio`,
        spokenSupportingText: measurement.heartRate == null ? undefined : `Frecuencia cardíaca: ${measurement.heartRate} latidos por minuto`,
      };
    case 'glucose':
      return {
        icon: 'water-outline',
        label: 'Glucosa',
        value: String(measurement.value),
        unit: measurement.unit,
        spokenValue: `${measurement.value} miligramos por decilitro`,
      };
    case 'weight':
      return {
        icon: 'scale-bathroom',
        label: 'Peso',
        value: formatDecimal(measurement.value),
        unit: measurement.unit,
        spokenValue: `${formatDecimal(measurement.value)} kilogramos`,
      };
  }
}

function formatTime(measuredAt: string) {
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(measuredAt));
}

export function MeasurementCard({ measurement }: { measurement: Measurement }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const themeName = isDark ? 'dark' : 'light';
  const theme = Colors[themeName];
  const measurementColors = MeasurementColors[themeName][measurement.type];
  const presentation = getPresentation(measurement);
  const time = formatTime(measurement.measuredAt);
  const accessibilityLabel = [
    presentation.label,
    presentation.spokenValue,
    presentation.spokenSupportingText,
    `Hora ${time}`,
    measurement.recordedBy ? `Registrado por ${measurement.recordedBy}` : undefined,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}>
      {measurement.recordedBy && <ThemedText>Registrado por {measurement.recordedBy}</ThemedText>}
      {measurement.context && <ThemedText>{measurement.context}</ThemedText>}
      {measurement.readingStatus && (
        <ThemedText style={{ color: measurement.readingStatus === 'REQUIRES_CONFIRMATION'
          ? theme.danger : theme.icon }}>
          {measurement.readingStatus === 'REQUIRES_CONFIRMATION' ? 'Requiere confirmación' :
           measurement.readingStatus === 'PENDING' ? 'Evaluación pendiente' : 'Evaluada'}
        </ThemedText>
      )}
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <View
            style={[styles.iconContainer, { backgroundColor: measurementColors.background }]}> 
            <MaterialCommunityIcons name={presentation.icon} size={21} color={measurementColors.accent} />
          </View>
          <ThemedText style={styles.label}>{presentation.label}</ThemedText>
        </View>
        <ThemedText style={[styles.time, { color: theme.icon }]}>{time}</ThemedText>
      </View>

      <View style={styles.valueRow}>
        <ThemedText style={styles.value}>{presentation.value}</ThemedText>
        <ThemedText style={[styles.unit, { color: theme.icon }]}>{presentation.unit}</ThemedText>
      </View>

      {presentation.supportingText && (
        <ThemedText style={[styles.supportingText, { color: theme.icon }]}>
          {presentation.supportingText}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 15,
    shadowColor: BrandColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 9,
  },
  iconContainer: {
    alignItems: 'center',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  label: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  valueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  unit: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  supportingText: {
    fontSize: 15,
    lineHeight: 21,
  },
  time: {
    fontSize: 15,
    lineHeight: 21,
    marginLeft: 10,
  },
});
