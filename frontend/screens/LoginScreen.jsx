import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width > 768;

  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Field Executive');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '' });

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userStr = await AsyncStorage.getItem('user');
        if (token && userStr) {
          const user = JSON.parse(userStr);
          const adminRoles = ['Admin', 'Project Manager', 'Team Lead', 'HR', 'Managing Director MD'];
          if (adminRoles.includes(user.role)) router.replace('/AdminDashboard');
          else router.replace('/Dashboard');
        }
      } catch (e) {
        // Ignore error and stay on login
      }
    };
    checkLogin();
  }, []);

  const validate = () => {
    let errs = {};
    let firstErrorMsg = null;
    if (role === 'Admin' || role === 'Super Admin') {
      if (!email) { errs.email = true; firstErrorMsg = firstErrorMsg || 'Email address is required'; }
      else if (!/\S+@\S+\.\S+/.test(email)) { errs.email = true; firstErrorMsg = firstErrorMsg || 'Please enter a valid email'; }
    } else {
      if (!employeeId) { errs.employeeId = true; firstErrorMsg = firstErrorMsg || 'Employee ID is required'; }
      else if (!/^\d{5}$/.test(employeeId)) { errs.employeeId = true; firstErrorMsg = firstErrorMsg || 'Employee ID must be exactly 5 digits'; }
    }
    if (!password) { errs.password = true; firstErrorMsg = firstErrorMsg || 'Password is required'; }
    
    setErrors(errs);
    if (firstErrorMsg) {
      setAlertModal({ visible: true, title: 'Validation Error', message: firstErrorMsg });
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const apiRole = role === 'Super Admin' ? 'Managing Director MD' : role === 'Admin' ? 'Admin' : 'Field Executive';
      const payload = (role === 'Admin' || role === 'Super Admin') ? { email, password, role: apiRole } : { employeeId, password, role: apiRole };
      const response = await api.post('/auth/login', payload);
      const { token, user } = response.data;
      if (role === 'Super Admin' && user.role !== 'Managing Director MD' && user.role !== 'Super Admin') {
        setLoading(false);
        setAlertModal({
          visible: true,
          title: 'Incorrect Login Tab',
          message: 'This tab is reserved for Super Admin (MD). Please select the Admin or Employee tab instead.'
        });
        return;
      }

      const regularAdmins = ['Admin', 'Project Manager', 'Team Lead', 'HR'];
      if (role === 'Admin' && !regularAdmins.includes(user.role)) {
        setLoading(false);
        setAlertModal({
          visible: true,
          title: 'Incorrect Login Tab',
          message: user.role === 'Managing Director MD' 
            ? 'Please use the Super Admin tab to log in.'
            : 'Please use the Employee tab to log in.'
        });
        return;
      }

      if (role === 'Field Executive' && user.role !== 'Field Executive') {
        setLoading(false);
        setAlertModal({
          visible: true,
          title: 'Incorrect Login Tab',
          message: 'This account belongs to an admin. Please switch to the Admin or Super Admin tab.'
        });
        return;
      }

      if (token) {
        await AsyncStorage.setItem('token', token);
      }
      if (user) {
        await AsyncStorage.setItem('user', JSON.stringify(user));
      }
      
      const adminRolesForCheck = ['Admin', 'Project Manager', 'Team Lead', 'HR', 'Managing Director MD'];
      const isAdminAccount = adminRolesForCheck.includes(user.role);
      
      if (isAdminAccount) {
        router.replace('/AdminDashboard');
      } else {
        router.replace('/Dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Network error occurred. Please try again.';
      if (msg.includes('pending admin approval')) {
        setAlertModal({ visible: true, title: 'Account Pending', message: msg });
      } else if (msg.includes('already logged in')) {
        setErrors(prev => ({ ...prev, password: true }));
        setAlertModal({ visible: true, title: 'Device Limit Reached', message: 'Your account is already logged in on another device. Please log out from the other device before signing in here.' });
      } else if (msg.toLowerCase().includes('wrong') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('invalid')) {
        setErrors({
          [(role === 'Admin' || role === 'Super Admin') ? 'email' : 'employeeId']: true,
          password: true
        });
        setAlertModal({ visible: true, title: 'Login Failed', message: 'You have entered wrong credentials or your information is invalid' });
      } else {
        setAlertModal({ visible: true, title: 'Login Failed', message: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const FormContent = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scroll, isWeb && styles.scrollWeb]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets={true}
    >
      {/* Background Glows for Mobile */}
      {!isWeb && (
        <View style={StyleSheet.absoluteFillObject}>
          <View style={[styles.glow, { top: -50, left: -50, width: 250, height: 250, backgroundColor: '#0ea5e9', opacity: 0.15 }]} />
          <View style={[styles.glow, { bottom: -100, right: -100, width: 350, height: 350, backgroundColor: '#6366f1', opacity: 0.15 }]} />
        </View>
      )}

      <View style={styles.formInner}>
        {/* Logo / Brand Header */}
        <View style={styles.header}>
          <Image source={require('../assets/madhura.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.brandName}>Madhura CRM</Text>
          <Text style={styles.brandTagline}>
            Field Staff Management Platform
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardSubtitle}>Sign in to your account to continue</Text>

          <View style={styles.roleGroup}>
            <Text style={styles.label}>Login Type</Text>
            <View style={styles.roleToggle}>
              {['Super Admin', 'Admin', 'Field Executive'].map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setRole(option)}
                  activeOpacity={0.85}
                  style={[
                    styles.roleOption,
                    role === option && styles.roleOptionActive,
                  ]}
                >
                  <Text style={[
                    styles.roleOptionText,
                    role === option && styles.roleOptionTextActive,
                  ]}>{option === 'Field Executive' ? 'Employee' : option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.roleHint}>
              {role === 'Admin' || role === 'Super Admin'
                ? `Use your ${role.toLowerCase()} credentials to access the admin dashboard.`
                : 'Use your employee credentials to access the field executive dashboard.'}
            </Text>
          </View>

          {role === 'Admin' || role === 'Super Admin' ? (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[
                styles.inputContainer,
                focusedField === 'email' && styles.inputFocused,
                errors.email && styles.inputError,
              ]}>
                <Ionicons name="mail-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={t => { setEmail(t); if(errors.email) setErrors(e => ({ ...e, email: null })); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="admin@madhura.com"
                  placeholderTextColor="#64748b"
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField('null')}
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>
          ) : (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Employee ID</Text>
              <View style={[
                styles.inputContainer,
                focusedField === 'employeeId' && styles.inputFocused,
                errors.employeeId && styles.inputError,
              ]}>
                <Ionicons name="id-card-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={employeeId}
                  onChangeText={t => { 
                    const numOnly = t.replace(/\D/g, '');
                    setEmployeeId(numOnly); 
                    if(numOnly.length > 5) {
                      setErrors(e => ({ ...e, employeeId: true }));
                      setAlertModal({ visible: true, title: 'Validation Error', message: 'Employee ID must be exactly 5 digits' });
                    } else if(errors.employeeId) {
                      setErrors(e => ({ ...e, employeeId: null })); 
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={5}
                  placeholder="5-digit ID (e.g. 32629)"
                  placeholderTextColor="#64748b"
                  onFocus={() => setFocusedField('employeeId')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>
          )}

          {/* Password Field */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Password</Text>
            <View style={[
              styles.inputContainer,
              focusedField === 'password' && styles.inputFocused,
              errors.password && styles.inputError,
            ]}>
              <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={t => { setPassword(t); if(errors.password) setErrors(e => ({ ...e, password: null })); }}
                secureTextEntry={!showPassword}
                placeholder="••••••••••"
                placeholderTextColor="#64748b"
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => router.push('/ForgotPassword')}
            style={styles.forgotBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInBtn, loading && styles.signInBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.signInText}>Sign In →</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Create Account */}
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => router.push('/Register')}
            activeOpacity={0.85}
          >
            <Text style={styles.createBtnText}>Create New Account</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Madhura CRM · Field Management System
        </Text>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#030712" />
      {isWeb ? (
        <View style={styles.webContainer}>
          <View style={styles.webLeftPane}>
            {/* Decorative glow */}
            <View style={StyleSheet.absoluteFillObject}>
              <View style={[styles.glow, { top: -100, left: -100, width: 450, height: 450, backgroundColor: '#F5A623', opacity: 0.1 }]} />
              <View style={[styles.glow, { bottom: -150, right: -150, width: 550, height: 550, backgroundColor: '#F5A623', opacity: 0.06 }]} />
            </View>

            <View style={styles.webLeftContent}>
              <Image source={require('../assets/madhura.png')} style={{ width: 100, height: 100, marginBottom: 20, borderRadius: 14 }} resizeMode="contain" />
              <Text style={styles.webLeftTitle}>MADHURA</Text>
              <Text style={styles.webLeftBrand}>CRM</Text>
              <Text style={styles.webLeftSubtitle}>
                Empower your field workforce. Track performance, manage routes, and increase productivity in real-time.
              </Text>
              
              <View style={styles.webFeatureRow}>
                <View style={styles.webCheckIcon}>
                  <Ionicons name="checkmark" size={16} color="#1B2B4B" />
                </View>
                <Text style={styles.webFeatureText}>Real-time Location Tracking</Text>
              </View>
              <View style={styles.webFeatureRow}>
                <View style={styles.webCheckIcon}>
                  <Ionicons name="checkmark" size={16} color="#1B2B4B" />
                </View>
                <Text style={styles.webFeatureText}>Automated Expense Reports</Text>
              </View>
              <View style={styles.webFeatureRow}>
                <View style={styles.webCheckIcon}>
                  <Ionicons name="checkmark" size={16} color="#1B2B4B" />
                </View>
                <Text style={styles.webFeatureText}>Seamless Client Management</Text>
              </View>
            </View>
          </View>
          <View style={styles.webRightPane}>
            {/* Background Glows for Web Right Pane */}
            <View style={StyleSheet.absoluteFillObject}>
              <View style={[styles.glow, { top: '30%', left: '20%', width: 300, height: 300, backgroundColor: '#0ea5e9', opacity: 0.08 }]} />
            </View>
            {FormContent}
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {FormContent}
        </KeyboardAvoidingView>
      )}

      {/* Generic Custom Alert Overlay */}
      {Platform.OS === 'web' ? (
        alertModal.visible && (
          <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 999999, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <View style={styles.modalCard}>
              <View style={[styles.modalIconWrap, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="alert-circle-outline" size={28} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>{alertModal.title}</Text>
              <Text style={styles.modalSub}>{alertModal.message}</Text>
              <TouchableOpacity 
                style={styles.modalBtn} 
                onPress={() => setAlertModal({ visible: false, title: '', message: '' })}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnText}>Understood</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      ) : (
        <Modal visible={alertModal.visible} animationType="fade" transparent={true} onRequestClose={() => setAlertModal({ visible: false, title: '', message: '' })}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={[styles.modalIconWrap, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="alert-circle-outline" size={28} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>{alertModal.title}</Text>
              <Text style={styles.modalSub}>{alertModal.message}</Text>
              <TouchableOpacity 
                style={styles.modalBtn} 
                onPress={() => setAlertModal({ visible: false, title: '', message: '' })}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnText}>Understood</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  glow: {
    position: 'absolute',
    borderRadius: 9999,
  },
  webContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  webLeftPane: {
    flex: 1,
    backgroundColor: '#1B2B4B',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
    position: 'relative',
    overflow: 'hidden',
  },
  webLeftContent: {
    maxWidth: 500,
    zIndex: 2,
  },
  webIconWrap: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  webLeftTitle: {
    fontSize: 42,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 3,
  },
  webLeftBrand: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F5A623',
    letterSpacing: 1.5,
    marginBottom: 28,
  },
  webLeftSubtitle: {
    fontSize: 16,
    color: '#9EB4D0',
    lineHeight: 26,
    marginBottom: 40,
  },
  webFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  webCheckIcon: {
    width: 28,
    height: 28,
    borderRadius: 99,
    backgroundColor: '#F5A623',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webFeatureText: {
    fontSize: 15,
    color: '#D4E3F5',
    fontWeight: '500',
    marginLeft: 16,
  },
  webRightPane: {
    flex: 1,
    backgroundColor: '#f8fafc',
    position: 'relative',
    overflow: 'hidden',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  scrollWeb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  formInner: {
    width: '100%',
    maxWidth: 420,
    zIndex: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoImage: {
    width: 58,
    height: 58,
    marginBottom: 10,
    borderRadius: 14,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#1B2B4B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 12,
    boxShadow: '0px 8px 24px rgba(27, 43, 75, 0.4)',
    borderWidth: 3,
    borderColor: '#F5A623',
  },
  logoText: {
    fontSize: 36,
    fontWeight: '500',
    color: '#F5A623',
  },
  brandName: {
    fontSize: 26,
    fontWeight: '500',
    color: '#0f172a',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  brandTagline: {
    fontSize: 13,
    color: '#64748b',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.99)',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 4,
    boxShadow: '0px 12px 32px rgba(0, 0, 0, 0.05)',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: '#0f172a',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 28,
  },
  fieldWrap: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.99)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    paddingHorizontal: 16,
    height: 54,
  },
  inputFocused: {
    borderColor: '#F5A623',
    borderWidth: 2,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#0f172a',
    fontSize: 15,
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 6,
    paddingLeft: 4,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -4,
  },
  forgotText: {
    color: '#F5A623',
    fontSize: 13,
    fontWeight: '500',
  },
  signInBtn: {
    backgroundColor: '#1B2B4B',
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#F5A623',
    boxShadow: '0px 8px 20px rgba(27, 43, 75, 0.35)',
  },
  signInBtnDisabled: {
    opacity: 0.7,
  },
  signInText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    color: '#64748b',
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '400',
  },
  createBtn: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  createBtnText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '400',
  },
  roleGroup: {
    marginBottom: 20,
  },
  roleToggle: {
    flexDirection: 'row',
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 4,
    marginTop: 8,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionActive: {
    backgroundColor: '#1B2B4B',
  },
  roleOptionText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  roleOptionTextActive: {
    color: '#ffffff',
  },
  roleHint: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 32,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360,
    alignItems: 'center', elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20,
  },
  modalIconWrap: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF8EC',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '500', color: '#0f172a', marginBottom: 8 },
  modalSub: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 18 },
  modalBtn: {
    backgroundColor: '#1B2B4B', borderRadius: 14, width: '100%', height: 48,
    alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: '#F5A623',
  },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
