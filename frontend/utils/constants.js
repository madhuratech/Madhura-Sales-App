import { Platform } from 'react-native';
import Constants from 'expo-constants';

const ANDROID_EMULATOR_HOST = '10.0.2.2';
const IOS_SIMULATOR_HOST = '127.0.0.1';

const resolveExpoHost = () => {
  const hostFromDebug =
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.debuggerHost ||
    Constants.expoConfig?.hostUri ||
    Constants.expoConfig?.packagerOpts?.host ||
    Constants.manifest?.packagerOpts?.host;
  return hostFromDebug?.split(':')[0];
};

const WEB_HOST = (typeof window !== 'undefined' && window.location) ? window.location.hostname : null;
const HOST_FROM_DEBUGGER = resolveExpoHost();
const LOCAL_HOST = 'localhost'; // Updated to work locally without Wi-Fi issues

const PRODUCTION_API_URL = 'https://madhura-sales-app-p8zp.onrender.com/api';
const PRODUCTION_SOCKET_URL = 'https://madhura-sales-app-p8zp.onrender.com';

// True when running as a deployed web app (not on localhost/emulator)
const isWebProduction = Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  WEB_HOST !== 'localhost' &&
  WEB_HOST !== '127.0.0.1';

// Detect emulators (not physical devices)
const isAndroidEmulator = Platform.OS === 'android' && !Constants.isDevice;
const isIosSimulator = Platform.OS === 'ios' && !Constants.isDevice;
const isEmulator = isAndroidEmulator || isIosSimulator;

const STATIC_API_URL = process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
  Constants.manifest?.extra?.EXPO_PUBLIC_API_URL;
const STATIC_SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_SOCKET_URL ||
  Constants.manifest?.extra?.EXPO_PUBLIC_SOCKET_URL;

const getDevHost = () => {
  if (Platform.OS === 'web') return 'localhost';
  if (Platform.OS === 'ios' && isEmulator) return IOS_SIMULATOR_HOST;
  if (Platform.OS === 'android' && isEmulator) return ANDROID_EMULATOR_HOST;
  return HOST_FROM_DEBUGGER || ANDROID_EMULATOR_HOST || 'localhost';
};

const DEV_HOST = getDevHost();
const DEV_API_URL = `http://${DEV_HOST}:5005/api`;
const DEV_SOCKET_URL = `http://${DEV_HOST}:5005`;

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
// Resolution order:
// 1. Explicit env override (EXPO_PUBLIC_API_URL)
// 2. Android emulator → 10.0.2.2
// 3. iOS simulator → 127.0.0.1
// 4. Web dev (localhost) → local IP
// 5. Physical device in DEV mode → local IP
// 6. Everything else (production build) → Render production
export const API_URL = STATIC_API_URL || PRODUCTION_API_URL;

// Fallback is always the live production server
export const API_FALLBACK_URL = PRODUCTION_API_URL;

export const SOCKET_URL = isWebProduction ? PRODUCTION_SOCKET_URL : (STATIC_SOCKET_URL || PRODUCTION_SOCKET_URL);

export const THEME = {
  primary: '#0284c7',       // sky-600
  backgroundDark: '#0f172a', // slate-900
  backgroundLight: '#f8fafc', // slate-50
};

