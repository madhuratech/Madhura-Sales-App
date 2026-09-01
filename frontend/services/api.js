import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, API_FALLBACK_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // 60s — enough for Render free tier cold start
});

console.log('API_URL:', API_URL, '| Fallback:', API_FALLBACK_URL);

// ── Request Interceptor: attach auth token ──────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      if (config.headers && typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`
        };
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor: handle network failures gracefully ─────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config || {};

    // Only retry on network errors (no HTTP response received)
    if (!error.response && config && config.url) {
      if (!config._retried) {
        config._retried = true;
        
        if (config.baseURL !== API_FALLBACK_URL && API_FALLBACK_URL) {
          config.baseURL = API_FALLBACK_URL;
        }

        // Small delay before retrying (e.g. for Render cold start)
        await new Promise((r) => setTimeout(r, 1000));
        try {
          return await api(config);
        } catch (retryErr) {
          return { data: { success: false, data: [] } };
        }
      }
      return { data: { success: false, data: [] } };
    }

    // Auto-logout on 401 (except for login requests themselves)
    if (error.response?.status === 401 && config.url && !config.url.includes('/auth/login')) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      const { router } = require('expo-router');
      if (router) {
        try {
          router.replace('/Login');
        } catch (e) {}
      }
    }

    // Return safe object instead of rejecting Promise to prevent any redbox crash/error popups
    return { 
      data: error.response?.data || { success: false, data: [] }, 
      status: error.response?.status || 500 
    };
  }
);

export default api;
