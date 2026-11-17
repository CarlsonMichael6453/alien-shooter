import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Alien Shooter',
  slug: 'alien-shooter',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  backgroundColor: '#070B14',
  userInterfaceStyle: 'dark',
  scheme: 'alien-shooter',
  ios: {
    supportsTablet: true,
    requireFullScreen: true,
    bundleIdentifier: 'com.carlsonmichael.alienshooter',
    backgroundColor: '#070B14',
  },
  android: {
    package: 'com.carlsonmichael.alienshooter',
    adaptiveIcon: {
      backgroundColor: '#07111F',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/favicon.png',
    backgroundColor: '#070B14',
    name: 'Alien Shooter',
    themeColor: '#070B14',
  },
  plugins: [
    ['expo-screen-orientation', { initialOrientation: 'PORTRAIT_UP' }],
    'expo-system-ui',
  ],
  experiments: {
    baseUrl: '/alien-shooter',
  },
};

export default config;
