import AsyncStorage from '@react-native-async-storage/async-storage';

// Pure frontend draft storage (UX feature). Does NOT touch any backend.
// Drafts are scoped per module + user and persisted in local storage so a user
// can navigate to other modules/pages and come back to resume the same draft.

const MAX_DRAFTS = 20;

const storageKey = (module, username) => `mdh_drafts_${module}_${username || 'guest'}`;

export async function getCurrentUsername() {
  try {
    const stored = await AsyncStorage.getItem('user');
    if (!stored) return '';
    const user = JSON.parse(stored);
    return user.email || user.employeeId || user.username || user.name || '';
  } catch {
    return '';
  }
}

export async function getDrafts(module) {
  const username = await getCurrentUsername();
  try {
    const raw = await AsyncStorage.getItem(storageKey(module, username));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
      : [];
  } catch {
    return [];
  }
}

export async function saveDraft(module, payload, summary) {
  const username = await getCurrentUsername();
  const drafts = await getDrafts(module);
  const now = Date.now();
  const draft = {
    id: `d${now}_${Math.random().toString(36).slice(2, 7)}`,
    savedAt: now,
    label: (summary && summary.label) || 'Untitled draft',
    customer: (summary && summary.customer) || '',
    company: (summary && summary.company) || '',
    payload,
  };
  const updated = [draft, ...drafts].slice(0, MAX_DRAFTS);
  await AsyncStorage.setItem(storageKey(module, username), JSON.stringify(updated));
  return draft;
}

export async function removeDraft(module, id) {
  const username = await getCurrentUsername();
  const drafts = await getDrafts(module);
  await AsyncStorage.setItem(
    storageKey(module, username),
    JSON.stringify(drafts.filter(d => d.id !== id))
  );
}

export async function clearDrafts(module) {
  const username = await getCurrentUsername();
  await AsyncStorage.removeItem(storageKey(module, username));
}