import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  documentFormat,
  documentTitle,
  type ClinicalDocument,
  type DocumentFilter,
  type DocumentKind,
} from '@/src/modules/care/domain/clinical-document';
import { useColorScheme } from '@/src/shared/presentation/hooks/use-color-scheme';
import { AccentColors, BrandColors, Colors, StatusColors } from '@/src/shared/presentation/theme';

/**
 * Piezas visuales de Documentos con el lenguaje de Seguimiento: cabecera azul
 * con filtros, tarjetas blancas con ícono en recuadro de color.
 */

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function useDocumentsTheme() {
  const dark = useColorScheme() === 'dark';
  return { theme: Colors[dark ? 'dark' : 'light'], accent: AccentColors[dark ? 'dark' : 'light'] };
}

export const KIND_LABELS: Record<DocumentKind, string> = {
  prescription: 'Receta médica',
  exam_order: 'Orden de exámenes',
  other: 'Documento',
};

const KIND_ICONS: Record<DocumentKind, IconName> = {
  prescription: 'pill',
  exam_order: 'clipboard-pulse-outline',
  other: 'file-document-outline',
};

export function useKindTone(kind: DocumentKind) {
  const { theme, accent } = useDocumentsTheme();
  if (kind === 'prescription') return { background: accent.purpleSoft, foreground: accent.purple };
  if (kind === 'exam_order') return { background: theme.primarySoft, foreground: theme.primary };
  return { background: StatusColors.neutral.background, foreground: StatusColors.neutral.foreground };
}

const FILTERS: { value: DocumentFilter; label: string; icon: IconName }[] = [
  { value: 'ALL', label: 'Todos', icon: 'folder-outline' },
  { value: 'prescription', label: 'Recetas', icon: 'pill' },
  { value: 'exam_order', label: 'Órdenes', icon: 'clipboard-pulse-outline' },
];

