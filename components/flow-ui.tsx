import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type ComponentProps, type PropsWithChildren } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandColors, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type FlowPageProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

export function FlowPage({ title, subtitle, children }: FlowPageProps) {
  const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View pointerEvents="none" style={[styles.decoration, { backgroundColor: theme.primarySoft }]} />

          <View style={styles.brand}>
            <MaterialCommunityIcons color={theme.primary} name="home-heart" size={27} />
            <Text style={[styles.brandName, { color: theme.primary }]}>Domicilia</Text>
          </View>

          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
              {title}
            </Text>
            {!!subtitle && <Text style={[styles.subtitle, { color: theme.mutedText }]}>{subtitle}</Text>}
          </View>

          <View style={styles.body}>{children}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Copy({ children }: PropsWithChildren) {
  const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  return (
    <Text selectable style={[styles.copy, { color: theme.text }]}>
      {children}
    </Text>
  );
}

export function Card({ children }: PropsWithChildren) {
  const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {children}
    </View>
  );
}

type ActionProps = {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
};

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type FieldProps = TextInputProps & {
  label: string;
  icon?: IconName;
  secureVisible?: boolean;
  onToggleSecure?: () => void;
};

export function Action({ label, onPress, secondary = false, disabled = false }: ActionProps) {
  const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: secondary ? theme.surface : theme.primary,
          borderColor: theme.primary,
          shadowColor: secondary ? 'transparent' : BrandColors.shadow,
        },
        (disabled || pressed) && styles.faded,
      ]}>
      <Text style={[styles.actionText, { color: secondary ? theme.primary : theme.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  icon,
  onBlur,
  onFocus,
  onToggleSecure,
  secureVisible = false,
  style,
  ...props
}: FieldProps) {
  const theme = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: focused ? theme.surface : theme.surfaceMuted,
            borderColor: focused ? theme.primary : theme.border,
          },
        ]}>
        {!!icon && <MaterialCommunityIcons color={theme.icon} name={icon} size={21} />}

        <TextInput
          {...props}
          accessibilityLabel={label}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={theme.placeholder}
          style={[styles.input, { color: theme.text }, style]}
        />

        {!!onToggleSecure && (
          <Pressable
            accessibilityLabel={secureVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onToggleSecure}
            style={styles.eyeButton}>
            <MaterialCommunityIcons
              color={secureVisible ? theme.primary : theme.icon}
              name={secureVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    elevation: 4,
    justifyContent: 'center',
    minHeight: 55,
    paddingHorizontal: 18,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  actionText: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  body: { gap: 16 },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 9, marginBottom: 28 },
  brandName: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  card: { borderRadius: 18, borderWidth: 1, gap: 12, padding: 18 },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 460,
    overflow: 'hidden',
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 26,
    width: '100%',
  },
  copy: { fontSize: 15, lineHeight: 22 },
  decoration: {
    borderRadius: 190,
    height: 280,
    left: -150,
    opacity: 0.5,
    position: 'absolute',
    top: -156,
    width: 280,
  },
  faded: { opacity: 0.65 },
  field: { gap: 7 },
  heading: { marginBottom: 32 },
  input: {
    flex: 1,
    fontSize: 16,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputShell: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 55,
    paddingLeft: 16,
    paddingRight: 8,
  },
  eyeButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  label: { fontSize: 14, fontWeight: '700', marginLeft: 3 },
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  subtitle: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  title: { fontSize: 31, fontWeight: '800', letterSpacing: -0.8, lineHeight: 37, marginBottom: 8 },
});
