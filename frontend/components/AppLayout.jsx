import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, Pressable, StyleSheet, Platform, Vibration, Image, Alert, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { connectSocket, disconnectSocket } from '../utils/socket';
import Toast from 'react-native-toast-message';
import * as Location from 'expo-location';
import { performLogout } from '../utils/logout';
import api from '../services/api';

// ── Brand Tokens ──────────────────────────────────────────────────
const NAVY   = '#1B2B4B';   // Madhura deep navy
const GOLD   = '#F5A623';   // Madhura amber/gold
const NAVY_2 = '#243454';   // slightly lighter navy for hover
const GOLD_BG= '#FFF8EC';   // gold tint background
// ──────────────────────────────────────────────────────────────────

// ── Cross-platform notification sound ─────────────────────────────
export const playNotificationSound = async (type = 'notification') => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Play actual MP3 sounds using standard Web Audio
      const soundUrl = type === 'chat' 
        ? 'https://assets.mixkit.co/active_storage/sfx/2866/2866-preview.mp3'
        : 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
        
      const audio = new window.Audio(soundUrl);
      audio.play().catch(e => console.log('Web audio play failed (interaction required)', e));
    } else {
      // Mobile vibration fallback (since native audio modules cause ExponentAV crash on custom clients)
      const pattern = type === 'chat' ? [0, 60, 40, 60] : [0, 80, 60, 80, 60, 80];
      Vibration.vibrate(pattern);
    }
  } catch (err) {
    console.log('Audio playback error:', err);
  }
};
// ──────────────────────────────────────────────────────────────────

// ── Screen access definitions per role ──────────────────────────────
// HR: Only specific management and reporting screens based on the matrix
// Admin/Project Manager: Specific management screens, minus HR exclusive ones
// Super Admin (Managing Director MD): All screens

const allAdminNavSections = [
  {
    title: 'Operations',
    items: [
      { title: 'Dashboard',         screen: 'AdminDashboard',           icon: 'grid-outline',      iconActive: 'grid' },
      { title: 'Field Staff Mgmt',  screen: 'UserManagement',           icon: 'people-outline',    iconActive: 'people' },
      { title: 'Client Onboarding', screen: 'ClientOnboarding',         icon: 'briefcase-outline', iconActive: 'briefcase' },
      { title: 'Projects',          screen: 'Project',                  icon: 'laptop-outline',    iconActive: 'laptop' },
      { title: 'Products & Services', screen: 'Product',                icon: 'cube-outline',      iconActive: 'cube' },
      { title: 'Quotations',        screen: 'Quotation',                icon: 'document-text-outline', iconActive: 'document-text' },
      { title: 'Log Client Visit',  screen: 'Meeting',                  icon: 'location-outline',  iconActive: 'location' },
      { title: 'Proforma Invoices', screen: 'ProformaInvoice',          icon: 'receipt-outline',   iconActive: 'receipt' },
      { title: 'Tax Invoices',      screen: 'Invoice',                  icon: 'wallet-outline',    iconActive: 'wallet' },
      { title: 'Payment Receipts',  screen: 'PaymentReceipt',           icon: 'card-outline',      iconActive: 'card' },
    ],
  },
  {
    title: 'Tracking',
    items: [
      { title: 'Live Map & GPS',    screen: 'LiveLocation',             icon: 'map-outline',           iconActive: 'map' },
      { title: 'Team Attendance',   screen: 'AdminAttendance',          icon: 'people-outline',        iconActive: 'people' },
      { title: 'My Attendance',     screen: 'Attendance',               icon: 'time-outline',          iconActive: 'time' },
      { title: 'Reports',           screen: 'Reports',                  icon: 'bar-chart-outline',     iconActive: 'bar-chart' },
      { title: 'Team Chat',         screen: 'Chat',                     icon: 'chatbubbles-outline',   iconActive: 'chatbubbles' },
      { title: 'Profile',           screen: 'Profile',                  icon: 'person-outline',        iconActive: 'person' },
    ],
  },
];

