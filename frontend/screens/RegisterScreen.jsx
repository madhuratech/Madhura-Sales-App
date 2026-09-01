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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import Toast from 'react-native-toast-message';

export default function RegisterScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width > 768;

  const [step, setStep] = useState(1); // 1 or 2
  const [form, setForm] = useState({
    name: '', email: '', phone: '', employeeId: '',
    designation: '', customDesignation: '', password: '', confirmPassword: '', role: 'Field Executive',
    adminLevel: 'Admin', // Admin or Super Admin
  });
  const [designations, setDesignations] = useState({ admin: [], employee: [] });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showAdminEmpIdModal, setShowAdminEmpIdModal] = useState(false);
  const [adminEmpId, setAdminEmpId] = useState('');
  const [registeredUser, setRegisteredUser] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const desigRes = await api.get('/auth/designations');
        if (desigRes.data?.data) {
          setDesignations(desigRes.data.data);
        }
      } catch (e) { console.error('Failed to fetch designations', e); }
      
      try {
        const token = await AsyncStorage.getItem('token');
        const userStr = await AsyncStorage.getItem('user');
        if (token && userStr) {
          const user = JSON.parse(userStr);
          router.replace(user.role === 'Admin' ? '/AdminDashboard' : '/Dashboard');
        }
      } catch (_) {}
    })();
  }, []);

  const update = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: null }));
    if (serverError) setServerError('');
  };

  // ── Step 1 validation ──────────────────────────────────────────────────────
  const validateStep1 = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.phone.trim()) errs.phone = 'Phone number is required';
    else if (!/^\d{10}$/.test(form.phone.trim())) errs.phone = 'Enter a valid 10-digit number';
    if (form.role !== 'Admin') {
      if (!form.employeeId.trim()) errs.employeeId = 'Employee ID is required';
      else if (!/^\d{5}$/.test(form.employeeId.trim())) errs.employeeId = 'Must be exactly 5 digits';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Step 2 validation ──────────────────────────────────────────────────────
  const validateStep2 = () => {
    const errs = {};
    if ((form.role !== 'Admin' || form.adminLevel !== 'Super Admin') && !form.designation.trim()) {
      errs.designation = 'Please select a designation';
    }
    if ((form.role !== 'Admin' || form.adminLevel !== 'Super Admin') && form.designation === 'Other' && !form.customDesignation.trim()) {
      errs.customDesignation = 'Please specify your designation';
    }
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'Minimum 6 characters';
    if (!form.confirmPassword) errs.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (validateStep1()) setStep(2);
  };

  const goBack = () => {
    setErrors({});
    setStep(1);
  };

  const handleRegister = async () => {
    if (!validateStep2()) return;
    setLoading(true);
    try {
      let finalDesignation = form.designation === 'Other' ? form.customDesignation.trim() : form.designation.trim();
      let finalRole = form.role;
      if (form.role === 'Admin') {
        if (form.adminLevel === 'Super Admin') {
          finalRole = 'Managing Director MD';
          finalDesignation = 'Managing Director MD';
        } else if (['Project Manager', 'Team Lead', 'HR'].includes(finalDesignation)) {
          finalRole = finalDesignation;
        } else {
          finalRole = 'Admin';
        }
      } else {
        finalRole = 'Field Executive';
      }

      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        employeeId: form.employeeId.trim(),
        designation: finalDesignation,
        password: form.password,
        role: finalRole,
      };
      const response = await api.post('/auth/register', payload);
      const data = response?.data || {};
      const user = data.user || data.data?.user;
      const token = data.token || data.data?.token;

      setServerError('');
      if (token) {
        await AsyncStorage.setItem('token', token);
      }
      if (user) {
        await AsyncStorage.setItem('user', JSON.stringify(user));
        setRegisteredUser(user);
      }
      
      const isAdmin = ['Admin', 'Project Manager', 'Team Lead', 'HR', 'Managing Director MD'].includes(user.role);
      
      Toast.show({
        type: 'success',
        text1: '🎉 Registration Submitted!',
        text2: isAdmin ? 'Account created successfully!' : `Your account is pending admin approval.`,
        visibilityTime: 4000,
      });

      if (isAdmin) {
        setShowAdminEmpIdModal(true);
      } else {
        // Keep the token! Do not clear it.
        // Route to the new polling screen.
        setTimeout(() => router.replace('/PendingApproval'), 1000);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Something went wrong.';
      if (msg.toLowerCase().includes('email')) {
        setErrors(prev => ({ ...prev, email: msg }));
        setStep(1);
      } else if (msg.toLowerCase().includes('employee') || msg.toLowerCase().includes('id')) {
        setErrors(prev => ({ ...prev, employeeId: msg }));
        setStep(1);
      } else {
        setServerError(msg);
        Alert.alert('Registration Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminEmpIdSubmit = async () => {
    try {
      if (adminEmpId.trim()) {
        const res = await api.put('/users/profile', { employeeId: adminEmpId.trim() });
        const updated = res.data.data;
        await AsyncStorage.setItem('user', JSON.stringify(updated));
      }
    } catch (error) {
      console.log('Failed to save Admin Employee ID:', error);
    } finally {
      setShowAdminEmpIdModal(false);
      // Auto-approved admins can go straight to the dashboard
      router.replace('/AdminDashboard');
    }
  };

  const inputStyle = (field) => [
    styles.inputContainer,
    focusedField === field && styles.inputFocused,
    errors[field] && styles.inputError,
  ];

  // ── Step 1 UI ──────────────────────────────────────────────────────────────
  const Step1 = (
    <View>
      {/* Account Type toggle — at the TOP so fields change accordingly */}
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Account Type</Text>
        <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 14, padding: 4, marginTop: 6 }}>
          {[
            { label: 'Admin',    value: 'Admin',          icon: 'shield-checkmark' },
            { label: 'Employee', value: 'Field Executive', icon: 'people' },
          ].map(opt => {
            const isActive = form.role === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => { update('role', opt.value); update('employeeId', ''); update('designation', ''); }}
                activeOpacity={0.8}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 7, paddingVertical: 10, borderRadius: 11,
                  backgroundColor: isActive ? '#1B2B4B' : 'transparent',
                }}
              >
                <Ionicons name={opt.icon} size={16} color={isActive ? '#F5A623' : '#64748b'} />
                <Text style={{ fontSize: 13, fontWeight: '500', color: isActive ? '#fff' : '#64748b' }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Admin Level Dropdown */}
      {form.role === 'Admin' && (
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Admin Level</Text>
          <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 14, padding: 4, marginTop: 6 }}>
            {['Admin', 'Super Admin'].map(lvl => {
              const isActive = form.adminLevel === lvl;
              return (
                <TouchableOpacity
                  key={lvl}
                  onPress={() => update('adminLevel', lvl)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 7, paddingVertical: 10, borderRadius: 11,
                    backgroundColor: isActive ? '#1B2B4B' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '500', color: isActive ? '#fff' : '#64748b' }}>
                    {lvl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Full Name */}
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Full Name</Text>
        <View style={inputStyle('name')}>
          <Ionicons name="person-outline" size={17} color="#64748b" style={styles.icon} />
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={v => update('name', v)}
            placeholder="Enter your full name"
            placeholderTextColor="#94a3b8"
            autoCapitalize="words"
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
          />
        </View>
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
      </View>

      {/* Email + Phone side by side on wider screens */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={[styles.fieldWrap, { flex: 1 }]}>
          <Text style={styles.label}>Email</Text>
          <View style={inputStyle('email')}>
            <Ionicons name="mail-outline" size={17} color="#64748b" style={styles.icon} />
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={v => update('email', v)}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        <View style={[styles.fieldWrap, { flex: 1 }]}>
          <Text style={styles.label}>Phone</Text>
          <View style={inputStyle('phone')}>
            <Ionicons name="call-outline" size={17} color="#64748b" style={styles.icon} />
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={v => {
                const numOnly = v.replace(/\D/g, '');
                update('phone', numOnly);
              }}
              placeholder="10-digit"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              maxLength={10}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>
      </View>

      {/* Employee ID — only for employees */}
      {form.role !== 'Admin' && (
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Employee ID</Text>
          <View style={inputStyle('employeeId')}>
            <Ionicons name="id-card-outline" size={17} color="#64748b" style={styles.icon} />
            <TextInput
              style={styles.input}
              value={form.employeeId}
              onChangeText={v => {
                const numOnly = v.replace(/\D/g, '');
                update('employeeId', numOnly);
                if (numOnly.length > 5) {
                  setErrors(prev => ({ ...prev, employeeId: 'Employee ID must be exactly 5 digits' }));
                }
              }}
              placeholder="5-digit ID (e.g. 32629)"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              maxLength={5}
              onFocus={() => setFocusedField('employeeId')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {errors.employeeId && <Text style={styles.errorText}>{errors.employeeId}</Text>}
        </View>
      )}

      <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
        <Text style={styles.nextBtnText}>Continue →</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Step 2 UI ──────────────────────────────────────────────────────────────
  const Step2 = (
    <View>
      {/* Designation chips */}
      {(form.role !== 'Admin' || form.adminLevel !== 'Super Admin') && (
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>{form.role === 'Admin' ? 'Your Title' : 'Designation'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {(() => {
            let options = [];
            if (form.role === 'Admin') {
              options = ['Project Manager', 'Team Lead', 'HR', 'Other'];
            } else {
              const defaultEmps = ['BDE', 'BDM', 'Pre Sales'];
              options = [...defaultEmps, 'Other'];
            }
            return options.map(d => (
              <TouchableOpacity
                key={d}
                onPress={() => update('designation', d)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 10,
                  borderRadius: 14, borderWidth: 1.5,
                  borderColor: form.designation === d ? '#F5A623' : '#e2e8f0',
                  backgroundColor: form.designation === d ? '#1B2B4B' : '#f1f5f9',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: form.designation === d ? '#fff' : '#64748b' }}>
                  {d}
                </Text>
              </TouchableOpacity>
            ));
          })()}
          </View>
          {errors.designation && <Text style={styles.errorText}>{errors.designation}</Text>}
        </View>
      )}

      {form.designation === 'Other' && (
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Custom Designation</Text>
          <View style={inputStyle('customDesignation')}>
            <Ionicons name="briefcase-outline" size={17} color="#64748b" style={styles.icon} />
            <TextInput
              style={styles.input}
              value={form.customDesignation}
              onChangeText={v => update('customDesignation', v)}
              placeholder="Type your designation"
              placeholderTextColor="#94a3b8"
              onFocus={() => setFocusedField('customDesignation')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {errors.customDesignation && <Text style={styles.errorText}>{errors.customDesignation}</Text>}
        </View>
      )}

      {/* Password */}
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Password</Text>
        <View style={inputStyle('password')}>
          <Ionicons name="lock-closed-outline" size={17} color="#64748b" style={styles.icon} />
          <TextInput
            style={styles.input}
            value={form.password}
            onChangeText={v => update('password', v)}
            placeholder="Min. 6 characters"
            placeholderTextColor="#94a3b8"
            secureTextEntry={!showPassword}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
          />
          <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#64748b" />
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
      </View>

      {/* Confirm Password */}
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Confirm Password</Text>
        <View style={inputStyle('confirmPassword')}>
          <Ionicons name="lock-closed-outline" size={17} color="#64748b" style={styles.icon} />
          <TextInput
            style={styles.input}
            value={form.confirmPassword}
            onChangeText={v => update('confirmPassword', v)}
            placeholder="Re-enter your password"
            placeholderTextColor="#94a3b8"
            secureTextEntry={!showConfirm}
            onFocus={() => setFocusedField('confirmPassword')}
            onBlur={() => setFocusedField(null)}
          />
          <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={19} color="#64748b" />
          </TouchableOpacity>
        </View>
        {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
      </View>

      {serverError ? (
        <View style={styles.serverErrorBox}>
          <Text style={styles.serverErrorText}>{serverError}</Text>
        </View>
      ) : null}

      {/* Register Button */}
      <TouchableOpacity
        style={[styles.registerBtn, loading && styles.btnDisabled]}
        onPress={handleRegister}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.registerBtnText}>Create Account →</Text>}
      </TouchableOpacity>

      {/* Back link */}
      <TouchableOpacity onPress={goBack} style={{ alignItems: 'center', marginTop: 12 }}>
        <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '400' }}>← Back to Step 1</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Progress indicator ─────────────────────────────────────────────────────
  const StepIndicator = (
    <View style={styles.stepRow}>
      <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
        {step > 1 ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={styles.stepDotText}>1</Text>}
      </View>
      <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
      <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
        <Text style={[styles.stepDotText, step >= 2 && { color: '#fff' }]}>2</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.stepLabel}>
          {step === 1 ? 'Personal Info' : 'Designation & Password'}
        </Text>
        <Text style={styles.stepSub}>Step {step} of 2</Text>
      </View>
    </View>
  );

  // ── Full form content ──────────────────────────────────────────────────────
  const FormContent = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scroll, isWeb && styles.scrollWeb]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets={true}
    >
      <View style={styles.formInner}>

        {/* Compact Header */}
        <View style={styles.header}>
          <Image source={require('../assets/madhura.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Madhura CRM Portal</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          {StepIndicator}
          <View style={styles.divider} />
          {step === 1 ? Step1 : Step2}
        </View>

        {/* Sign In Link */}
        <View style={styles.signinRow}>
          <Text style={styles.signinLabel}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/Login')} activeOpacity={0.7}>
            <Text style={styles.signinLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1B2B4B" />
      {isWeb ? (
        <View style={styles.webContainer}>
          <View style={styles.webLeftPane}>
            <View style={styles.webLeftContent}>
              <Image source={require('../assets/madhura.png')} style={{ width: 100, height: 100, marginBottom: 20, borderRadius: 14 }} resizeMode="contain" />
              <Text style={styles.webLeftTitle}>MADHURA</Text>
              <Text style={styles.webLeftBrand}>CRM</Text>
              <Text style={styles.webLeftSubtitle}>
                Become part of the most efficient field workforce.
              </Text>
              {['Quick & Easy Onboarding', 'Secure Data Protection', 'Instant Admin Access'].map(f => (
                <View key={f} style={styles.webFeatureRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#F5A623" />
                  <Text style={styles.webFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.webRightPane}>{FormContent}</View>
        </View>
      ) : (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          {FormContent}
        </KeyboardAvoidingView>
      )}

      {/* Admin Employee ID Modal */}
      <Modal
        visible={showAdminEmpIdModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="id-card-outline" size={28} color="#F5A623" />
            </View>
            <Text style={styles.modalTitle}>Enter Employee ID</Text>
            <Text style={styles.modalSub}>
              Please enter your employee ID to complete your admin profile. You can also do this later in your profile settings.
            </Text>
            
            <View style={[styles.inputContainer, { borderColor: '#e2e8f0', marginBottom: 20 }]}>
              <Ionicons name="pricetag-outline" size={17} color="#64748b" style={styles.icon} />
              <TextInput
                style={styles.input}
                value={adminEmpId}
                onChangeText={setAdminEmpId}
                placeholder="Admin Employee ID (5 digits)"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>

            <TouchableOpacity 
              style={styles.modalBtn} 
              onPress={() => {
                if (adminEmpId.trim() && !/^\d{5}$/.test(adminEmpId.trim())) {
                  Alert.alert('Invalid ID', 'Admin Employee ID must be exactly 5 digits.');
                  return;
                }
                handleAdminEmpIdSubmit();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnText}>Complete Setup →</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ alignItems: 'center', marginTop: 14 }}
              onPress={() => {
                setShowAdminEmpIdModal(false);
                router.replace('/AdminDashboard');
              }}
            >
              <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '400' }}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },

  // Web layout
  webContainer: { flex: 1, flexDirection: 'row' },
  webLeftPane: { flex: 1, backgroundColor: '#1B2B4B', justifyContent: 'center', alignItems: 'center', padding: 60 },
  webLeftContent: { maxWidth: 420 },
  webLeftTitle: { fontSize: 40, fontWeight: '500', color: '#fff', letterSpacing: 3, marginBottom: 4 },
  webLeftBrand: { fontSize: 13, fontWeight: '500', color: '#F5A623', letterSpacing: 1.5, marginBottom: 20 },
  webLeftSubtitle: { fontSize: 15, color: '#9EB4D0', lineHeight: 24, marginBottom: 28 },
  webFeatureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  webFeatureText: { fontSize: 14, color: '#D4E3F5', fontWeight: '500', marginLeft: 10 },
  webRightPane: { flex: 1, backgroundColor: '#f8fafc' },

  // Scroll
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  scrollWeb: { alignItems: 'center' },
  formInner: { width: '100%', maxWidth: 450 },

  // Header — compact
  header: { alignItems: 'center', marginBottom: 18 },
  logoImage: { width: 58, height: 58, marginBottom: 10, borderRadius: 14 },
  title: { fontSize: 20, fontWeight: '500', color: '#0f172a', marginBottom: 3 },
  subtitle: { fontSize: 12, color: '#64748b', textAlign: 'center' },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 4,
    boxShadow: '0px 8px 20px rgba(0,0,0,0.05)',
  },

  // Step indicator
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stepDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#1B2B4B' },
  stepDotText: { fontSize: 11, fontWeight: '500', color: '#94a3b8' },
  stepLine: { width: 32, height: 2, backgroundColor: '#e2e8f0', marginHorizontal: 6 },
  stepLineActive: { backgroundColor: '#F5A623' },
  stepLabel: { fontSize: 13, fontWeight: '500', color: '#0f172a' },
  stepSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 14 },

  // Fields
  fieldWrap: { marginBottom: 13 },
  label: { fontSize: 10, fontWeight: '500', color: '#64748b', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 12, height: 46,
  },
  inputFocused: { borderColor: '#F5A623', borderWidth: 2 },
  inputError: { borderColor: '#ef4444' },
  icon: { marginRight: 8 },
  input: { flex: 1, color: '#0f172a', fontSize: 14, height: '100%', outlineWidth: 0, outlineColor: 'transparent' },
  eyeBtn: { padding: 4 },
  errorText: { color: '#ef4444', fontSize: 11, fontWeight: '400', marginTop: 4, paddingLeft: 2 },

  // Role toggle
  roleToggle: {
    flexDirection: 'row', borderRadius: 14,
    backgroundColor: '#f1f5f9', padding: 3, marginTop: 6,
  },
  roleOption: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  roleOptionActive: { backgroundColor: '#1B2B4B' },
  roleOptionText: { color: '#475569', fontSize: 13, fontWeight: '500' },
  roleOptionTextActive: { color: '#fff' },

  // Buttons
  nextBtn: {
    backgroundColor: '#1B2B4B', borderRadius: 12,
    height: 48, alignItems: 'center', justifyContent: 'center',
    marginTop: 4, borderBottomWidth: 3, borderBottomColor: '#F5A623',
    elevation: 5,
  },
  nextBtnText: { color: '#fff', fontSize: 14, fontWeight: '500', letterSpacing: 0.4 },
  registerBtn: {
    backgroundColor: '#1B2B4B', borderRadius: 12,
    height: 48, alignItems: 'center', justifyContent: 'center',
    marginTop: 4, borderBottomWidth: 3, borderBottomColor: '#F5A623',
    elevation: 5,
  },
  btnDisabled: { opacity: 0.7 },
  registerBtnText: { color: '#fff', fontSize: 14, fontWeight: '500', letterSpacing: 0.4 },

  // Server error
  serverErrorBox: {
    backgroundColor: '#fee2e2', borderColor: '#fca5a5',
    borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12,
  },
  serverErrorText: { color: '#b91c1c', fontSize: 12, fontWeight: '400' },

  // Sign in
  signinRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  signinLabel: { color: '#64748b', fontSize: 13 },
  signinLink: { color: '#F5A623', fontSize: 13, fontWeight: '500' },

  // Modal
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