export function DocumentsHero({ filter, counts, onFilter }: {
  filter: DocumentFilter;
  counts: Record<DocumentFilter, number>;
  onFilter: (filter: DocumentFilter) => void;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroDecorationTop} />
      <View style={styles.heroDecorationBottom} />
      <View style={styles.heroTopRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>TU HISTORIAL CLÍNICO</Text>
          <Text accessibilityRole="header" style={styles.heroTitle}>Documentos</Text>
          <Text style={styles.heroSubtitle}>Recetas, órdenes de exámenes y archivos de tus consultas.</Text>
        </View>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="file-document-multiple-outline" size={30} color={BrandColors.onPrimary} />
        </View>
      </View>
      <View style={styles.filters} accessibilityRole="tablist">
        {FILTERS.map((item) => {
          const active = item.value === filter;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item.label}: ${counts[item.value]}`}
              onPress={() => onFilter(item.value)}
              style={({ pressed }) => [styles.filter, active && styles.filterActive, pressed && styles.pressed]}>
              <MaterialCommunityIcons name={item.icon} size={16} color={active ? BrandColors.primary : BrandColors.onPrimary} />
              <Text style={[styles.filterCount, active && styles.filterTextActive]}>{counts[item.value]}</Text>
              <Text style={[styles.filterLabel, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DocumentIcon({ kind, size = 50 }: { kind: DocumentKind; size?: number }) {
  const tone = useKindTone(kind);
  return (
    <View style={[styles.iconBox, { backgroundColor: tone.background, height: size, width: size, borderRadius: size * 0.24 }]}>
      <MaterialCommunityIcons name={KIND_ICONS[kind]} size={size * 0.52} color={tone.foreground} />
    </View>
  );
}

export function KindPill({ kind }: { kind: DocumentKind }) {
  const tone = useKindTone(kind);
  return (
    <View style={[styles.pill, { backgroundColor: tone.background }]}>
      <Text style={[styles.pillText, { color: tone.foreground }]}>{KIND_LABELS[kind]}</Text>
    </View>
  );
}

export function DocumentCard({ document, onOpen }: { document: ClinicalDocument; onOpen: () => void }) {
  const { theme } = useDocumentsTheme();
  const format = documentFormat(document.fileName);
  const title = documentTitle(document.fileName);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver documento ${title}`}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}>
      <DocumentIcon kind={document.kind} />
      <View style={styles.cardCopy}>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{title}</Text>
        <View style={styles.cardMeta}>
          {title !== KIND_LABELS[document.kind] && <KindPill kind={document.kind} />}
          {!!format && (
            <View style={[styles.formatTag, { borderColor: theme.border }]}>
              <Text style={[styles.formatText, { color: theme.mutedText }]}>{format}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.chevron, { backgroundColor: theme.primarySoft }]}>
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.primary} />
      </View>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const { theme } = useDocumentsTheme();
  return <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

export function InfoNotice({ text }: { text: string }) {
  return (
    <View style={[styles.notice, { backgroundColor: StatusColors.info.background }]}>
      <MaterialCommunityIcons name="information-outline" size={19} color={StatusColors.info.foreground} />
      <Text style={[styles.noticeText, { color: StatusColors.info.foreground }]}>{text}</Text>
    </View>
  );
}

export function DocumentsEmpty({ icon = 'folder-open-outline', title, text, action }: {
  icon?: IconName;
  title: string;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  const { theme } = useDocumentsTheme();
  return (
    <View style={[styles.empty, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
        <MaterialCommunityIcons name={icon} size={28} color={theme.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: theme.mutedText }]}>{text}</Text>
      {!!action && (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [styles.emptyButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <Text style={[styles.emptyButtonText, { color: theme.onPrimary }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.78 },
  hero: { backgroundColor: BrandColors.primary, borderRadius: 22, gap: 18, overflow: 'hidden', padding: 20, position: 'relative' },
  heroDecorationTop: {
    backgroundColor: BrandColors.heroHighlight, borderRadius: 80, height: 150, opacity: 0.5,
    position: 'absolute', right: -55, top: -65, width: 150,
  },
  heroDecorationBottom: {
    backgroundColor: BrandColors.heroAccent, borderRadius: 65, bottom: -70, height: 130, left: -45,
    opacity: 0.3, position: 'absolute', width: 130,
  },
  heroTopRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  eyebrow: { color: BrandColors.onPrimaryEyebrow, fontSize: 13, fontWeight: '700', letterSpacing: 0.7, lineHeight: 18 },
  heroTitle: { color: BrandColors.onPrimary, fontSize: 27, fontWeight: '800', lineHeight: 33, marginTop: 4 },
  heroSubtitle: { color: BrandColors.onPrimaryMuted, fontSize: 15, lineHeight: 21, marginTop: 4 },
  heroIcon: {
    alignItems: 'center', backgroundColor: BrandColors.overlay, borderColor: BrandColors.overlayBorder,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, height: 56, justifyContent: 'center', width: 56,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: {
    alignItems: 'center', backgroundColor: BrandColors.overlaySubtle, borderColor: BrandColors.overlay,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 5,
    paddingHorizontal: 11, paddingVertical: 8,
  },
  filterActive: { backgroundColor: BrandColors.onPrimary, borderColor: BrandColors.onPrimary },
  filterCount: { color: BrandColors.onPrimary, fontSize: 14, fontWeight: '800' },
  filterLabel: { color: BrandColors.onPrimary, fontSize: 14, fontWeight: '600' },
  filterTextActive: { color: BrandColors.primary },
  sectionTitle: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  iconBox: { alignItems: 'center', justifyContent: 'center' },
  card: {
    alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 14,
    padding: 14, shadowColor: BrandColors.shadow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1,
    shadowRadius: 12, elevation: 2,
  },
  cardCopy: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
  cardMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '700' },
  formatTag: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  formatText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  chevron: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  notice: { alignItems: 'flex-start', borderRadius: 12, flexDirection: 'row', gap: 8, padding: 12 },
  noticeText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  empty: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, gap: 6, padding: 22 },
  emptyIcon: { alignItems: 'center', borderRadius: 28, height: 56, justifyContent: 'center', marginBottom: 4, width: 56 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyButton: { borderRadius: 12, marginTop: 8, paddingHorizontal: 18, paddingVertical: 11 },
  emptyButtonText: { fontSize: 15, fontWeight: '700' },
});
