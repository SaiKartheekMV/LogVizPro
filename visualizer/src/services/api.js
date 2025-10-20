import axios from 'axios';

const API_BASE = 'http://localhost:3001';
const ANALYZER_BASE = 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  getProfile: () => api.get('/api/auth/profile'),
};

export const logsAPI = {
  getLogs: (params) => axios.get(`${API_BASE}/api/logs`, { params }),
  createLog: (data) => api.post('/api/logs', data),
  exportLogs: (format) => api.get(`/api/logs/export?format=${format}`),
};

export const analyticsAPI = {
  getSummary: (hours = 24) => axios.get(`${ANALYZER_BASE}/api/analytics/summary?hours=${hours}`),
  getTrends: (hours = 24) => axios.get(`${ANALYZER_BASE}/api/analytics/trends?hours=${hours}`),
};

export const alertsAPI = {
  getAlerts: () => api.get('/api/alerts'),
  createAlert: (data) => api.post('/api/alerts', data),
  deleteAlert: (id) => api.delete(`/api/alerts/${id}`),
};

export default api;