import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { documentFormat, documentTitle } from '@/src/modules/care/domain/clinical-document';
import { findDemoDocument } from '@/src/modules/care/infrastructure/demo-documents';
import {
  DocumentIcon,
  DocumentsEmpty,
  KIND_LABELS,
  KindPill,
  useDocumentsTheme,
} from '@/src/modules/care/presentation/components/documents-ui';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { BrandColors } from '@/src/shared/presentation/theme';

export default function DocumentoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useDocumentsTheme();
  const document = findDemoDocument(id);
  const back = () => router.replace('/documentos');

  if (!document) {
    return (
      <ThemedView style={styles.screen}>
        <View style={styles.content}>
          <DocumentsEmpty
            icon="file-question-outline"
            title="No encontramos este documento"
            text="Puede que ya no esté disponible. Vuelve a la lista para ver tus documentos."
            action={{ label: 'Volver a documentos', onPress: back }}
          />
        </View>
      </ThemedView>
    );
  }

  const format = documentFormat(document.fileName);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <DocumentIcon kind={document.kind} size={64} />
          <Text selectable style={[styles.title, { color: theme.text }]}>{documentTitle(document.fileName)}</Text>
          {documentTitle(document.fileName) !== KIND_LABELS[document.kind] && <KindPill kind={document.kind} />}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.rows}>
            <Row icon="file-outline" label="Archivo" value={document.fileName} />
            {!!format && <Row icon="file-pdf-box" label="Formato" value={format} />}
          </View>
        </View>

        <View style={[styles.viewer, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          <View style={[styles.viewerIcon, { backgroundColor: theme.primarySoft }]}>
            <MaterialCommunityIcons name="file-eye-outline" size={30} color={theme.primary} />
          </View>
          <Text style={[styles.viewerTitle, { color: theme.text }]}>Vista previa no disponible</Text>
          <Text style={[styles.viewerText, { color: theme.mutedText }]}>
            El visor de documentos estará disponible cuando el servidor entregue los archivos.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={back}
          style={({ pressed }) => [styles.button, { borderColor: theme.border, backgroundColor: theme.surface }, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="arrow-left" size={19} color={theme.primary} />
          <Text style={[styles.buttonText, { color: theme.primary }]}>Volver a documentos</Text>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

function Row({ icon, label, value }: { icon: 'file-outline' | 'file-pdf-box'; label: string; value: string }) {
  const { theme } = useDocumentsTheme();
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={18} color={theme.mutedText} />
      <Text style={[styles.rowLabel, { color: theme.mutedText }]}>{label}</Text>
      <Text selectable style={[styles.rowValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, padding: 16, paddingBottom: 32 },
  pressed: { opacity: 0.78 },
  card: {
    alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 10, padding: 20,
    shadowColor: BrandColors.shadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 2,
  },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 28, marginTop: 4, textAlign: 'center' },
  divider: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth, marginVertical: 6 },
  rows: { alignSelf: 'stretch', gap: 10 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  rowLabel: { fontSize: 14, width: 70 },
  rowValue: { flex: 1, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  viewer: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, gap: 6, minHeight: 220, justifyContent: 'center', padding: 24 },
  viewerIcon: { alignItems: 'center', borderRadius: 30, height: 60, justifyContent: 'center', marginBottom: 6, width: 60 },
  viewerTitle: { fontSize: 17, fontWeight: '700' },
  viewerText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  button: { alignItems: 'center', borderRadius: 12, borderWidth: 1.5, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 50 },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
