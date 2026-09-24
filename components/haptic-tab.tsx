import * as Haptics from 'expo-haptics';
import { Pressable } from 'react-native';

export function HapticTab(props: any) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Vibración táctil suave al presionar en iOS
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}