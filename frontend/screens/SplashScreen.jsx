import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.5)).current; // Initial scale for logo

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: false,
      }),
    ]).start();

    const checkAuth = async () => {
      // Wait for animations to complete before transitioning
      await new Promise(r => setTimeout(r, 800));
      try {
        const token = await AsyncStorage.getItem('token');
        const userStr = await AsyncStorage.getItem('user');
        if (token && userStr) {
          const user = JSON.parse(userStr);
          
          if (user.isApproved === false) {
            router.replace('/PendingApproval');
          } else {
            router.replace(user.role === 'Admin' ? '/AdminDashboard' : '/Dashboard');
          }
        } else {
          router.replace('/Login');
        }
      } catch {
        router.replace('/Login');
      }
    };

    checkAuth();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoWrap}>
            <Animated.Image 
              source={require('../assets/madhura.png')} 
              style={[styles.logoImage, { transform: [{ scale: scaleAnim }] }]} 
              resizeMode="contain" 
            />
          </View>
          <Text style={styles.appName}>Madhura CRM</Text>
          <Text style={styles.tagline}>Field Staff Management</Text>

          <View style={styles.dotsRow}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </Animated.View>

        <Text style={styles.version}>v1.0.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: { alignItems: 'center' },
  logoWrap: { marginBottom: 28 },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 30,
  },
  appName: {
    fontSize: 30,
    fontWeight: '500',
    color: '#0f172a',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 13,
    color: '#64748b',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 40,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  dotActive: {
    backgroundColor: '#2563eb',
    width: 24,
  },
  version: {
    position: 'absolute',
    bottom: 24,
    color: '#334155',
    fontSize: 11,
    letterSpacing: 1,
  },
});
