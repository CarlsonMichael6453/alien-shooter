import { Platform } from 'react-native';
import type { Kv } from './kv';

/** Web keeps settings in localStorage. Native uses AsyncStorage. */
export function createAppStore(): Kv {
  if (Platform.OS === 'web') {
    return {
      async getItem(key) {
        return window.localStorage.getItem(key);
      },
      async setItem(key, value) {
        window.localStorage.setItem(key, value);
      },
    };
  }
  return {
    async getItem(key) {
      const store = (await import('@react-native-async-storage/async-storage')).default;
      return store.getItem(key);
    },
    async setItem(key, value) {
      const store = (await import('@react-native-async-storage/async-storage')).default;
      await store.setItem(key, value);
    },
  };
}
