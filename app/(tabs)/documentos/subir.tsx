import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useDocumentsTheme } from '@/src/modules/care/presentation/components/documents-ui';
import { ThemedView } from '@/src/shared/presentation/components/themed-view';
import { BrandColors, StatusColors } from '@/src/shared/presentation/theme';

type SelectedFile = {
  name: string;
  type: 'camera' | 'gallery';
};

export default function SubirDocumentoScreen() {
  const router = useRouter();
  const { theme } = useDocumentsTheme();

  const [titulo, setTitulo] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState<'prescription' | 'exam_order' | 'other'>('other');
  const [archivo, setArchivo] = useState<SelectedFile | null>(null);

  const tiposDocumento = [
    { value: 'prescription' as const, label: 'Receta médica', icon: 'pill' as const },
    { value: 'exam_order' as const, label: 'Orden de exámenes', icon: 'clipboard-pulse-outline' as const },
    { value: 'other' as const, label: 'Otro documento', icon: 'file-document-outline' as const },
  ];

  const handleSelectCamera = () => {
    // Solo visual: simular selección de cámara
    setArchivo({ name: 'foto_documento.jpg', type: 'camera' });
  };

  const handleSelectGallery = () => {
    // Solo visual: simular selección de galería
    setArchivo({ name: 'documento_seleccionado.pdf', type: 'gallery' });
  };

  const handleSubmit = () => {
    Alert.alert(
      'Funcionalidad no disponible',
      'La subida de documentos requiere que el servicio de almacenamiento (SeaweedFS/MinIO) esté configurado en el backend.\n\nEl endpoint POST /api/v1/patients/{id}/documents aún no está implementado.',
      [{ text: 'Entendido' }],
    );
  };

  const isFormValid = titulo.trim().length > 0 && archivo !== null;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Aviso de no disponible */}
        <View style={[styles.warningBanner, { backgroundColor: StatusColors.warning.background }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={StatusColors.warning.foreground} />
          <View style={styles.warningTextContainer}>
            <Text style={[styles.warningTitle, { color: StatusColors.warning.foreground }]}>
              Funcionalidad en desarrollo
            </Text>
            <Text style={[styles.warningText, { color: StatusColors.warning.foreground }]}>
              La subida de documentos aún no está disponible. El backend requiere configurar el servicio de almacenamiento de objetos.
            </Text>
          </View>
        </View>

        {/* Tipo de documento */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Tipo de documento</Text>
          <View style={styles.tiposContainer}>
            {tiposDocumento.map((tipo) => {
              const active = tipoDocumento === tipo.value;
              return (
                <Pressable
                  key={tipo.value}
                  onPress={() => setTipoDocumento(tipo.value)}
                  style={({ pressed }) => [
                    styles.tipoChip,
                    {
                      backgroundColor: active ? theme.primarySoft : theme.surface,
                      borderColor: active ? theme.primary : theme.border,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <MaterialCommunityIcons
                    name={tipo.icon}
                    size={18}
                    color={active ? theme.primary : theme.mutedText}
                  />
                  <Text
                    style={[
                      styles.tipoLabel,
                      { color: active ? theme.primary : theme.text },
                      active && styles.tipoLabelActive,
                    ]}>
                    {tipo.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Título */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Título del documento</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Ej: Receta paracetamol 500mg"
            placeholderTextColor={theme.mutedText}
            value={titulo}
            onChangeText={setTitulo}
            maxLength={100}
          />
          <Text style={[styles.charCount, { color: theme.mutedText }]}>
            {titulo.length}/100 caracteres
          </Text>
        </View>

        {/* Selección de archivo */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Archivo</Text>

          {archivo ? (
            <View style={[styles.filePreview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.fileIconBox, { backgroundColor: theme.primarySoft }]}>
                <MaterialCommunityIcons
                  name={archivo.type === 'camera' ? 'camera' : 'image'}
                  size={24}
                  color={theme.primary}
                />
              </View>
              <View style={styles.fileInfo}>
                <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                  {archivo.name}
                </Text>
                <Text style={[styles.fileSource, { color: theme.mutedText }]}>
                  {archivo.type === 'camera' ? 'Tomada con cámara' : 'Seleccionada de galería'}
                </Text>
              </View>
              <Pressable
                onPress={() => setArchivo(null)}
                style={({ pressed }) => [styles.removeFile, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="close-circle" size={24} color={StatusColors.error.foreground} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.fileButtons}>
              <Pressable
                onPress={handleSelectCamera}
                style={({ pressed }) => [
                  styles.fileButton,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.fileButtonIcon, { backgroundColor: theme.primarySoft }]}>
                  <MaterialCommunityIcons name="camera" size={28} color={theme.primary} />
                </View>
                <Text style={[styles.fileButtonTitle, { color: theme.text }]}>Cámara</Text>
                <Text style={[styles.fileButtonSubtitle, { color: theme.mutedText }]}>
                  Tomar foto del documento
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSelectGallery}
                style={({ pressed }) => [
                  styles.fileButton,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.fileButtonIcon, { backgroundColor: theme.primarySoft }]}>
                  <MaterialCommunityIcons name="image-multiple" size={28} color={theme.primary} />
                </View>
                <Text style={[styles.fileButtonTitle, { color: theme.text }]}>Galería</Text>
                <Text style={[styles.fileButtonSubtitle, { color: theme.mutedText }]}>
                  Seleccionar desde el dispositivo
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Vista previa del documento */}
        {archivo && (
          <View style={[styles.preview, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <Text style={[styles.previewLabel, { color: theme.mutedText }]}>VISTA PREVIA</Text>
            <View style={[styles.previewPlaceholder, { borderColor: theme.border }]}>
              <MaterialCommunityIcons name="file-eye-outline" size={40} color={theme.mutedText} />
              <Text style={[styles.previewText, { color: theme.mutedText }]}>
                Vista previa no disponible
              </Text>
            </View>
          </View>
        )}

        {/* Botón de subir */}
        <Pressable
          onPress={handleSubmit}
          disabled={!isFormValid}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: isFormValid ? BrandColors.primary : theme.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <MaterialCommunityIcons
            name="cloud-upload-outline"
            size={22}
            color={isFormValid ? BrandColors.onPrimary : theme.mutedText}
          />
          <Text
            style={[
              styles.submitText,
              { color: isFormValid ? BrandColors.onPrimary : theme.mutedText },
            ]}>
            Subir documento
          </Text>
        </Pressable>

        {/* Nota informativa */}
        <View style={[styles.infoBox, { backgroundColor: StatusColors.info.background }]}>
          <MaterialCommunityIcons name="information-outline" size={18} color={StatusColors.info.foreground} />
          <Text style={[styles.infoText, { color: StatusColors.info.foreground }]}>
            Solo profesionales médicos pueden subir documentos clínicos. Los documentos quedan asociados al paciente seleccionado.
          </Text>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 20, padding: 16, paddingBottom: 40 },
  pressed: { opacity: 0.78 },

  warningBanner: { borderRadius: 14, flexDirection: 'row', gap: 10, padding: 14 },
  warningTextContainer: { flex: 1, gap: 4 },
  warningTitle: { fontSize: 15, fontWeight: '700' },
  warningText: { fontSize: 13, lineHeight: 19 },

  section: { gap: 10 },
  label: { fontSize: 16, fontWeight: '700' },

  tiposContainer: { gap: 8 },
  tipoChip: {
    alignItems: 'center', borderRadius: 12, borderWidth: 1.5, flexDirection: 'row', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  tipoLabel: { fontSize: 15 },
  tipoLabelActive: { fontWeight: '700' },

  input: {
    borderRadius: 12, borderWidth: 1.5, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12,
  },
  charCount: { fontSize: 12, textAlign: 'right' },

  fileButtons: { flexDirection: 'row', gap: 12 },
  fileButton: {
    alignItems: 'center', borderRadius: 14, borderWidth: 1.5, flex: 1, gap: 8, paddingHorizontal: 12,
    paddingVertical: 18,
  },
  fileButtonIcon: { alignItems: 'center', borderRadius: 22, height: 52, justifyContent: 'center', width: 52 },
  fileButtonTitle: { fontSize: 15, fontWeight: '700' },
  fileButtonSubtitle: { fontSize: 12, lineHeight: 16, textAlign: 'center' },

  filePreview: {
    alignItems: 'center', borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', gap: 12, padding: 14,
  },
  fileIconBox: { alignItems: 'center', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  fileInfo: { flex: 1, gap: 2 },
  fileName: { fontSize: 15, fontWeight: '600' },
  fileSource: { fontSize: 13 },
  removeFile: { padding: 4 },

  preview: { borderRadius: 14, gap: 10, padding: 14 },
  previewLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  previewPlaceholder: {
    alignItems: 'center', borderRadius: 10, borderStyle: 'dashed', borderWidth: 1.5, gap: 8,
    justifyContent: 'center', minHeight: 140, padding: 20,
  },
  previewText: { fontSize: 14 },

  submitButton: {
    alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 10, justifyContent: 'center',
    minHeight: 52, paddingHorizontal: 20,
  },
  submitText: { fontSize: 17, fontWeight: '700' },

  infoBox: { borderRadius: 12, flexDirection: 'row', gap: 8, padding: 12 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
