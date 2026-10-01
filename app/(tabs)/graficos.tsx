import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BrandColors,
  Colors,
  MeasurementColors,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDemo } from '@/hooks/use-demo';
import type { MeasurementType } from '@/types/measurement';

type GraphType = MeasurementType;

type GraphOption = {
  value: GraphType;
  label: string;
  icon: 'heart-pulse' | 'water-outline' | 'scale-bathroom';
};

const GRAPH_OPTIONS: GraphOption[] = [
  {
    value: 'blood_pressure',
    label: 'Presión',
    icon: 'heart-pulse',
  },
  {
    value: 'glucose',
    label: 'Glucosa',
    icon: 'water-outline',
  },
  {
    value: 'weight',
    label: 'Peso',
    icon: 'scale-bathroom',
  },
];

function formatDate(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function formatFullDate(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export default function GraficosScreen() {
  const { measurements } = useDemo();

  const [graphType, setGraphType] =
    useState<GraphType>('blood_pressure');

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const themeName = isDark ? 'dark' : 'light';
  const theme = Colors[themeName];

  const insets = useSafeAreaInsets();

  const selectedColors =
    MeasurementColors[themeName][graphType];

  /*
   * Ordenamos las mediciones cronológicamente.
   */
  const sortedMeasurements = useMemo(() => {
    return [...measurements].sort(
      (a, b) =>
        new Date(a.measuredAt).getTime() -
        new Date(b.measuredAt).getTime(),
    );
  }, [measurements]);

  /*
   * PRESIÓN ARTERIAL
   */
  const bloodPressureData = useMemo(() => {
    return sortedMeasurements.filter(
      (measurement) =>
        measurement.type === 'blood_pressure',
    );
  }, [sortedMeasurements]);

  const systolicData = useMemo(
    () =>
      bloodPressureData.map((measurement) => ({
        value: measurement.systolic,
        label: formatDate(measurement.measuredAt),
        measuredAt: measurement.measuredAt,
      })),
    [bloodPressureData],
  );

  const diastolicData = useMemo(
    () =>
      bloodPressureData.map((measurement) => ({
        value: measurement.diastolic,
        label: formatDate(measurement.measuredAt),
        measuredAt: measurement.measuredAt,
      })),
    [bloodPressureData],
  );

  /*
   * GLUCOSA
   */
  const glucoseMeasurements = useMemo(() => {
    return sortedMeasurements.filter(
      (measurement) => measurement.type === 'glucose',
    );
  }, [sortedMeasurements]);

  const glucoseData = useMemo(
    () =>
      glucoseMeasurements.map((measurement) => ({
        value: measurement.value,
        label: formatDate(measurement.measuredAt),
        measuredAt: measurement.measuredAt,
        context: measurement.context,
      })),
    [glucoseMeasurements],
  );

  /*
   * PESO
   */
  const weightMeasurements = useMemo(() => {
    return sortedMeasurements.filter(
      (measurement) => measurement.type === 'weight',
    );
  }, [sortedMeasurements]);

  const weightData = useMemo(
    () =>
      weightMeasurements.map((measurement) => ({
        value: measurement.value,
        label: formatDate(measurement.measuredAt),
        measuredAt: measurement.measuredAt,
      })),
    [weightMeasurements],
  );

  const hasData =
    graphType === 'blood_pressure'
      ? bloodPressureData.length > 0
      : graphType === 'glucose'
        ? glucoseMeasurements.length > 0
        : weightMeasurements.length > 0;

  /*
   * Última medición.
   */
  const latestMeasurement = useMemo(() => {
    const filtered = measurements
      .filter(
        (measurement) =>
          measurement.type === graphType,
      )
      .sort(
        (a, b) =>
          new Date(b.measuredAt).getTime() -
          new Date(a.measuredAt).getTime(),
      );

    return filtered[0];
  }, [measurements, graphType]);

  function getLatestValue() {
    if (!latestMeasurement) {
      return 'Sin datos';
    }

    if (
      latestMeasurement.type === 'blood_pressure'
    ) {
      return `${latestMeasurement.systolic}/${latestMeasurement.diastolic}`;
    }

    if (latestMeasurement.type === 'glucose') {
      return `${latestMeasurement.value}`;
    }

    return latestMeasurement.value.toFixed(1);
  }

  function getUnit() {
    if (graphType === 'blood_pressure') {
      return 'mmHg';
    }

    if (graphType === 'glucose') {
      return 'mg/dL';
    }

    return 'kg';
  }

  function renderChart() {
    if (!hasData) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="chart-line"
            size={46}
            color={theme.icon}
          />

          <ThemedText style={styles.emptyTitle}>
            Aún no hay datos
          </ThemedText>

          <ThemedText
            style={[
              styles.emptyDescription,
              { color: theme.icon },
            ]}
          >
            Registra mediciones para visualizar su evolución.
          </ThemedText>
        </View>
      );
    }

    /*
     * =====================================================
     * PRESIÓN ARTERIAL
     * =====================================================
     */
    if (graphType === 'blood_pressure') {
      return (
        <View>
          <LineChart
            data={systolicData}
            data2={diastolicData}

            color1="#E53935"
            color2="#1E88E5"

            thickness={3}

            dataPointsColor1="#E53935"
            dataPointsColor2="#1E88E5"
            dataPointsRadius={5}

            curved

            areaChart

            startFillColor1="#E53935"
            endFillColor1="#E53935"
            startOpacity1={0.18}
            endOpacity1={0.01}

            startFillColor2="#1E88E5"
            endFillColor2="#1E88E5"
            startOpacity2={0.14}
            endOpacity2={0.01}

            hideRules={false}
            rulesColor={theme.border}

            xAxisColor={theme.border}
            yAxisColor={theme.border}

            yAxisTextStyle={{
              color: theme.icon,
            }}

            xAxisLabelTextStyle={{
              color: theme.icon,
              fontSize: 11,
            }}

            width={Math.max(
              Dimensions.get('window').width - 105,
              systolicData.length * 65,
            )}

            spacing={65}
            initialSpacing={15}
            endSpacing={20}

            noOfSections={5}

            pointerConfig={{
              pointer1Color: '#E53935',
              pointer2Color: '#1E88E5',

              radius: 6,

              pointerStripWidth: 2,
              pointerStripColor: theme.border,
              pointerStripUptoDataPoint: false,

              showPointerStrip: true,

              activatePointersOnLongPress: false,
              activatePointersInstantlyOnTouch: true,

              persistPointer: true,

              pointerLabelWidth: 165,
              pointerLabelHeight: 115,

              autoAdjustPointerLabelPosition: true,

              pointerLabelComponent: (
                items: any[],
              ) => {
                const systolicItem = items?.[0];
                const diastolicItem = items?.[1];

                if (!systolicItem) {
                  return null;
                }

                return (
                  <View
                    style={[
                      styles.pointerCard,
                      {
                        backgroundColor:
                          theme.surface,
                        borderColor:
                          theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      style={styles.pointerDate}
                    >
                      {formatFullDate(
                        systolicItem.measuredAt,
                      )}
                    </ThemedText>

                    <ThemedText
                      style={[
                        styles.pointerTime,
                        { color: theme.icon },
                      ]}
                    >
                      {formatTime(
                        systolicItem.measuredAt,
                      )}
                    </ThemedText>

                    <View style={styles.pointerValues}>
                      <View
                        style={styles.pointerValueRow}
                      >
                        <View
                          style={[
                            styles.pointerDot,
                            {
                              backgroundColor:
                                '#E53935',
                            },
                          ]}
                        />

                        <ThemedText
                          style={styles.pointerValue}
                        >
                          Sistólica:{' '}
                          {systolicItem.value} mmHg
                        </ThemedText>
                      </View>

                      <View
                        style={styles.pointerValueRow}
                      >
                        <View
                          style={[
                            styles.pointerDot,
                            {
                              backgroundColor:
                                '#1E88E5',
                            },
                          ]}
                        />

                        <ThemedText
                          style={styles.pointerValue}
                        >
                          Diastólica:{' '}
                          {diastolicItem?.value ?? '-'} mmHg
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                );
              },
            }}

            isAnimated
            animationDuration={700}
          />

          {/* LEYENDA SOLO PARA PRESIÓN */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor: '#E53935',
                  },
                ]}
              />

              <ThemedText style={styles.legendText}>
                Sistólica
              </ThemedText>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor: '#1E88E5',
                  },
                ]}
              />

              <ThemedText style={styles.legendText}>
                Diastólica
              </ThemedText>
            </View>
          </View>
        </View>
      );
    }

    /*
     * =====================================================
     * GLUCOSA
     * =====================================================
     */
    if (graphType === 'glucose') {
      return (
        <View>
          <LineChart
            data={glucoseData}

            color={selectedColors.accent}

            thickness={3}

            dataPointsColor={selectedColors.accent}
            dataPointsRadius={5}

            curved

            areaChart

            startFillColor={selectedColors.accent}
            endFillColor={selectedColors.accent}
            startOpacity={0.2}
            endOpacity={0.01}

            hideRules={false}
            rulesColor={theme.border}

            xAxisColor={theme.border}
            yAxisColor={theme.border}

            yAxisTextStyle={{
              color: theme.icon,
            }}

            xAxisLabelTextStyle={{
              color: theme.icon,
              fontSize: 11,
            }}

            width={Math.max(
              Dimensions.get('window').width - 105,
              glucoseData.length * 65,
            )}

            spacing={65}
            initialSpacing={15}
            endSpacing={20}

            noOfSections={5}

            pointerConfig={{
              pointerColor:
                selectedColors.accent,

              radius: 6,

              pointerStripWidth: 2,
              pointerStripColor:
                theme.border,
              pointerStripUptoDataPoint:
                false,

              showPointerStrip: true,

              activatePointersOnLongPress:
                false,

              activatePointersInstantlyOnTouch:
                true,

              persistPointer: true,

              pointerLabelWidth: 165,
              pointerLabelHeight: 115,

              autoAdjustPointerLabelPosition:
                true,

              pointerLabelComponent: (
                items: any[],
              ) => {
                const item = items?.[0];

                if (!item) {
                  return null;
                }

                return (
                  <View
                    style={[
                      styles.pointerCard,
                      {
                        backgroundColor:
                          theme.surface,
                        borderColor:
                          theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      style={styles.pointerDate}
                    >
                      {formatFullDate(
                        item.measuredAt,
                      )}
                    </ThemedText>

                    <ThemedText
                      style={[
                        styles.pointerTime,
                        {
                          color: theme.icon,
                        },
                      ]}
                    >
                      {formatTime(
                        item.measuredAt,
                      )}
                    </ThemedText>

                    <View
                      style={styles.pointerValues}
                    >
                      <View
                        style={
                          styles.pointerValueRow
                        }
                      >
                        <View
                          style={[
                            styles.pointerDot,
                            {
                              backgroundColor:
                                selectedColors.accent,
                            },
                          ]}
                        />

                        <ThemedText
                          style={
                            styles.pointerValue
                          }
                        >
                          {item.value} mg/dL
                        </ThemedText>
                      </View>

                      {!!item.context && (
                        <ThemedText
                          style={[
                            styles.pointerContext,
                            {
                              color:
                                theme.icon,
                            },
                          ]}
                        >
                          {item.context}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                );
              },
            }}

            isAnimated
            animationDuration={700}
          />
        </View>
      );
    }

    /*
     * =====================================================
     * PESO
     * =====================================================
     */
    return (
      <View>
        <LineChart
          data={weightData}

          color={selectedColors.accent}

          thickness={3}

          dataPointsColor={
            selectedColors.accent
          }

          dataPointsRadius={5}

          curved

          areaChart

          startFillColor={
            selectedColors.accent
          }

          endFillColor={
            selectedColors.accent
          }

          startOpacity={0.2}
          endOpacity={0.01}

          hideRules={false}
          rulesColor={theme.border}

          xAxisColor={theme.border}
          yAxisColor={theme.border}

          yAxisTextStyle={{
            color: theme.icon,
          }}

          xAxisLabelTextStyle={{
            color: theme.icon,
            fontSize: 11,
          }}

          width={Math.max(
            Dimensions.get('window').width - 105,
            weightData.length * 65,
          )}

          spacing={65}
          initialSpacing={15}
          endSpacing={20}

          noOfSections={5}

          pointerConfig={{
            pointerColor:
              selectedColors.accent,

            radius: 6,

            pointerStripWidth: 2,
            pointerStripColor:
              theme.border,

            pointerStripUptoDataPoint:
              false,

            showPointerStrip: true,

            activatePointersOnLongPress:
              false,

            activatePointersInstantlyOnTouch:
              true,

            persistPointer: true,

            pointerLabelWidth: 155,
            pointerLabelHeight: 100,

            autoAdjustPointerLabelPosition:
              true,

            pointerLabelComponent: (
              items: any[],
            ) => {
              const item = items?.[0];

              if (!item) {
                return null;
              }

              return (
                <View
                  style={[
                    styles.pointerCard,
                    {
                      backgroundColor:
                        theme.surface,
                      borderColor:
                        theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.pointerDate}
                  >
                    {formatFullDate(
                      item.measuredAt,
                    )}
                  </ThemedText>

                  <ThemedText
                    style={[
                      styles.pointerTime,
                      {
                        color: theme.icon,
                      },
                    ]}
                  >
                    {formatTime(
                      item.measuredAt,
                    )}
                  </ThemedText>

                  <View
                    style={styles.pointerValues}
                  >
                    <View
                      style={
                        styles.pointerValueRow
                      }
                    >
                      <View
                        style={[
                          styles.pointerDot,
                          {
                            backgroundColor:
                              selectedColors.accent,
                          },
                        ]}
                      />

                      <ThemedText
                        style={
                          styles.pointerValue
                        }
                      >
                        {Number(
                          item.value,
                        ).toFixed(1)}{' '}
                        kg
                      </ThemedText>
                    </View>
                  </View>
                </View>
              );
            },
          }}

          isAnimated
          animationDuration={700}
        />
      </View>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Math.max(
              insets.bottom + 24,
              36,
            ),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <ThemedText
            style={styles.topBarTitle}
          >
            Gráficos
          </ThemedText>
        </View>

        {/* ENCABEZADO */}
        <View style={styles.hero}>
          <View
            style={styles.heroDecorationTop}
          />

          <View
            style={
              styles.heroDecorationBottom
            }
          />

          <View style={styles.heroIcon}>
            <MaterialCommunityIcons
              name="chart-line"
              size={31}
              color={
                BrandColors.onPrimary
              }
            />
          </View>

          <ThemedText
            lightColor={
              BrandColors.onPrimary
            }
            darkColor={
              BrandColors.onPrimary
            }
            style={styles.heroTitle}
          >
            Evolución de tus mediciones
          </ThemedText>

          <ThemedText
            lightColor={
              BrandColors.onPrimaryMuted
            }
            darkColor={
              BrandColors.onPrimaryMuted
            }
            style={
              styles.heroDescription
            }
          >
            Visualiza cómo han cambiado tus
            registros a lo largo del tiempo.
          </ThemedText>
        </View>

        {/* SELECTOR */}
        <ThemedText
          accessibilityRole="header"
          style={styles.sectionTitle}
        >
          Tipo de medición
        </ThemedText>

        <View
          accessibilityRole="radiogroup"
          style={styles.typeRow}
        >
          {GRAPH_OPTIONS.map(
            (option) => {
              const isSelected =
                graphType ===
                option.value;

              const optionColors =
                MeasurementColors[
                  themeName
                ][option.value];

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked:
                      isSelected,
                  }}
                  accessibilityLabel={
                    option.label
                  }
                  onPress={() =>
                    setGraphType(
                      option.value,
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.typeCard,
                    {
                      backgroundColor:
                        theme.surface,

                      borderColor:
                        isSelected
                          ? optionColors.accent
                          : theme.border,
                    },

                    isSelected &&
                      styles.typeCardSelected,

                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.typeIcon,
                      {
                        backgroundColor:
                          optionColors.background,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        option.icon
                      }
                      size={24}
                      color={
                        optionColors.accent
                      }
                    />
                  </View>

                  <ThemedText
                    style={
                      styles.typeLabel
                    }
                  >
                    {option.label}
                  </ThemedText>

                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={18}
                      color={
                        optionColors.accent
                      }
                      style={
                        styles.checkIcon
                      }
                    />
                  )}
                </Pressable>
              );
            },
          )}
        </View>

        {/* ÚLTIMA MEDICIÓN */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor:
                theme.surface,

              borderColor:
                theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.summaryIcon,
              {
                backgroundColor:
                  selectedColors.background,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={
                graphType ===
                'blood_pressure'
                  ? 'heart-pulse'
                  : graphType ===
                      'glucose'
                    ? 'water-outline'
                    : 'scale-bathroom'
              }
              size={27}
              color={
                selectedColors.accent
              }
            />
          </View>

          <View>
            <ThemedText
              style={[
                styles.summaryLabel,
                {
                  color: theme.icon,
                },
              ]}
            >
              Última medición
            </ThemedText>

            <View
              style={styles.valueRow}
            >
              <ThemedText
                style={
                  styles.summaryValue
                }
              >
                {getLatestValue()}
              </ThemedText>

              {latestMeasurement && (
                <ThemedText
                  style={[
                    styles.summaryUnit,
                    {
                      color:
                        theme.icon,
                    },
                  ]}
                >
                  {getUnit()}
                </ThemedText>
              )}
            </View>

            {latestMeasurement && (
              <ThemedText
                style={[
                  styles.summaryDate,
                  {
                    color:
                      theme.icon,
                  },
                ]}
              >
                {new Intl.DateTimeFormat(
                  'es-CL',
                  {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  },
                ).format(
                  new Date(
                    latestMeasurement.measuredAt,
                  ),
                )}
              </ThemedText>
            )}
          </View>
        </View>

        {/* GRÁFICO */}
        <View
          style={styles.chartHeading}
        >
          <View>
            <ThemedText
              style={
                styles.sectionTitle
              }
            >
              Evolución
            </ThemedText>

            <ThemedText
              style={[
                styles.chartSubtitle,
                {
                  color: theme.icon,
                },
              ]}
            >
              Valores registrados en el tiempo
            </ThemedText>
          </View>
        </View>

        <View
          style={[
            styles.chartCard,
            {
              backgroundColor:
                theme.surface,

              borderColor:
                theme.border,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
          >
            {renderChart()}
          </ScrollView>
        </View>

        <View
          style={styles.infoNote}
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={19}
            color={theme.icon}
          />

          <ThemedText
            style={[
              styles.infoText,
              {
                color: theme.icon,
              },
            ]}
          >
            Los gráficos se actualizan con las
            mediciones registradas en la
            aplicación.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  content: {
    gap: 17,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
  },

  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },

  hero: {
    backgroundColor:
      BrandColors.primary,
    borderRadius: 22,
    minHeight: 188,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },

  heroDecorationTop: {
    backgroundColor:
      BrandColors.heroHighlight,
    borderRadius: 80,
    height: 160,
    opacity: 0.5,
    position: 'absolute',
    right: -52,
    top: -72,
    width: 160,
  },

  heroDecorationBottom: {
    backgroundColor:
      BrandColors.heroAccent,
    borderRadius: 65,
    bottom: -70,
    height: 130,
    left: -42,
    opacity: 0.3,
    position: 'absolute',
    width: 130,
  },

  heroIcon: {
    alignItems: 'center',
    backgroundColor:
      BrandColors.overlayStrong,
    borderColor:
      BrandColors.overlayBorderStrong,
    borderRadius: 13,
    borderWidth:
      StyleSheet.hairlineWidth,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },

  heroTitle: {
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
    marginTop: 13,
  },

  heroDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
    maxWidth: 310,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 25,
  },

  typeRow: {
    flexDirection: 'row',
    gap: 9,
  },

  typeCard: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    gap: 7,
    minHeight: 105,
    padding: 11,
    position: 'relative',
  },

  typeCardSelected: {
    shadowColor:
      BrandColors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },

  typeIcon: {
    alignItems: 'center',
    borderRadius: 11,
    height: 43,
    justifyContent: 'center',
    width: 43,
  },

  typeLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },

  checkIcon: {
    position: 'absolute',
    right: 6,
    top: 6,
  },

  summaryCard: {
    alignItems: 'center',
    borderRadius: 17,
    borderWidth:
      StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    padding: 17,

    shadowColor:
      BrandColors.shadow,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 1,
  },

  summaryIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },

  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },

  valueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
  },

  summaryValue: {
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 34,
  },

  summaryUnit: {
    fontSize: 14,
    fontWeight: '600',
  },

  summaryDate: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },

  chartHeading: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
  },

  chartSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },

  chartCard: {
    borderRadius: 17,

    borderWidth:
      StyleSheet.hairlineWidth,

    minHeight: 300,

    /*
     * Visible para evitar cortar
     * las tarjetas flotantes.
     */
    overflow: 'visible',

    paddingBottom: 14,
    paddingLeft: 5,
    paddingTop: 20,

    shadowColor:
      BrandColors.shadow,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 1,
  },

  /*
   * LEYENDA DE PRESIÓN
   */
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 24,
    justifyContent: 'center',
    marginTop: 16,
    paddingBottom: 4,
  },

  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  legendDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },

  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /*
   * TARJETA AL TOCAR UN PUNTO
   */
  pointerCard: {
    borderRadius: 12,

    borderWidth:
      StyleSheet.hairlineWidth,

    minWidth: 145,

    paddingHorizontal: 12,
    paddingVertical: 10,

    shadowColor:
      BrandColors.shadow,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    shadowOpacity: 0.15,
    shadowRadius: 7,

    elevation: 4,
  },

  pointerDate: {
    fontSize: 13,
    fontWeight: '800',
  },

  pointerTime: {
    fontSize: 11,
    marginTop: 1,
  },

  pointerContext: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  pointerValues: {
    gap: 5,
    marginTop: 7,
  },

  pointerValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  pointerDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },

  pointerValue: {
    fontSize: 13,
    fontWeight: '700',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 245,
    paddingHorizontal: 35,
    width:
      Dimensions.get('window').width -
      45,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },

  emptyDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
    textAlign: 'center',
  },

  infoNote: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },

  pressed: {
    opacity: 0.76,
  },
});