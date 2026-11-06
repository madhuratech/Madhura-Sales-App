import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import AppLayout, { playNotificationSound } from '../components/AppLayout';
import RaiseTicketModal from '../components/RaiseTicketModal';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { connectSocket, getSocket } from '../utils/socket';
import {
  Search,
  Plus,
  RefreshCw,
  ArrowLeft,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Building2,
  FolderKanban,
  Send,
  X,
  User,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Check,
  CheckCheck,
  RotateCcw,
  Wifi,
  WifiOff,
  Lock,
  Loader2,
  Paperclip,
  FileText,
  Download,
} from 'lucide-react';

const NAVY = '#1B2B4B';
const GOLD = '#F5A623';

const STATUS_CONFIG = {
  OPEN: { label: 'Open', color: '#ef4444', bg: '#fee2e2', border: '#fecaca' },
  IN_PROGRESS: { label: 'In Progress', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  RESOLVED: { label: 'Resolved', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  CLOSED: { label: 'Closed', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
};

const PRIORITY_CONFIG = {
  LOW: { label: 'Low', color: '#3b82f6', bg: '#eff6ff' },
  MEDIUM: { label: 'Medium', color: '#f59e0b', bg: '#fef3c7' },
  HIGH: { label: 'High', color: '#f97316', bg: '#ffedd5' },
  URGENT: { label: 'Urgent', color: '#ef4444', bg: '#fee2e2' },
};

const ADMIN_ROLES = [
  'Super Admin',
  'Admin',
  'Managing Director MD',
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
];

const getStoredUser = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem('user');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
  }
  return null;
};

const resolveAttachmentUrl = (url) => {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (api.defaults.baseURL || 'http://localhost:5005/api').replace(/\/api\/?$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function SupportScreenWeb() {
  const router = useRouter();
  const cachedUser = useRef(getStoredUser()).current;
  const [role, setRole] = useState(() => cachedUser?.role || 'Field Executive');
  const [currentUser, setCurrentUser] = useState(() => cachedUser);
  const [tickets, setTickets] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [staffUsers, setStaffUsers] = useState([]);
  const [raiseModalOpen, setRaiseModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef(null);
  const isAdmin =
    ADMIN_ROLES.includes(role) ||
    Boolean(currentUser?.isAdmin) ||
    (typeof role === 'string' && role.toLowerCase().includes('admin'));

  // Real-time socket states & refs
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);
  const activeTicketRef = useRef(activeTicket);
  const typingTimerRef = useRef(null);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    activeTicketRef.current = activeTicket;
    if (activeTicket) {
      setTimeout(() => scrollToBottom('auto'), 50);
    }
  }, [activeTicket, scrollToBottom]);

  useEffect(() => {
    const loadUser = async () => {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        setRole(u.role || 'Field Executive');
        setCurrentUser(u);
      }
    };
    loadUser();
    fetchTickets();
    fetchClients();
    fetchStaffUsers();
  }, []);

  const fetchStaffUsers = async () => {
    try {
      const res = await api.get('/users');
      const list = res.data?.data || res.data || [];
      setStaffUsers(Array.isArray(list) ? list : []);
    } catch (_) {}
  };

  const fetchClients = async () => {
    try {
      const res = await api.get('/onboarding');
      const list = res.data?.data || res.data || [];
      setClients(Array.isArray(list) ? list : []);
    } catch (_) {}
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/tickets?source=CRM');
      const data = res.data?.data || [];
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to fetch tickets:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load support tickets' });
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Ticket Room Subscription (join/leave active ticket) ───────────────────
  useEffect(() => {
    if (!activeTicket) return;
    const tid = String(activeTicket._id || activeTicket.id || '');
    const code = activeTicket.code;

    let subSock = null;
    let isCancelled = false;

    const doJoin = async () => {
      subSock = await connectSocket();
      if (!subSock || isCancelled) return;

      const emitRooms = () => {
        if (tid) subSock.emit('join_ticket', tid);
        if (code) subSock.emit('join_ticket', code);
      };

      if (subSock.connected) {
        emitRooms();
      } else {
        subSock.once('connect', emitRooms);
      }
    };

    doJoin();

    return () => {
      isCancelled = true;
      if (subSock && subSock.connected) {
        if (tid) subSock.emit('leave_ticket', tid);
        if (code) subSock.emit('leave_ticket', code);
      }
    };
  }, [activeTicket?._id, activeTicket?.id, activeTicket?.code]);

  // ── Real-Time Socket Events Listener ─────────────────────────────────────
  useEffect(() => {
    let activeSock = null;
    let isMounted = true;

    const setupSocket = async () => {
      activeSock = await connectSocket();
      if (!activeSock || !isMounted) return;

      setIsSocketConnected(activeSock.connected);

      // Join active ticket immediately if already connected
      if (activeSock.connected && activeTicketRef.current) {
        const tid = String(activeTicketRef.current._id || activeTicketRef.current.id || '');
        const code = activeTicketRef.current.code;
        if (tid) activeSock.emit('join_ticket', tid);
        if (code) activeSock.emit('join_ticket', code);
      }

      const onConnect = () => {
        if (!isMounted) return;
        setIsSocketConnected(true);
        if (activeTicketRef.current) {
          const tid = String(activeTicketRef.current._id || activeTicketRef.current.id || '');
          const code = activeTicketRef.current.code;
          if (tid) activeSock.emit('join_ticket', tid);
          if (code) activeSock.emit('join_ticket', code);
        }
      };

      const onDisconnect = () => {
        if (isMounted) setIsSocketConnected(false);
      };

      // 1. New Ticket Message (from Client Portal or another CRM agent)
      const handleNewMessage = (payload) => {
        if (!payload || !isMounted) return;
        const { ticketId, ticketCode, message, ticket: updatedTicket, clientMessageId } = payload;
        if (!message) return;

        const currentActive = activeTicketRef.current;
        const isActive =
          currentActive &&
          (String(currentActive._id || currentActive.id) === String(ticketId) ||
            currentActive.code === ticketCode);

        if (isActive) {
          setActiveTicket((prev) => {
            if (!prev) return prev;
            const currentMsgs = prev.messages || [];

            // Check if matching message exists (by server _id or clientMessageId)
            const existingIdx = currentMsgs.findIndex(
              (m) =>
                (message._id && m._id && String(m._id) === String(message._id)) ||
                (clientMessageId && m.clientMessageId === clientMessageId) ||
                (m.clientMessageId && message.clientMessageId && m.clientMessageId === message.clientMessageId)
            );

            let newMessages;
            if (existingIdx !== -1) {
              newMessages = [...currentMsgs];
              newMessages[existingIdx] = { ...message, status: 'sent' };
            } else {
              newMessages = [...currentMsgs, { ...message, status: 'sent' }];
            }

            newMessages.sort(
              (a, b) =>
                new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0)
            );

            return {
              ...prev,
              ...(updatedTicket || {}),
              messages: newMessages,
              status: updatedTicket?.status || prev.status,
            };
          });

          setTimeout(() => scrollToBottom('smooth'), 50);

          if (message.sender === 'CLIENT') {
            playNotificationSound('chat');
          }
        } else {
          // If message is from client and user is not in this ticket, play notification & toast
          if (message.sender === 'CLIENT') {
            playNotificationSound('notification');
            Toast.show({
              type: 'info',
              text1: `New Message on ${ticketCode || 'Ticket'}`,
              text2: `${message.author_name || 'Client'}: "${(message.message || '').substring(0, 60)}"`,
              visibilityTime: 5000,
              onPress: () => {
                if (updatedTicket) setActiveTicket(updatedTicket);
              },
            });
          }
        }

        // Always update tickets table list state
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
            if (updatedTicket) {
              Object.assign(target, updatedTicket);
            }
            target.updatedAt = message.created_at || new Date().toISOString();
            copy[idx] = target;
            return copy;
          } else if (updatedTicket) {
            return [updatedTicket, ...prev];
          }
          return prev;
        });
      };

      // 2. Ticket Updated (Status, Priority, Assignee)
      const handleTicketUpdated = (updatedTicket) => {
        if (!updatedTicket || !isMounted) return;
        const tid = String(updatedTicket._id || updatedTicket.id);

        setTickets((prev) =>
          prev.map((t) => (String(t._id || t.id) === tid || t.code === updatedTicket.code ? { ...t, ...updatedTicket } : t))
        );

        if (
          activeTicketRef.current &&
          (String(activeTicketRef.current._id || activeTicketRef.current.id) === tid ||
            activeTicketRef.current.code === updatedTicket.code)
        ) {
          setActiveTicket((prev) => ({ ...prev, ...updatedTicket }));
        }
      };

      // 3. New Ticket Created (CRM Only)
      const handleTicketCreated = (newTicket) => {
        if (!newTicket || !isMounted) return;
        if (newTicket.source && newTicket.source !== 'CRM') return;
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
          text2: `"${newTicket.title || ''}" was raised`,
          visibilityTime: 5000,
          onPress: () => setActiveTicket(newTicket),
        });
      };

      // 4. Typing Indicator
      const handleTicketTyping = ({ ticketId, userName, isTyping }) => {
        if (!isMounted) return;
        if (
          activeTicketRef.current &&
          String(activeTicketRef.current._id || activeTicketRef.current.id) === String(ticketId)
        ) {
          setTypingUser(isTyping ? userName : null);
        }
      };

      activeSock.on('connect', onConnect);
      activeSock.on('disconnect', onDisconnect);
      activeSock.on('new_ticket_message', handleNewMessage);
      activeSock.on('ticket_message', handleNewMessage);
      activeSock.on('ticket_updated', handleTicketUpdated);
      activeSock.on('ticket_created', handleTicketCreated);
      activeSock.on('ticket_typing', handleTicketTyping);
    };

    setupSocket();

    return () => {
      isMounted = false;
      if (activeSock) {
        activeSock.off('connect');
        activeSock.off('disconnect');
        activeSock.off('new_ticket_message');
        activeSock.off('ticket_message');
        activeSock.off('ticket_updated');
        activeSock.off('ticket_created');
        activeSock.off('ticket_typing');
      }
    };
  }, [scrollToBottom]);

  // ── Typing Indicator Dispatcher ───────────────────────────────────────────
  const handleTypingChange = (text) => {
    setReplyText(text);
    if (!activeTicket) return;
    const sock = getSocket();
    if (sock && sock.connected) {
      sock.emit('ticket_typing', {
        ticketId: activeTicket._id || activeTicket.id,
        userName: currentUser?.name || 'Support Agent',
        isTyping: true,
      });

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        sock.emit('ticket_typing', {
          ticketId: activeTicket._id || activeTicket.id,
          userName: currentUser?.name || 'Support Agent',
          isTyping: false,
        });
      }, 1500);
    }
  };

  // ── Document Selection & Removal ──────────────────────────────────────────
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validFiles = files.filter((f) => {
      if (f.size > 15 * 1024 * 1024) {
        Toast.show({ type: 'error', text1: 'File Too Large', text2: `${f.name} exceeds 15MB limit.` });
        return false;
      }
      return true;
    });

    const mapped = validFiles.map((f) => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
    }));

    setAttachedFiles((prev) => [...prev, ...mapped]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Post Reply (Optimistic Rendering + Sending/Sent/Failed States + Document Upload) ────────
  const handlePostReply = async (retryMsg = null) => {
    const textToSend = (retryMsg ? retryMsg.message : replyText).trim();
    const filesToUpload = retryMsg?.attachedFiles || attachedFiles;

    if (!textToSend && filesToUpload.length === 0) return;
    if (!activeTicket) return;

    const clientMsgId =
      retryMsg?.clientMessageId || `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setSendingReply(true);

    let uploadedAttachments = retryMsg?.attachments || [];
    if (filesToUpload.length > 0 && uploadedAttachments.length === 0) {
      setUploadingAttachment(true);
      try {
        for (const item of filesToUpload) {
          const formData = new FormData();
          formData.append('file', item.file);
          const uploadRes = await api.post(`/v1/tickets/${activeTicket._id || activeTicket.id}/attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (uploadRes.data?.data) {
            uploadedAttachments.push(uploadRes.data.data);
          }
        }
      } catch (uploadErr) {
        console.error('Failed to upload document:', uploadErr);
        Toast.show({ type: 'error', text1: 'Upload Error', text2: 'Failed to upload document. Please retry.' });
        setUploadingAttachment(false);
        setSendingReply(false);
        return;
      } finally {
        setUploadingAttachment(false);
      }
    }

    const optimisticMsg = {
      _id: clientMsgId,
      clientMessageId: clientMsgId,
      sender: 'STAFF',
      author_name: currentUser?.name || 'Support Staff',
      author_email: currentUser?.email || '',
      message: textToSend || (uploadedAttachments.length === 1 ? `Attached document: ${uploadedAttachments[0].name}` : `Attached ${uploadedAttachments.length} documents`),
      internal: retryMsg ? retryMsg.internal : isInternal,
      attachments: uploadedAttachments,
      attachedFiles: filesToUpload,
      created_at: new Date().toISOString(),
      status: 'sending', // 'sending' | 'sent' | 'failed'
    };

    // Optimistically update conversation immediately
    setActiveTicket((prev) => {
      if (!prev) return prev;
      const msgs = prev.messages || [];
      if (retryMsg) {
        return {
          ...prev,
          messages: msgs.map((m) => (m.clientMessageId === clientMsgId ? optimisticMsg : m)),
        };
      }
      return {
        ...prev,
        messages: [...msgs, optimisticMsg],
      };
    });

    if (!retryMsg) {
      setReplyText('');
      setAttachedFiles([]);
    }
    setTimeout(() => scrollToBottom('smooth'), 30);

    try {
      const res = await api.post(`/v1/tickets/${activeTicket._id || activeTicket.id}/messages`, {
        message: textToSend || (uploadedAttachments.length === 1 ? `Attached document: ${uploadedAttachments[0].name}` : `Attached ${uploadedAttachments.length} documents`),
        sender_type: 'STAFF',
        author_name: currentUser?.name || 'Support Staff',
        author_email: currentUser?.email || '',
        internal: retryMsg ? retryMsg.internal : isInternal,
        clientMessageId: clientMsgId,
        attachments: uploadedAttachments,
      });

      const updated = res.data?.data || res.data;

      if (updated) {
        setActiveTicket(updated);

        setTickets((prev) =>
          prev.map((t) => ((t._id || t.id) === (updated._id || updated.id) ? updated : t))
        );
      }
      setTimeout(() => scrollToBottom('smooth'), 50);
    } catch (err) {
      console.warn('Failed to send reply:', err);
      setActiveTicket((prev) => {
        if (!prev) return prev;
        const msgs = (prev.messages || []).map((m) =>
          m.clientMessageId === clientMsgId ? { ...m, status: 'failed' } : m
        );
        return { ...prev, messages: msgs };
      });
      Toast.show({
        type: 'error',
        text1: 'Reply Failed',
        text2: 'Could not deliver response. Click Retry to re-send.',
      });
    } finally {
      setSendingReply(false);
      setUploadingAttachment(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!isAdmin) {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Only administrators can update ticket status.' });
      return;
    }
    if (!activeTicket) return;
    try {
      const res = await api.patch(`/v1/tickets/${activeTicket._id || activeTicket.id}`, {
        status: newStatus,
      });
      const updated = res.data?.data || res.data;
      if (updated) {
        setActiveTicket(updated);
        setTickets((prev) =>
          prev.map((t) => ((t._id || t.id) === (updated._id || updated.id) ? updated : t))
        );
      }
      Toast.show({ type: 'success', text1: 'Status Updated', text2: `Status changed to ${newStatus}` });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.response?.data?.error?.message || 'Failed to update ticket status' });
    }
  };

  const handlePriorityChange = async (newPriority) => {
    if (!isAdmin) {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Only administrators can update ticket priority.' });
      return;
    }
    if (!activeTicket) return;
    try {
      const res = await api.patch(`/v1/tickets/${activeTicket._id || activeTicket.id}`, {
        priority: newPriority,
      });
      const updated = res.data?.data || res.data;
      if (updated) {
        setActiveTicket(updated);
        setTickets((prev) =>
          prev.map((t) => ((t._id || t.id) === (updated._id || updated.id) ? updated : t))
        );
      }
      Toast.show({ type: 'success', text1: 'Priority Updated', text2: `Priority set to ${newPriority}` });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.response?.data?.error?.message || 'Failed to update priority' });
    }
  };

  const handleAssigneeChange = async (newAssigneeId) => {
    if (!isAdmin) {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Only administrators can reassign tickets.' });
      return;
    }
    if (!activeTicket) return;
    try {
      const res = await api.patch(`/v1/tickets/${activeTicket._id || activeTicket.id}`, {
        assignee_id: newAssigneeId || null,
      });
      const updated = res.data?.data || res.data;
      if (updated) {
        setActiveTicket(updated);
        setTickets((prev) =>
          prev.map((t) => ((t._id || t.id) === (updated._id || updated.id) ? updated : t))
        );
      }
      Toast.show({ type: 'success', text1: 'Assignee Updated', text2: 'Ticket assignment updated' });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.response?.data?.error?.message || 'Failed to update ticket assignee' });
    }
  };

  const getClientName = (ticket) => {
    const cid = ticket.client_id?._id || ticket.client_id || ticket.clientId;
    if (ticket.client_id?.businessName) return ticket.client_id.businessName;
    const match = clients.find((c) => String(c._id || c.id) === String(cid));
    return match ? (match.businessName || match.name) : 'General Client';
  };

  const isStaffCreator = (ticket) => {
    return (
      ticket.source === 'CRM' ||
      ticket.creator?.email?.toLowerCase().includes('madhuratech.com') ||
      ticket.creator?.name === 'Administrator' ||
      ticket.creator?.name?.toLowerCase().includes('admin')
    );
  };

  const baseTickets = tickets.filter(isStaffCreator);

  // Metrics based on active CRM tickets
  const totalCount = baseTickets.length;
  const openCount = baseTickets.filter((t) => (t.status || 'OPEN').toUpperCase() === 'OPEN').length;
  const inProgressCount = baseTickets.filter((t) => (t.status || '').toUpperCase() === 'IN_PROGRESS').length;
  const resolvedCount = baseTickets.filter((t) => ['RESOLVED', 'CLOSED'].includes((t.status || '').toUpperCase())).length;

  const filteredTickets = baseTickets.filter((t) => {
    if (clientFilter !== 'ALL') {
      const cid = t.client_id?._id || t.client_id || t.clientId;
      if (String(cid) !== String(clientFilter)) return false;
    }

    const s = (t.status || 'OPEN').toUpperCase();
    if (statusFilter !== 'ALL' && s !== statusFilter) return false;

    const p = (t.priority || 'MEDIUM').toUpperCase();
    if (priorityFilter !== 'ALL' && p !== priorityFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const code = (t.code || '').toLowerCase();
      const title = (t.title || '').toLowerCase();
      const clientName = getClientName(t).toLowerCase();
      const clientEmail = (t.client_id?.email || t.creator?.email || '').toLowerCase();
      return code.includes(q) || title.includes(q) || clientName.includes(q) || clientEmail.includes(q);
    }
    return true;
  });

  const adminRoles = ['Admin', 'Project Manager', 'Team Lead', 'Managing Director MD'];
  const backRoute = adminRoles.includes(role) ? '/AdminDashboard' : '/Dashboard';

  return (
    <AppLayout currentScreen="Support" role={role} scrollable={true}>
      <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(backRoute)}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">CRM Tickets</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Live CRM
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    isSocketConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {isSocketConnected ? 'Live Real-Time' : 'Connecting...'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Manage, track, and raise CRM support tickets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchTickets}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-sm font-semibold transition"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setRaiseModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B2B4B] hover:bg-[#243454] text-white text-sm font-bold shadow-md shadow-slate-900/10 transition cursor-pointer"
            >
              <Plus size={18} className="text-[#F5A623]" />
              <span>Raise Ticket</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Tickets</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <MessageSquare size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-500 uppercase tracking-wide">Open Queue</p>
              <p className="text-2xl font-extrabold text-rose-600 mt-1">{openCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertCircle size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">In Progress</p>
              <p className="text-2xl font-extrabold text-blue-600 mt-1">{inProgressCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock3 size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">Resolved</p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">{resolvedCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search by code, subject, or client name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1B2B4B] focus:ring-1 focus:ring-[#1B2B4B] text-slate-900 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st === 'IN_PROGRESS' ? 'In Progress' : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Priority filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Client Filter Dropdown */}
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 cursor-pointer max-w-[170px] truncate"
            >
              <option value="ALL">All Clients ({clients.length})</option>
              {clients.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.businessName || c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tickets Table / List */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="animate-spin mx-auto text-[#F5A623] mb-3" size={28} />
              <p className="text-sm text-slate-500 font-medium">Fetching support tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="py-20 text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 mx-auto flex items-center justify-center mb-4">
                <MessageSquare size={30} />
              </div>
              <h3 className="text-base font-bold text-slate-800">No CRM tickets found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                {search || statusFilter !== 'ALL'
                  ? 'No tickets match the selected filters. Try resetting the filter.'
                  : 'No CRM tickets raised yet. Click "Raise Ticket" to submit an issue or inquiry.'}
              </p>
              <button
                onClick={() => setRaiseModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B2B4B] text-white text-xs font-bold shadow-md hover:bg-[#243454] transition cursor-pointer"
              >
                <Plus size={16} className="text-[#F5A623]" />
                Raise Support Ticket
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Subject & Details</th>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Raised By</th>
                    <th className="px-6 py-4">Priority</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Messages</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTickets.map((ticket) => {
                    const st = STATUS_CONFIG[(ticket.status || 'OPEN').toUpperCase()] || STATUS_CONFIG.OPEN;
                    const pr = PRIORITY_CONFIG[(ticket.priority || 'MEDIUM').toUpperCase()] || PRIORITY_CONFIG.MEDIUM;
                    const msgCount = (ticket.messages || []).length;
                    const clientName = getClientName(ticket);
                    const creatorName = ticket.creator?.name || ticket.created_by?.name || 'CRM Staff';

                    return (
                      <tr
                        key={ticket._id || ticket.id || ticket.code}
                        className="hover:bg-slate-50/70 transition cursor-pointer"
                        onClick={() => setActiveTicket(ticket)}
                      >
                        <td className="px-6 py-4 font-mono font-bold text-xs text-slate-900">
                          {ticket.code || 'TCK-NEW'}
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <p className="font-semibold text-slate-900 truncate">{ticket.title}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{ticket.description}</p>
                          <span className="inline-block mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {ticket.category || 'GENERAL'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 size={15} className="text-slate-400" />
                            <span className="font-medium text-slate-800 text-xs">{clientName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            <User size={13} className="text-slate-400" />
                            <span>{creatorName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                            style={{ backgroundColor: pr.bg, color: pr.color }}
                          >
                            {pr.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border"
                            style={{ backgroundColor: st.bg, color: st.color, borderColor: st.border }}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <MessageSquare size={14} className="text-slate-400" />
                            <span>{msgCount}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTicket(ticket);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#1B2B4B] hover:text-white text-slate-700 text-xs font-bold transition cursor-pointer"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Raise Ticket Modal */}
        <RaiseTicketModal
          visible={raiseModalOpen}
          onClose={() => setRaiseModalOpen(false)}
          onSuccess={(newT) => {
            fetchTickets();
            if (newT) setActiveTicket(newT);
          }}
        />

        {/* Ticket Conversation / Detail Drawer Modal */}
        {activeTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs p-0 transition-opacity">
            <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm bg-slate-200 px-2 py-0.5 rounded text-slate-800">
                      {activeTicket.code || 'TCK-NEW'}
                    </span>
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">
                      {activeTicket.category || 'GENERAL'}
                    </span>
                    <span
                      className="font-bold px-2 py-0.5 rounded-full text-[11px]"
                      style={{
                        backgroundColor: (STATUS_CONFIG[(activeTicket.status || 'OPEN').toUpperCase()] || STATUS_CONFIG.OPEN).bg,
                        color: (STATUS_CONFIG[(activeTicket.status || 'OPEN').toUpperCase()] || STATUS_CONFIG.OPEN).color,
                      }}
                    >
                      {(STATUS_CONFIG[(activeTicket.status || 'OPEN').toUpperCase()] || STATUS_CONFIG.OPEN).label}
                    </span>
                    <span
                      className="font-bold px-2 py-0.5 rounded-full text-[11px]"
                      style={{
                        backgroundColor: (PRIORITY_CONFIG[(activeTicket.priority || 'MEDIUM').toUpperCase()] || PRIORITY_CONFIG.MEDIUM).bg,
                        color: (PRIORITY_CONFIG[(activeTicket.priority || 'MEDIUM').toUpperCase()] || PRIORITY_CONFIG.MEDIUM).color,
                      }}
                    >
                      {(activeTicket.priority || 'MEDIUM').toUpperCase()}
                    </span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      <span>{isSocketConnected ? 'Live Real-Time' : 'Syncing...'}</span>
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-2">{activeTicket.title}</h2>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <Building2 size={13} />
                    <span>{getClientName(activeTicket)}</span>
                    <span>·</span>
                    <Clock size={13} />
                    <span>Opened {new Date(activeTicket.createdAt || Date.now()).toLocaleDateString()}</span>
                  </p>
                </div>
                <button
                  onClick={() => setActiveTicket(null)}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status, Priority & Assignee Controls Bar (Only Visible to Admin) */}
              {isAdmin && (
                <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500 uppercase">Status:</span>
                    <select
                      value={(activeTicket.status || 'OPEN').toUpperCase()}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="font-bold border border-slate-300 rounded-lg px-2.5 py-1 text-xs outline-none bg-white cursor-pointer hover:border-slate-400 transition"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500 uppercase">Priority:</span>
                    <select
                      value={(activeTicket.priority || 'MEDIUM').toUpperCase()}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      className="font-bold border border-slate-300 rounded-lg px-2.5 py-1 text-xs outline-none bg-white cursor-pointer hover:border-slate-400 transition"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500 uppercase">Assignee:</span>
                    <select
                      value={activeTicket.assignee_id?._id || activeTicket.assignee_id || ''}
                      onChange={(e) => handleAssigneeChange(e.target.value)}
                      className="font-bold border border-slate-300 rounded-lg px-2.5 py-1 text-xs outline-none bg-white cursor-pointer max-w-[150px] truncate hover:border-slate-400 transition"
                    >
                      <option value="">Unassigned</option>
                      {staffUsers.map((u) => (
                        <option key={u._id || u.id} value={u._id || u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    <span>Admin Controls</span>
                  </div>
                </div>
              )}

              {/* Scrollable Conversation Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Initial Description Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Issue Description</p>
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{activeTicket.description}</p>
                  {activeTicket.attachments && activeTicket.attachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                        Attached Documents ({activeTicket.attachments.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activeTicket.attachments.map((att, attIdx) => (
                          <a
                            key={att._id || attIdx}
                            href={resolveAttachmentUrl(att.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:text-blue-600 hover:border-blue-300 shadow-2xs transition group"
                          >
                            <FileText size={14} className="text-blue-600 shrink-0" />
                            <span className="font-medium truncate max-w-[200px]" title={att.name}>
                              {att.name || 'Document'}
                            </span>
                            <Download size={13} className="text-slate-400 group-hover:text-blue-600 ml-1 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Messages / Conversation Thread */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Conversation ({activeTicket.messages?.length || 0})
                    </h4>
                    <span className="text-[11px] text-slate-400">Updates live without refresh</span>
                  </div>

                  {(!activeTicket.messages || activeTicket.messages.length === 0) ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No replies posted yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {activeTicket.messages.map((msg, idx) => {
                        const isStaff = msg.sender === 'STAFF';
                        const isSending = msg.status === 'sending';
                        const isFailed = msg.status === 'failed';

                        return (
                          <div
                            key={msg._id || msg.clientMessageId || idx}
                            className={`p-4 rounded-xl text-sm transition-all ${
                              msg.internal
                                ? 'bg-amber-50/90 border border-amber-200'
                                : isStaff
                                ? 'bg-blue-50/70 border border-blue-100 ml-6'
                                : 'bg-white border border-slate-200 mr-6 shadow-xs'
                            } ${isFailed ? 'border-red-300 bg-red-50/50' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${isStaff ? 'text-[#1B2B4B]' : 'text-slate-800'}`}>
                                  {msg.author_name || (isStaff ? 'Support Staff' : 'Client')}
                                </span>
                                {msg.internal && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                                    <Lock size={10} />
                                    Internal Note
                                  </span>
                                )}
                                {isStaff && !msg.internal && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                                    Staff
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400">
                                  {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>

                                {/* Delivery Status for Staff replies */}
                                {isStaff && (
                                  <>
                                    {isSending && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-medium">
                                        <Loader2 size={11} className="animate-spin" />
                                        <span>Sending...</span>
                                      </span>
                                    )}
                                    {isFailed && (
                                      <button
                                        onClick={() => handlePostReply(msg)}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 hover:bg-red-200 px-1.5 py-0.5 rounded cursor-pointer transition"
                                        title="Click to retry delivery"
                                      >
                                        <RotateCcw size={10} />
                                        <span>Retry</span>
                                      </button>
                                    )}
                                    {!isSending && !isFailed && (
                                      <span className="text-blue-500" title="Delivered & Synced">
                                        <CheckCheck size={13} />
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            {msg.message && (
                              <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                            )}

                            {/* Render Attached Documents in Message Bubble */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2.5 space-y-1.5">
                                {msg.attachments.map((att, attIdx) => (
                                  <a
                                    key={att._id || attIdx}
                                    href={resolveAttachmentUrl(att.url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between gap-3 p-2.5 bg-white/90 hover:bg-white border border-slate-200/90 rounded-lg text-xs transition group shadow-2xs max-w-sm"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <FileText size={15} className="text-blue-600 shrink-0" />
                                      <div className="truncate text-left">
                                        <p className="font-semibold text-slate-800 truncate group-hover:text-blue-600">
                                          {att.name || 'Document'}
                                        </p>
                                        {att.size ? (
                                          <p className="text-[10px] text-slate-400">
                                            {(att.size / 1024).toFixed(1)} KB
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                    <span className="p-1 rounded bg-slate-100 group-hover:bg-blue-50 text-slate-500 group-hover:text-blue-600 transition shrink-0">
                                      <Download size={13} />
                                    </span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Typing Indicator */}
                  {typingUser && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 italic py-1.5 px-3 bg-slate-100/90 rounded-xl animate-pulse w-fit">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                      <span>{typingUser} is typing...</span>
                    </div>
                  )}

                  {/* Auto-scroll target */}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Reply Input Bar */}
              <div className="p-4 bg-slate-50 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded text-[#1B2B4B] focus:ring-0"
                    />
                    <span>Post as Private Internal Note (Hidden from client)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                    Cmd+Enter or Ctrl+Enter to send
                  </span>
                </div>

                {/* Hidden File Input for document upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.zip,.rar"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />

                {/* Selected Documents Preview Strip */}
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-100/90 rounded-xl border border-slate-200">
                    {attachedFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 shadow-2xs"
                      >
                        <FileText size={14} className="text-blue-600 shrink-0" />
                        <span className="font-medium truncate max-w-[150px]" title={f.name}>
                          {f.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({f.size ? (f.size / 1024).toFixed(0) : '0'} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="text-slate-400 hover:text-red-500 ml-1 p-0.5 rounded cursor-pointer transition"
                          title="Remove document"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  {/* Document Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sendingReply || uploadingAttachment}
                    title="Upload / Attach Document (PDF, Word, Excel, Images up to 15MB)"
                    className="p-3 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-100 text-slate-600 hover:text-[#1B2B4B] transition flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Paperclip size={16} />
                  </button>

                  <textarea
                    rows={3}
                    placeholder={
                      isInternal
                        ? 'Type private note for internal CRM team...'
                        : attachedFiles.length > 0
                        ? 'Add an optional note with your document(s)...'
                        : 'Type response for client...'
                    }
                    value={replyText}
                    onChange={(e) => handleTypingChange(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handlePostReply();
                      }
                    }}
                    className="flex-1 p-3 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-[#1B2B4B] focus:ring-1 focus:ring-[#1B2B4B] text-slate-900 resize-none shadow-xs"
                  />

                  <button
                    onClick={() => handlePostReply()}
                    disabled={
                      sendingReply ||
                      uploadingAttachment ||
                      (!replyText.trim() && attachedFiles.length === 0)
                    }
                    className="px-4 py-3 rounded-xl bg-[#1B2B4B] hover:bg-[#243454] disabled:bg-slate-300 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {uploadingAttachment ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-[#F5A623]" />
                        <span>Uploading...</span>
                      </>
                    ) : sendingReply ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-[#F5A623]" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Send</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

