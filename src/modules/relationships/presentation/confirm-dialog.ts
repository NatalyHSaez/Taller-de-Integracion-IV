import { Alert as NativeAlert, Platform, type AlertButton } from 'react-native';

/**
 * Alert que también funciona en la web. En react-native-web Alert.alert no
 * muestra nada; aquí se usa el diálogo del navegador (confirm/alert).
 * En el celular es el Alert nativo, sin cambios.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: Parameters<typeof NativeAlert.alert>[3]) {
    if (Platform.OS !== 'web') {
      NativeAlert.alert(title, message, buttons, options);
      return;
    }
    const text = message ? `${title}\n\n${message}` : title;
    const list = buttons ?? [];
    if (list.length >= 2) {
      const cancel = list.find((button) => button.style === 'cancel');
      const action = list.find((button) => button !== cancel) ?? list[list.length - 1];
      const accepted = typeof window !== 'undefined' && typeof window.confirm === 'function' && window.confirm(text);
      (accepted ? action : cancel)?.onPress?.();
      return;
    }
    if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(text);
    list[0]?.onPress?.();
  },
};

/** Confirmación como promesa: true solo si se elige la acción. Cancelar o cerrar: false. */
export function confirmAction(input: { title: string; message: string; confirmLabel: string }): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      input.title,
      input.message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: input.confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
