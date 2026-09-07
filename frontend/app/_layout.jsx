import 'react-native-gesture-handler';
import '../global.css';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}
