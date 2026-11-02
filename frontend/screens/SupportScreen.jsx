import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppLayout, { playNotificationSound } from '../components/AppLayout';
import RaiseTicketModal from '../components/RaiseTicketModal';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { connectSocket } from '../utils/socket';

const NAVY = '#1B2B4B';
const GOLD = '#F5A623';

const STATUS_MAP = {
  OPEN: { label: 'Open', color: '#ef4444', bg: '#fee2e2' },
  IN_PROGRESS: { label: 'In Progress', color: '#3b82f6', bg: '#eff6ff' },
  RESOLVED: { label: 'Resolved', color: '#10b981', bg: '#ecfdf5' },
  CLOSED: { label: 'Closed', color: '#64748b', bg: '#f1f5f9' },
};

const PRIORITY_MAP = {
  LOW: { label: 'Low', color: '#3b82f6', bg: '#eff6ff' },
  MEDIUM: { label: 'Medium', color: '#f59e0b', bg: '#fef3c7' },
  HIGH: { label: 'High', color: '#f97316', bg: '#ffedd5' },
  URGENT: { label: 'Urgent', color: '#ef4444', bg: '#fee2e2' },
};

export default function SupportScreen() {
  const router = useRouter();
  const [role, setRole] = useState('Field Executive');
  const [tickets, setTickets] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('CRM');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [raiseModalOpen, setRaiseModalOpen] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Real-time socket events for mobile view
  useEffect(() => {
    let activeSock = null;
    let isMounted = true;

    const setupSocket = async () => {
      activeSock = await connectSocket();
      if (!activeSock || !isMounted) return;

      setIsSocketConnected(activeSock.connected);

      const onConnect = () => {
        if (!isMounted) return;
        setIsSocketConnected(true);
      };

      const onDisconnect = () => {
        if (isMounted) setIsSocketConnected(false);
      };

      const handleNewMessage = (payload) => {
        if (!payload || !isMounted) return;
        const { ticketId, ticketCode, message, ticket: updatedTicket } = payload;
        if (!message) return;

        playNotificationSound(message.sender === 'CLIENT' ? 'chat' : 'notification');

        Toast.show({
          type: 'info',
          text1: `New Message on ${ticketCode || 'Ticket'}`,
          text2: `${message.author_name || (message.sender === 'CLIENT' ? 'Client' : 'Agent')}: "${(message.message || '').substring(0, 50)}"`,
          visibilityTime: 4000,
        });

        setTickets((prev) => {
          const idx = prev.findIndex(
            (t) => String(t._id || t.id) === String(ticketId) || t.code === ticketCode
          );
          if (idx !== -1) {
            const copy = [...prev];
            const target = { ...copy[idx] };
            const msgs = target.messages || [];
            const exists = msgs.some((m) => String(m._id) === String(message._id));
            if (!exists) {
              target.messages = [...msgs, message];
            }
            if (updatedTicket) Object.assign(target, updatedTicket);
            target.updatedAt = message.created_at || new Date().toISOString();
            copy[idx] = target;
            return copy;
          } else if (updatedTicket) {
            return [updatedTicket, ...prev];
          }
          return prev;
        });
      };

      const handleTicketUpdated = (updatedTicket) => {
        if (!updatedTicket || !isMounted) return;
        const tid = String(updatedTicket._id || updatedTicket.id);
        setTickets((prev) =>
          prev.map((t) => (String(t._id || t.id) === tid || t.code === updatedTicket.code ? { ...t, ...updatedTicket } : t))
        );
      };

      const handleTicketCreated = (newTicket) => {
        if (!newTicket || !isMounted) return;
        setTickets((prev) => {
          const exists = prev.some(
            (t) => String(t._id || t.id) === String(newTicket._id || newTicket.id) || t.code === newTicket.code
          );
          if (exists) return prev;
          return [newTicket, ...prev];
        });

        playNotificationSound('notification');
        Toast.show({
          type: 'success',
          text1: `New Ticket: ${newTicket.code || 'TCK-NEW'}`,
          text2: `"${newTicket.title || ''}" was created`,
          visibilityTime: 4000,
        });
      };

      activeSock.on('connect', onConnect);
      activeSock.on('disconnect', onDisconnect);
      activeSock.on('new_ticket_message', handleNewMessage);
      activeSock.on('ticket_updated', handleTicketUpdated);
      activeSock.on('ticket_created', handleTicketCreated);

      return () => {
        activeSock.off('connect', onConnect);
        activeSock.off('disconnect', onDisconnect);
        activeSock.off('new_ticket_message', handleNewMessage);
        activeSock.off('ticket_updated', handleTicketUpdated);
        activeSock.off('ticket_created', handleTicketCreated);
      };
    };

    let cleanupFn = null;
    setupSocket().then((fn) => {
      cleanupFn = fn;
    });

    return () => {
      isMounted = false;
      if (cleanupFn) cleanupFn();
    };
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        setRole(JSON.parse(stored).role || 'Field Executive');
      }
    };
    loadUser();
    fetchTickets();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await api.get('/onboarding');
      setClients(res.data?.data || []);
    } catch (_) {}
  };

  const fetchTickets = useCallback(async () => {
    try {
      const res = await api.get('/v1/tickets');
      setTickets(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to fetch tickets:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load tickets' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const getClientName = (ticket) => {
    const cid = ticket.client_id?._id || ticket.client_id || ticket.clientId;
    if (ticket.client_id?.businessName) return ticket.client_id.businessName;
    const match = clients.find((c) => String(c._id || c.id) === String(cid));
    return match ? (match.businessName || match.name) : 'Client';
  };

  const isStaffCreator = (ticket) => {
    return (
      ticket.source === 'CRM' ||
      ticket.creator?.email?.toLowerCase().includes('madhuratech.com') ||
      ticket.creator?.name === 'Administrator' ||
      ticket.creator?.name?.toLowerCase().includes('admin')
    );
  };

  const crmTickets = tickets.filter(isStaffCreator);
  const portalTickets = tickets.filter((t) => !isStaffCreator(t));
  const baseTickets = sourceFilter === 'CRM' ? crmTickets : sourceFilter === 'PORTAL' ? portalTickets : tickets;

  const filteredTickets = baseTickets.filter((t) => {
    const s = (t.status || 'OPEN').toUpperCase();
    if (statusFilter !== 'ALL' && s !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const code = (t.code || '').toLowerCase();
      const title = (t.title || '').toLowerCase();
      const clientName = getClientName(t).toLowerCase();
      return code.includes(q) || title.includes(q) || clientName.includes(q);
    }
    return true;
  });

  const adminRoles = ['Admin', 'Project Manager', 'Team Lead', 'Managing Director MD'];
  const backRoute = adminRoles.includes(role) ? '/AdminDashboard' : '/Dashboard';

  return (
    <AppLayout currentScreen="Support" role={role} scrollable={true}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push(backRoute)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerTitle}>CRM Tickets</Text>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isSocketConnected ? '#10b981' : '#94a3b8' },
                ]}
              />
            </View>
            <Text style={styles.headerSub}>
              {isSocketConnected ? 'Real-Time Connected' : 'Manage & raise CRM support tickets'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setRaiseModalOpen(true)}
            style={styles.raiseBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.raiseBtnText}>Raise</Text>
          </TouchableOpacity>
        </View>

        {/* Source Filter Switcher */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => setSourceFilter('CRM')}
            style={[
              { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
              sourceFilter === 'CRM' && { backgroundColor: NAVY }
            ]}
          >
            <Text style={[{ fontSize: 12, fontWeight: '700', color: '#475569' }, sourceFilter === 'CRM' && { color: '#fff' }]}>
              CRM ({crmTickets.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSourceFilter('PORTAL')}
            style={[
              { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
              sourceFilter === 'PORTAL' && { backgroundColor: NAVY }
            ]}
          >
            <Text style={[{ fontSize: 12, fontWeight: '700', color: '#475569' }, sourceFilter === 'PORTAL' && { color: '#fff' }]}>
              Portal ({portalTickets.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSourceFilter('ALL')}
            style={[
              { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
              sourceFilter === 'ALL' && { backgroundColor: NAVY }
            ]}
          >
            <Text style={[{ fontSize: 12, fontWeight: '700', color: '#475569' }, sourceFilter === 'ALL' && { color: '#fff' }]}>
              All ({tickets.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tickets by code or title..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Status Filter Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScroll}>
          {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => {
            const active = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                onPress={() => setStatusFilter(st)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {st === 'ALL' ? 'All' : st === 'IN_PROGRESS' ? 'In Progress' : st}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List */}
        {loading ? (
          <View style={{ paddingVertical: 50, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={GOLD} />
            <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>Loading tickets...</Text>
          </View>
        ) : filteredTickets.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="ticket-outline" size={44} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No tickets found</Text>
            <Text style={styles.emptySub}>Tap 'Raise' to submit a new inquiry.</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 10 }}>
            {filteredTickets.map((ticket) => {
              const st = STATUS_MAP[(ticket.status || 'OPEN').toUpperCase()] || STATUS_MAP.OPEN;
              const pr = PRIORITY_MAP[(ticket.priority || 'MEDIUM').toUpperCase()] || PRIORITY_MAP.MEDIUM;
              return (
                <View key={ticket._id || ticket.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.cardCode}>{ticket.code || 'TCK-NEW'}</Text>
                      {isStaffCreator(ticket) ? (
                        <View style={[styles.badge, { backgroundColor: '#f3e8ff' }]}>
                          <Text style={[styles.badgeText, { color: '#7e22ce' }]}>CRM</Text>
                        </View>
                      ) : (
                        <View style={[styles.badge, { backgroundColor: '#eff6ff' }]}>
                          <Text style={[styles.badgeText, { color: '#1d4ed8' }]}>Portal</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View style={[styles.badge, { backgroundColor: pr.bg }]}>
                        <Text style={[styles.badgeText, { color: pr.color }]}>{pr.label}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: st.bg }]}>
                        <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.cardTitle}>{ticket.title}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>{ticket.description}</Text>
                  <View style={styles.cardBottom}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="business-outline" size={13} color="#64748b" />
                      <Text style={styles.clientText}>{getClientName(ticket)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="chatbubbles-outline" size={13} color="#64748b" />
                      <Text style={styles.clientText}>{(ticket.messages || []).length}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <RaiseTicketModal
          visible={raiseModalOpen}
          onClose={() => setRaiseModalOpen(false)}
          onSuccess={() => fetchTickets()}
        />
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 2,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  raiseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: NAVY,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  raiseBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  statusScroll: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: NAVY,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 10,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 8,
  },
  clientText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
});

