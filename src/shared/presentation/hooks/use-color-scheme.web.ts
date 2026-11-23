import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

/** SSR utiliza light; el cliente recupera su tema al hidratarse. */
export function useColorScheme() {
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated);
  const colorScheme = useRNColorScheme();
  return hydrated ? colorScheme : 'light';
}