const employeeNavSections = [
  {
    title: 'Operations',
    items: [
      { title: 'Home',             screen: 'Dashboard',       icon: 'home-outline',          iconActive: 'home' },
      { title: 'Daily Attendance', screen: 'Attendance',      icon: 'calendar-outline',      iconActive: 'calendar' },
      { title: 'Log Client Visit', screen: 'Meeting',         icon: 'location-outline',      iconActive: 'location' },
      { title: 'Work Update',      screen: 'WorkUpdate',      icon: 'document-text-outline', iconActive: 'document-text' },
      { title: 'Client Onboarding',screen: 'ClientOnboarding',icon: 'briefcase-outline',     iconActive: 'briefcase' },
      { title: 'Projects',         screen: 'Project',         icon: 'laptop-outline',        iconActive: 'laptop' },
      { title: 'Products & Services', screen: 'Product',       icon: 'cube-outline',          iconActive: 'cube' },
      { title: 'Quotations',       screen: 'Quotation',       icon: 'document-text-outline', iconActive: 'document-text' },
      { title: 'Proforma Invoices', screen: 'ProformaInvoice',          icon: 'receipt-outline',   iconActive: 'receipt' },
      { title: 'Tax Invoices',      screen: 'Invoice',                  icon: 'wallet-outline',    iconActive: 'wallet' },
      { title: 'Payment Receipts',  screen: 'PaymentReceipt',           icon: 'card-outline',      iconActive: 'card' },
    ],
  },
  {
    title: 'Tracking',
    items: [
      { title: 'Reports',          screen: 'Reports',         icon: 'bar-chart-outline',     iconActive: 'bar-chart' },
      { title: 'Chat',             screen: 'Chat',            icon: 'chatbubbles-outline',   iconActive: 'chatbubbles' },
      { title: 'Profile',          screen: 'Profile',         icon: 'person-outline',        iconActive: 'person' },
    ],
  },
];

function buildNavSections(role) {
  // Employee
  if (!['Admin', 'Project Manager', 'Team Lead', 'HR', 'Managing Director MD'].includes(role)) {
    return JSON.parse(JSON.stringify(employeeNavSections));
  }

  const base = JSON.parse(JSON.stringify(allAdminNavSections));

  // HR — whitelist specific screens according to matrix
  if (role === 'HR') {
    return [
      {
        title: 'Operations',
        items: [
          { title: 'Dashboard',         screen: 'AdminDashboard',           icon: 'grid-outline',      iconActive: 'grid' },
          { title: 'Field Staff Mgmt',  screen: 'UserManagement',           icon: 'people-outline',    iconActive: 'people' },
          { title: 'Client Onboarding', screen: 'ClientOnboarding',         icon: 'briefcase-outline', iconActive: 'briefcase' },
          { title: 'Products & Services', screen: 'Product',                icon: 'cube-outline',      iconActive: 'cube' },
        ],
      },
      {
        title: 'Tracking',
        items: [
          { title: 'Attendance Log',    screen: 'AdminAttendance',          icon: 'time-outline',          iconActive: 'time' },
          { title: 'Reports',           screen: 'Reports',                  icon: 'bar-chart-outline',     iconActive: 'bar-chart' },
          { title: 'Team Chat',         screen: 'Chat',                     icon: 'chatbubbles-outline',   iconActive: 'chatbubbles' },
          { title: 'Profile',           screen: 'Profile',                  icon: 'person-outline',        iconActive: 'person' },
        ],
      },
    ];
  }

  // Super Admin (MD) — full access, no filtering, except hide their own Attendance
  if (role === 'Managing Director MD') {
    const mdBase = JSON.parse(JSON.stringify(base));
    mdBase.forEach(section => {
      section.items = section.items.filter(item => item.screen !== 'Attendance');
    });
    return mdBase;
  }

  // Admin / Project Manager / Team Lead
  // These roles don't manage HR-specific deep configurations but do need most team screens.
  // The matrix allows them to see Attendance, Live Location, Employee Monitoring etc.
  return base;
}

