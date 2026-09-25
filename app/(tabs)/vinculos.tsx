import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandColors, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type LinkedPerson = {
  id: string;
  initials: string;
  name: string;
  role: 'Cuidador' | 'Cuidadora';
};

const INITIAL_LINKS: LinkedPerson[] = [
  {
    id: 'maria',
    initials: 'MR',
    name: 'María Rojas',
    role: 'Cuidadora',
  },
];

const SCANNED_LINK: LinkedPerson = {
  id: 'carlos',
  initials: 'CS',
  name: 'Carlos Soto',
  role: 'Cuidador',
};

export default function VinculosScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [scannerVisible, setScannerVisible] = useState(false);
  const [linkedPeople, setLinkedPeople] = useState(INITIAL_LINKS);

  const completeScan = () => {
    setLinkedPeople((current) =>
      current.some((person) => person.id === SCANNED_LINK.id)
        ? current
        : [...current, SCANNED_LINK]
    );
    setScannerVisible(false);
    Alert.alert('Vínculo creado', `${SCANNED_LINK.name} quedó enlazado como cuidador.`);
  };

  const confirmUnlink = (person: LinkedPerson) => {
    Alert.alert(
      'Desvincular persona',
      `¿Quieres quitar el acceso de ${person.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: () => setLinkedPeople((current) => current.filter((item) => item.id !== person.id)),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Volver al menú"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <MaterialCommunityIcons name="arrow-left" size={23} color={theme.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Vínculos</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.codeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.codeDecoration, { backgroundColor: theme.primarySoft }]} />
          <View style={[styles.codeIcon, { backgroundColor: theme.primarySoft }]}>
            <MaterialCommunityIcons name="account-heart-outline" size={28} color={theme.primary} />
          </View>
          <Text style={[styles.codeTitle, { color: theme.text }]}>Tu código de paciente</Text>
          <Text style={[styles.codeDescription, { color: theme.mutedText }]}>
            Muéstraselo a tu cuidador para vincularlo.
          </Text>

          <View style={[styles.qrContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="qrcode" size={112} color={theme.text} />
          </View>

          <View style={[styles.patientCode, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <Text style={[styles.patientCodeLabel, { color: theme.mutedText }]}>ID DE PACIENTE</Text>
            <Text style={[styles.patientCodeValue, { color: theme.text }]}>PAC-7290</Text>
          </View>

        </View>

        <Pressable
          accessibilityHint="Abre el lector para vincular a un cuidador"
          accessibilityRole="button"
          onPress={() => setScannerVisible(true)}
          style={({ pressed }) => [
            styles.scanButton,
            { backgroundColor: theme.primary },
            pressed && styles.pressed,
          ]}>
          <MaterialCommunityIcons name="qrcode-scan" size={24} color={theme.onPrimary} />
          <View style={styles.scanButtonCopy}>
            <Text style={[styles.scanButtonTitle, { color: theme.onPrimary }]}>Escanear código de cuidador</Text>
          </View>
          <MaterialCommunityIcons name="arrow-right" size={22} color={theme.onPrimary} />
        </Pressable>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Enlazados contigo</Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: theme.primarySoft }]}>
            <Text style={[styles.countText, { color: theme.primary }]}>{linkedPeople.length}</Text>
          </View>
        </View>

        {linkedPeople.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
              <MaterialCommunityIcons name="account-multiple-outline" size={30} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Aún no tienes personas enlazadas</Text>
            <Text style={[styles.emptyDescription, { color: theme.mutedText }]}>Escanea un código para agregar un cuidador.</Text>
          </View>
        ) : (
          <View style={styles.peopleList}>
            {linkedPeople.map((person) => (
              <View
                key={person.id}
                style={[styles.personCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>{person.initials}</Text>
                </View>
                <View style={styles.personCopy}>
                  <Text style={[styles.personName, { color: theme.text }]}>{person.name}</Text>
                  <Text style={[styles.role, { color: theme.mutedText }]}>{person.role}</Text>
                </View>
                <Pressable
                  accessibilityLabel={`Opciones para ${person.name}`}
                  accessibilityRole="button"
                  onPress={() => confirmUnlink(person)}
                  style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name="dots-vertical" size={23} color={theme.icon} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setScannerVisible(false)}
        presentationStyle="fullScreen"
        visible={scannerVisible}>
        <SafeAreaView style={[styles.scannerScreen, { backgroundColor: BrandColors.neutralShadow }]}>
          <View style={styles.scannerHeader}>
            <Pressable
              accessibilityLabel="Cerrar lector"
              accessibilityRole="button"
              onPress={() => setScannerVisible(false)}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <MaterialCommunityIcons name="close" size={24} color={BrandColors.onPrimary} />
            </Pressable>
            <Text style={styles.scannerTitle}>Escanear código</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.scannerContent}>
            <Text style={styles.scannerInstruction}>
              Centra el código QR del cuidador dentro del recuadro.
            </Text>

            <View style={styles.scannerFrame}>
              <View style={[styles.scannerCorner, styles.topLeft, { borderColor: theme.primary }]} />
              <View style={[styles.scannerCorner, styles.topRight, { borderColor: theme.primary }]} />
              <View style={[styles.scannerCorner, styles.bottomLeft, { borderColor: theme.primary }]} />
              <View style={[styles.scannerCorner, styles.bottomRight, { borderColor: theme.primary }]} />
              <View style={[styles.scanLine, { backgroundColor: theme.primary }]} />
              <MaterialCommunityIcons
                name="qrcode"
                size={116}
                color={BrandColors.overlayBorderStrong}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={completeScan}
              style={({ pressed }) => [
                styles.simulateButton,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}>
              <MaterialCommunityIcons name="check" size={21} color={theme.onPrimary} />
              <Text style={[styles.simulateButtonText, { color: theme.onPrimary }]}>Simular lectura correcta</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 12 },
  backButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCopy: { marginLeft: 12 },
  headerTitle: { fontSize: 21, fontWeight: '800', lineHeight: 26 },
  content: { paddingBottom: 36, paddingHorizontal: 16, paddingTop: 8 },
  codeCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
    shadowColor: BrandColors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 15,
    elevation: 3,
  },
  codeDecoration: {
    borderRadius: 80,
    height: 150,
    opacity: 0.75,
    position: 'absolute',
    right: -70,
    top: -75,
    width: 150,
  },
  codeIcon: { alignItems: 'center', borderRadius: 14, height: 50, justifyContent: 'center', width: 50 },
  codeTitle: { fontSize: 20, fontWeight: '800', lineHeight: 26, marginTop: 12 },
  codeDescription: { fontSize: 14, lineHeight: 20, marginTop: 5, maxWidth: 300, textAlign: 'center' },
  qrContainer: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 2,
    height: 148,
    justifyContent: 'center',
    marginTop: 18,
    width: 148,
  },
  patientCode: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  patientCodeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.1 },
  patientCodeValue: { fontSize: 15, fontWeight: '800', letterSpacing: 2, marginTop: 2 },
  scanButton: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    marginTop: 16,
    minHeight: 72,
    paddingHorizontal: 17,
    shadowColor: BrandColors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 11,
    elevation: 4,
  },
  scanButtonCopy: { flex: 1, marginHorizontal: 12 },
  scanButtonTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 11,
    marginTop: 28,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  countBadge: { alignItems: 'center', borderRadius: 12, height: 32, justifyContent: 'center', minWidth: 32 },
  countText: { fontSize: 13, fontWeight: '800' },
  peopleList: { gap: 10 },
  personCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 92,
    padding: 14,
  },
  avatar: { alignItems: 'center', borderRadius: 16, height: 50, justifyContent: 'center', width: 50 },
  avatarText: { fontSize: 15, fontWeight: '800' },
  personCopy: { flex: 1, marginLeft: 12 },
  personName: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  role: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  moreButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 38 },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
  },
  emptyIcon: { alignItems: 'center', borderRadius: 16, height: 54, justifyContent: 'center', width: 54 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  emptyDescription: { fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: 'center' },
  pressed: { opacity: 0.72 },
  scannerScreen: { flex: 1 },
  scannerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.overlay,
    borderColor: BrandColors.overlayBorder,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  scannerTitle: { color: BrandColors.onPrimary, fontSize: 17, fontWeight: '800' },
  headerSpacer: { width: 44 },
  scannerContent: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  scannerInstruction: {
    color: BrandColors.onPrimaryMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 34,
    maxWidth: 300,
    textAlign: 'center',
  },
  scannerFrame: { alignItems: 'center', height: 254, justifyContent: 'center', width: 254 },
  scannerCorner: { height: 45, position: 'absolute', width: 45 },
  topLeft: { borderLeftWidth: 4, borderTopLeftRadius: 12, borderTopWidth: 4, left: 0, top: 0 },
  topRight: { borderRightWidth: 4, borderTopRightRadius: 12, borderTopWidth: 4, right: 0, top: 0 },
  bottomLeft: { borderBottomLeftRadius: 12, borderBottomWidth: 4, borderLeftWidth: 4, bottom: 0, left: 0 },
  bottomRight: { borderBottomRightRadius: 12, borderBottomWidth: 4, borderRightWidth: 4, bottom: 0, right: 0 },
  scanLine: { height: 3, left: 16, position: 'absolute', right: 16, top: 126 },
  simulateButton: {
    alignItems: 'center',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 8,
    marginTop: 46,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  simulateButtonText: { fontSize: 14, fontWeight: '800' },
});
