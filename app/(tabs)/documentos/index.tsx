import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  countByKind,
  filterDocuments,
  type DocumentFilter,
} from '@/src/modules/care/domain/clinical-document';
import { DEMO_DOCUMENTS } from '@/src/modules/care/infrastructure/demo-documents';
import {
  DocumentCard,
  DocumentsEmpty,
  DocumentsHero,
  InfoNotice,
  SectionTitle,
} from '@/src/modules/care/presentation/components/documents-ui';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { BrandColors } from '@/src/shared/presentation/theme';

const SECTION_TITLES: Record<DocumentFilter, string> = {
  ALL: 'Todos tus documentos',
  prescription: 'Recetas médicas',
  exam_order: 'Órdenes de exámenes',
  other: 'Otros documentos',
};

export default function DocumentosScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<DocumentFilter>('ALL');
  const counts = countByKind(DEMO_DOCUMENTS);
  const visible = filterDocuments(DEMO_DOCUMENTS, filter);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <DocumentsHero filter={filter} counts={counts} onFilter={setFilter} />
            <InfoNotice text="Vista previa con documentos de ejemplo. Los documentos de tus consultas aparecerán aquí cuando el servicio de Atención los publique." />
            <SectionTitle>{SECTION_TITLES[filter]}</SectionTitle>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <DocumentsEmpty
            title="No hay documentos en esta categoría"
            text="Cuando tu médico agregue uno, lo verás aquí."
            action={filter === 'ALL' ? undefined : { label: 'Ver todos', onPress: () => setFilter('ALL') }}
          />
        }
        renderItem={({ item }) => (
          <DocumentCard document={item} onOpen={() => router.push(`/documentos/${item.id}`)} />
        )}
      />

      {/* FAB — Subir documento (visible para profesionales) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Subir documento"
        onPress={() => router.push('/documentos/subir')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
        <MaterialCommunityIcons name="plus" size={26} color={BrandColors.onPrimary} />
        <Text style={styles.fabLabel}>Subir</Text>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 90, paddingHorizontal: 16, paddingTop: 18 },
  header: { gap: 16, marginBottom: 12 },
  separator: { height: 12 },
  fab: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 28,
    bottom: 24,
    elevation: 6,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    position: 'absolute',
    right: 20,
    shadowColor: BrandColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  fabLabel: { color: BrandColors.onPrimary, fontSize: 15, fontWeight: '700' },
});
