import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const NAVY = '#1B2B4B';
const GOLD = '#F5A623';

const CATEGORIES = [
  { label: 'Technical', value: 'TECHNICAL' },
  { label: 'Billing', value: 'BILLING' },
  { label: 'Account', value: 'ACCOUNT' },
  { label: 'General', value: 'GENERAL' },
  { label: 'Feature Request', value: 'FEATURE_REQUEST' },
];

const PRIORITIES = [
  { label: 'Low', value: 'LOW', color: '#3b82f6', bg: '#eff6ff' },
  { label: 'Medium', value: 'MEDIUM', color: '#f59e0b', bg: '#fef3c7' },
  { label: 'High', value: 'HIGH', color: '#f97316', bg: '#ffedd5' },
  { label: 'Urgent', value: 'URGENT', color: '#ef4444', bg: '#fee2e2' },
];

export default function RaiseTicketModal({
  visible,
  onClose,
  onSuccess,
  defaultClientId,
  defaultProjectId,
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('TECHNICAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [clientId, setClientId] = useState(defaultClientId || '');
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [description, setDescription] = useState('');

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (visible) {
      loadInitialData();
    }
  }, [visible]);

  useEffect(() => {
    if (defaultClientId) setClientId(defaultClientId);
    if (defaultProjectId) setProjectId(defaultProjectId);
  }, [defaultClientId, defaultProjectId]);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }

      const [clientsRes, projectsRes] = await Promise.all([
        api.get('/onboarding').catch(() => ({ data: { data: [] } })),
        api.get('/projects').catch(() => ({ data: { data: [] } })),
      ]);

      const clientList = clientsRes.data?.data || clientsRes.data || [];
      const projectList = projectsRes.data?.data || projectsRes.data || [];

      setClients(Array.isArray(clientList) ? clientList : []);
      setProjects(Array.isArray(projectList) ? projectList : []);

      if (!clientId && clientList.length > 0) {
        setClientId(clientList[0]._id || clientList[0].id || '');
      }
    } catch (err) {
      console.warn('Failed to load clients/projects for ticket modal:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setCategory('TECHNICAL');
    setPriority('MEDIUM');
    setClientId(defaultClientId || (clients[0]?._id ?? ''));
    setProjectId(defaultProjectId || '');
    setDescription('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a ticket title.' });
      return;
    }
    if (!clientId) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please select a client.' });
      return;
    }
    if (!description.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please describe the issue.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        client_id: clientId,
        project_id: projectId || undefined,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        source: 'CRM',
        author_name: currentUser?.name || 'Staff User',
        author_email: currentUser?.email || '',
      };

      const res = await api.post('/v1/tickets', payload);

      Toast.show({
        type: 'success',
        text1: 'Ticket Raised',
        text2: `Ticket ${res.data?.data?.code || ''} raised successfully in CRM`,
      });

      handleReset();
      onClose();
      if (onSuccess) {
        onSuccess(res.data?.data);
      } else {
        router.push('/Support');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit ticket';
      Toast.show({ type: 'error', text1: 'Submission Failed', text2: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  const filteredProjects = projects.filter((p) => {
    if (!clientId) return true;
    const pClient = p.client?._id || p.client || p.clientId;
    return String(pClient) === String(clientId);
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIcon}>
                <Ionicons name="ticket" size={20} color={NAVY} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Create Support Ticket</Text>
                <Text style={styles.headerSub}>Submit issue directly to the live CRM support queue</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {loadingData ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={GOLD} />
                <Text style={{ marginTop: 10, fontSize: 13, color: '#64748b' }}>Loading client details...</Text>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                {/* Subject / Title */}
                <View>
                  <Text style={styles.fieldLabel}>
                    Subject / Title <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Short issue summary (e.g. GST invoice discrepancy)"
                    placeholderTextColor="#94a3b8"
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>

                {/* Grid: Category & Priority */}
                <View style={styles.gridRow}>
                  {/* Category */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>
                      Category <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    {Platform.OS === 'web' ? (
                      <View style={styles.selectWrapper}>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          style={webSelectStyle}
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </View>
                    ) : (
                      <View style={styles.pillRow}>
                        {CATEGORIES.map((cat) => (
                          <TouchableOpacity
                            key={cat.value}
                            onPress={() => setCategory(cat.value)}
                            style={[styles.pill, category === cat.value && styles.pillActive]}
                          >
                            <Text style={[styles.pillText, category === cat.value && styles.pillTextActive]}>
                              {cat.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Priority */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>
                      Priority <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    {Platform.OS === 'web' ? (
                      <View style={styles.selectWrapper}>
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                          style={webSelectStyle}
                        >
                          {PRIORITIES.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </View>
                    ) : (
                      <View style={styles.pillRow}>
                        {PRIORITIES.map((p) => (
                          <TouchableOpacity
                            key={p.value}
                            onPress={() => setPriority(p.value)}
                            style={[
                              styles.pill,
                              priority === p.value && { backgroundColor: p.color, borderColor: p.color },
                            ]}
                          >
                            <Text
                              style={[
                                styles.pillText,
                                priority === p.value && { color: '#fff', fontWeight: '700' },
                              ]}
                            >
                              {p.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* Grid: Client & Project */}
                <View style={styles.gridRow}>
                  {/* Client */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>
                      Client <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    {Platform.OS === 'web' ? (
                      <View style={styles.selectWrapper}>
                        <select
                          value={clientId}
                          onChange={(e) => {
                            setClientId(e.target.value);
                            setProjectId('');
                          }}
                          style={webSelectStyle}
                        >
                          <option value="" disabled>Select Client</option>
                          {clients.map((c) => (
                            <option key={c._id || c.id} value={c._id || c.id}>
                              {c.businessName || c.name || 'Unnamed Client'}
                            </option>
                          ))}
                        </select>
                      </View>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                        {clients.map((c) => {
                          const cid = c._id || c.id;
                          const active = clientId === cid;
                          return (
                            <TouchableOpacity
                              key={cid}
                              onPress={() => {
                                setClientId(cid);
                                setProjectId('');
                              }}
                              style={[styles.pill, active && styles.pillActive, { marginRight: 6 }]}
                            >
                              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                                {c.businessName || c.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>

                  {/* Project (Optional) */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Project (Optional)</Text>
                    {Platform.OS === 'web' ? (
                      <View style={styles.selectWrapper}>
                        <select
                          value={projectId}
                          onChange={(e) => setProjectId(e.target.value)}
                          style={webSelectStyle}
                        >
                          <option value="">No Project</option>
                          {filteredProjects.map((p) => (
                            <option key={p._id || p.id} value={p._id || p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </View>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                          onPress={() => setProjectId('')}
                          style={[styles.pill, !projectId && styles.pillActive, { marginRight: 6 }]}
                        >
                          <Text style={[styles.pillText, !projectId && styles.pillTextActive]}>None</Text>
                        </TouchableOpacity>
                        {filteredProjects.map((p) => {
                          const pid = p._id || p.id;
                          const active = projectId === pid;
                          return (
                            <TouchableOpacity
                              key={pid}
                              onPress={() => setProjectId(pid)}
                              style={[styles.pill, active && styles.pillActive, { marginRight: 6 }]}
                            >
                              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                                {p.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                </View>

                {/* Description */}
                <View>
                  <Text style={styles.fieldLabel}>
                    Description <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Provide details about what happened, steps to reproduce, or requested action..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.cancelBtn}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              disabled={submitting || loadingData}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={16} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit Ticket</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const webSelectStyle = {
  width: '100%',
  height: 42,
  paddingLeft: 12,
  paddingRight: 12,
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  fontSize: 14,
  color: '#0f172a',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(4px)' } : {}),
  },
  modalCard: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: '90%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fafbfc',
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  body: {
    padding: 22,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
  },
  gridRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
  },
  selectWrapper: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  pillActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  pillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fafbfc',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: NAVY,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});