export default function AppLayout({ children, currentScreen, scrollable = true, role = 'Admin' }) {
  
  const { width } = useWindowDimensions();
  const [userName, setUserName] = useState('');
  const [userInitial, setUserInitial] = useState('?');
  const [userRole, setUserRole] = useState(role);
  const [userDesignation, setUserDesignation] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(width > 768);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadTasks, setUnreadTasks] = useState(0);
  const [unreadFollowUps, setUnreadFollowUps] = useState(0);
  const [unreadMeetings, setUnreadMeetings] = useState(0);
  const [unreadAttendance, setUnreadAttendance] = useState(0);

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        const user = JSON.parse(stored);
        setUserName(user.name || '');
        setUserInitial(user.name?.charAt(0)?.toUpperCase() || '?');
        setUserRole(user.role || role);
        setUserDesignation(user.designation || '');
      }
    };
    load();
  }, [role]);

  // Load initial unread notification count from the server
  useEffect(() => {
    const loadUnread = async () => {
      try {
        const res = await api.get('/notifications?isRead=false');
        const data = res.data.data || [];
        setUnreadCount(data.length);
        setUnreadTasks(data.filter(n => n.type === 'Task').length);
        setUnreadFollowUps(data.filter(n => n.type === 'FollowUp').length);
        setUnreadMeetings(data.filter(n => n.type === 'Meeting').length);
        setUnreadAttendance(data.filter(n => 
          n.title?.includes('Check-in') || n.title?.includes('Check-out') || 
          n.title?.includes('Leave') || n.title?.includes('Attendance')
        ).length);
      } catch (_) {}
    };
    loadUnread();
  }, []);

  useEffect(() => {
    let activeSocket = null;
    const initSocket = async () => {
      const storedUser = await AsyncStorage.getItem('user');
      const currentUserId = storedUser ? JSON.parse(storedUser).id : null;

      activeSocket = await connectSocket();
      if (!activeSocket) return;

      // ── Notification events ──
      activeSocket.on('notification', (notif) => {
        Toast.show({
          type: notif.type === 'Warning' ? 'error' : notif.type === 'Success' ? 'success' : 'info',
          text1: notif.title,
          text2: notif.message,
          visibilityTime: 6000,
          onPress: () => {
            Toast.hide();
            setUnreadCount(0);
            router.push('/Notification');
          }
        });
        setUnreadCount(prev => prev + 1);
        if (notif.type === 'Task') setUnreadTasks(prev => prev + 1);
        if (notif.type === 'FollowUp') setUnreadFollowUps(prev => prev + 1);
        if (notif.type === 'Meeting') setUnreadMeetings(prev => prev + 1);
        if (notif.title?.includes('Check-in') || notif.title?.includes('Check-out') || 
            notif.title?.includes('Leave') || notif.title?.includes('Attendance')) {
          setUnreadAttendance(prev => prev + 1);
        }
      });

      // ── Chat message events ── (bump badge when NOT on Chat screen)
      const handleIncomingChat = (msg) => {
        const senderId = msg.sender?._id || msg.sender;
        if (senderId === currentUserId) return; // ignore own messages
        playNotificationSound('chat');
        setUnreadChat(prev => prev + 1);
      };
      activeSocket.on('team_message', handleIncomingChat);
      activeSocket.on('private_message', handleIncomingChat);
    };
    initSocket();
    return () => {
      if (activeSocket) {
        activeSocket.off('notification');
        activeSocket.off('team_message');
        activeSocket.off('private_message');
      }
    };
  }, []);

  useEffect(() => {
    setIsSidebarOpen(width > 768);
  }, [width]);

  const handleLogout = async () => {
    try {
      await Location.stopLocationUpdatesAsync('background-location-task');
    } catch (e) {}
    await performLogout();
  };

  // Global 401 SESSION_TAKEN interceptor — force logout if another device logs in
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (
          error?.response?.status === 401 &&
          error?.response?.data?.code === 'SESSION_TAKEN'
        ) {
          // Remove the interceptor to avoid multiple alerts
          api.interceptors.response.eject(interceptor);
          Alert.alert(
            '🔒 Account In Use',
            'Your account has been logged in on another device. You have been signed out.',
            [{ text: 'OK', onPress: () => performLogout() }],
            { cancelable: false }
          );
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, []);

  // Periodic location check and live sharing for employees
  useEffect(() => {
    const adminRoles = ['Admin', 'HR', 'Managing Director MD', 'Project Manager', 'Team Lead'];
    if (!userRole || adminRoles.includes(userRole)) return;

    const checkAndShareLocation = async () => {
      try {
        const storedVal = await AsyncStorage.getItem('@isLiveLocationShared');
        const isShared = storedVal === null ? true : JSON.parse(storedVal);

        const { status } = await Location.getForegroundPermissionsAsync();
        const enabled = await Location.hasServicesEnabledAsync();
        
        if (status !== 'granted' || !enabled || !isShared) {
          playNotificationSound('notification');
          Alert.alert(
            'Location Sharing Disabled',
            'Live location tracking must remain ON during working hours. Please enable GPS and turn ON Live Location Sharing in your Attendance screen.',
            [{ text: 'OK' }]
          );
        } else {
          // Send location to the backend
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await api.post('/locations', {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude
          });
        }
      } catch (error) {
        // ignore errors silently
      }
    };

    const initialCheck = setTimeout(checkAndShareLocation, 5000); // 5s startup delay
    const interval = setInterval(checkAndShareLocation, 30000); // repeat every 30s
    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, [userRole]);

  const handleNav = (screen) => {
    if (width <= 768) setIsSidebarOpen(false);
    if (screen === 'Chat' || screen === 'TeamChat') setUnreadChat(0);
    if (screen === 'Notification') setUnreadCount(0);
    if (screen === 'TaskAssignment' || screen === 'Task') setUnreadTasks(0);
    if (screen === 'AdminFollowupManagement' || screen === 'Followup') setUnreadFollowUps(0);
    if (screen === 'Meeting') setUnreadMeetings(0);
    if (screen === 'AdminAttendance' || screen === 'Attendance') setUnreadAttendance(0);
    router.push(screen.startsWith('/') ? screen : '/' + screen);
  };

  const isDesktop = width > 768;
  const adminRoles = ['Admin', 'Project Manager', 'Team Lead', 'HR', 'Managing Director MD'];
  const isAdmin = adminRoles.includes(userRole);

  const navSections = buildNavSections(userRole);

  const portalLabel = (() => {
    if (userRole === 'Managing Director MD') return 'SUPER ADMIN';
    if (userRole === 'HR') return 'HR PORTAL';
    if (userRole === 'Project Manager') return 'PROJECT MANAGER';
    if (userRole === 'Team Lead') return 'TEAM LEAD';
    if (isAdmin) return 'ADMIN PORTAL';
    return userDesignation ? userDesignation.toUpperCase() : 'EMPLOYEE PORTAL';
  })();
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.root, { flexDirection: isDesktop ? 'row' : 'column' }]}>

        {/* ── Mobile Top Bar ── */}
        {!isDesktop && (
          <View style={styles.mobileTopBar}>
            <View style={styles.mobileTopLeft}>
              <TouchableOpacity
                onPress={() => setIsSidebarOpen(!isSidebarOpen)}
                style={styles.mobileMenuBtn}
              >
                <Ionicons name={isSidebarOpen ? 'close' : 'menu'} size={24} color="#fff" />
              </TouchableOpacity>
              {/* Logo mark */}
              <View style={styles.mobileLogo}>
                <Image source={require('../assets/madhura.png')} style={{width: 44, height: 44, borderRadius: 12}} resizeMode="contain" />
              </View>
              <View>
                <Text style={styles.mobileBrand}>MADHURA</Text>
                <Text style={styles.mobileSub}>CRM</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                setUnreadCount(0);
                router.push('/Notification');
              }}
              style={styles.bellBtn}
            >
              <Ionicons name="notifications-outline" size={22} color={GOLD} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
              {unreadCount === 0 && <View style={styles.bellDot} />}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Mobile Overlay ── */}
        {isSidebarOpen && !isDesktop && (
          <Pressable
            style={styles.overlay}
            onPress={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        {isSidebarOpen && (
          <View style={[
            styles.sidebar,
            isDesktop ? styles.sidebarDesktop : styles.sidebarMobile,
          ]}>
            {/* Brand Header */}
            <View style={styles.sidebarHeader}>
              {/* Logo row */}
              <View style={styles.logoRow}>
                <View style={styles.logoMark}>
                  <Image source={require('../assets/madhura.png')} style={{width: 52, height: 52, borderRadius: 14}} resizeMode="contain" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logoTitle}>MADHURA</Text>
                  <Text style={styles.logoSub}>CRM</Text>
                </View>
                <View style={styles.sidebarOnlineDot} />
              </View>

              {/* User pill */}
              <View style={styles.userPill}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>{userInitial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userPortalLabel}>
                    {portalLabel}
                  </Text>
                  <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
                </View>
              </View>
            </View>

            {/* Nav Sections */}
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.navScroll}
            >
              {navSections.map((section) => (
                <View key={section.title} style={styles.navSection}>
                  <Text style={styles.navSectionTitle}>{section.title}</Text>
                  {section.items.map((item) => {
                    const isActive = currentScreen === item.screen;
                    // Badge count per screen
                    const badge =
                      item.screen === 'Notification' ? unreadCount :
                      (item.screen === 'Chat' || item.screen === 'TeamChat') ? unreadChat :
                      (item.screen === 'TaskAssignment' || item.screen === 'Task') ? unreadTasks :
                      (item.screen === 'AdminFollowupManagement' || item.screen === 'Followup') ? unreadFollowUps :
                      (item.screen === 'Meeting') ? unreadMeetings : 
                      (item.screen === 'AdminAttendance' || item.screen === 'Attendance') ? unreadAttendance : 0;
                    return (
                      <TouchableOpacity
                        key={item.screen}
                        onPress={() => handleNav(item.screen)}
                        style={[styles.navItem, isActive && styles.navItemActive]}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.navIconWrap, isActive && styles.navIconWrapActive]}>
                          <Ionicons
                            name={isActive ? item.iconActive : item.icon}
                            size={17}
                            color={isActive ? GOLD : '#9EB4D0'}
                          />
                          {badge > 0 && (
                            <View style={styles.navBadge}>
                              <Text style={styles.navBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.navItemText, isActive && styles.navItemTextActive]}>
                          {item.title}
                        </Text>
                        {badge > 0 && !isActive && (
                          <View style={styles.navBadgePill}>
                            <Text style={styles.navBadgePillText}>{badge > 9 ? '9+' : badge}</Text>
                          </View>
                        )}
                        {isActive && <View style={styles.navActiveBar} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            {/* Footer: Logout */}
            <View style={styles.sidebarFooter}>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.8}>
                <Ionicons name="log-out-outline" size={18} color="#f87171" />
                <Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Main Content ── */}
        <View style={styles.main}>
          {scrollable ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.mainContent,
                { padding: isDesktop ? 24 : 16, paddingTop: isDesktop ? 16 : 8 },
              ]}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[
              styles.mainFlex,
              { padding: isDesktop ? 24 : 16, paddingTop: isDesktop ? 16 : 8 },
            ]}>
              {children}
            </View>
          )}
        </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  root: { flex: 1, flexDirection: 'row' },

  // ── Mobile top bar ──
  mobileTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: NAVY, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#243454',
  },
  mobileTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mobileLogo: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center',
  },
  mobileLogoText: { color: NAVY, fontWeight: '500', fontSize: 18 },
  mobileBrand: { color: '#fff', fontWeight: '500', fontSize: 15, letterSpacing: 1.5 },
  mobileSub:   { color: GOLD,  fontWeight: '400', fontSize: 9,  letterSpacing: 0.5 },
  mobileMenuBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#243454', alignItems: 'center', justifyContent: 'center',
  },
  bellBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: '#243454', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  bellDot: {
    position: 'absolute', top: 8, right: 9, width: 7, height: 7,
    borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1, borderColor: NAVY,
  },
  bellBadge: {
    position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16,
    borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: NAVY, paddingHorizontal: 2,
  },
  bellBadgeText: { color: '#fff', fontSize: 8, fontWeight: '500' },

  // ── Overlay ──
  overlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 10,
  },

  // ── Sidebar ──
  sidebar: {
    backgroundColor: NAVY,
    borderRightWidth: 1, borderRightColor: '#243454',
    zIndex: 20,
  },
  sidebarDesktop: { width: 260 },
  sidebarMobile: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '80%', maxWidth: 280 },

  sidebarHeader: {
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#243454',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  logoMark: {
    width: 58, height: 58, borderRadius: 16,
    backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  logoMarkText: { color: NAVY, fontWeight: '500', fontSize: 22 },
  logoTitle: { color: '#fff', fontWeight: '500', fontSize: 14, letterSpacing: 2 },
  logoSub:   { color: GOLD,  fontWeight: '400', fontSize: 9,  letterSpacing: 0.5, marginTop: 1 },
  sidebarOnlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', flexShrink: 0 },

  userPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#243454', borderRadius: 14, padding: 10,
  },
  userAvatar: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  userAvatarText: { color: NAVY, fontWeight: '500', fontSize: 16 },
  userPortalLabel: { fontSize: 11, color: GOLD, fontWeight: '600', letterSpacing: 1.5, marginBottom: 2 },
  userName: { color: '#fff', fontWeight: '500', fontSize: 14 },

  // ── Nav ──
  navScroll: { paddingBottom: 8 },
  navSection: { paddingTop: 20, paddingHorizontal: 12 },
  navSectionTitle: {
    fontSize: 9, fontWeight: '400', color: '#5B7A9D',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: 6, paddingLeft: 4,
  },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 14, marginBottom: 2, position: 'relative',
  },
  navItemActive: { backgroundColor: '#243454' },
  navIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#243454', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2E4168',
  },
  navIconWrapActive: { backgroundColor: GOLD + '22', borderColor: GOLD + '55', position: 'relative' },
  navItemText: { flex: 1, fontSize: 13, color: '#9EB4D0', fontWeight: '400' },
  navItemTextActive: { color: '#fff', fontWeight: '500' },

  // icon-corner badge (small red dot with number)
  navBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: NAVY, paddingHorizontal: 2,
  },
  navBadgeText: { color: '#fff', fontSize: 8, fontWeight: '500' },

  // pill badge at right of nav row
  navBadgePill: {
    backgroundColor: '#ef4444', borderRadius: 99,
    paddingHorizontal: 7, paddingVertical: 2, minWidth: 20, alignItems: 'center',
  },
  navBadgePillText: { color: '#fff', fontSize: 9, fontWeight: '500' },
  navActiveBar: {
    position: 'absolute', right: 0, top: '25%', bottom: '25%',
    width: 3, borderRadius: 3, backgroundColor: GOLD,
  },

  // ── Footer ──
  sidebarFooter: {
    borderTopWidth: 1, borderTopColor: '#243454',
    padding: 12,
  },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 14, backgroundColor: '#2E1A1A',
  },
  logoutText: { color: '#f87171', fontWeight: '500', fontSize: 13 },

  // ── Main content ──
  main: { flex: 1, backgroundColor: '#F5F7FA' },
  mainContent: { flexGrow: 1, paddingBottom: 60 },
  mainFlex: { flex: 1, paddingBottom: 60 },
  globalBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },

  // Sidebar footer bell button
  sidebarBellBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 14, backgroundColor: '#1E3355', marginBottom: 8,
  },
  sidebarBellText: { flex: 1, color: GOLD, fontWeight: '500', fontSize: 13 },
  sidebarBellBadge: {
    position: 'absolute', top: -5, right: -5,
    minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: NAVY, paddingHorizontal: 2,
  },
  sidebarBellBadgeText: { color: '#fff', fontSize: 7, fontWeight: '500' },

  // Dashboard bell icon (top-right of main content)
  dashBellBtn: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  dashBellBadge: {
    position: 'absolute', top: 5, right: 5, minWidth: 16, height: 16,
    borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff', paddingHorizontal: 2,
  },
  dashBellBadgeText: { color: '#fff', fontSize: 8, fontWeight: '500' },
});
