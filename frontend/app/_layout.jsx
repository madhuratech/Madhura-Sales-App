import '../global.css';
import { Stack, ErrorBoundary } from 'expo-router';
export { ErrorBoundary };
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Appearance } from 'react-native';
import { useEffect } from 'react';
import { playNotificationSound } from '../components/AppLayout';

export default function Layout() {
  useEffect(() => {
    if (Appearance && typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme('light');
    }
  }, []);

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#f8fafc' },
        }}
      />
      <Toast onShow={() => playNotificationSound('notification')} />
    </SafeAreaProvider>
  );
}
