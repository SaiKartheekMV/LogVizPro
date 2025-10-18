import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar 
} from 'recharts';
import './App.css';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const API_BASE = 'http://localhost:3001';
const ANALYZER_BASE = 'http://localhost:8000';

function App() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(API_BASE);
    
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    
    socket.on('new_log', (log) => {
      setLogs(prev => [log, ...prev].slice(0, 100));
      fetchStats();
    });

    fetchInitialData();

    const interval = setInterval(() => {
      fetchStats();
      fetchTrends();
    }, 30000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchLogs(), fetchStats(), fetchTrends()]);
    setLoading(false);
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/logs?limit=50`);
      setLogs(res.data.data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${ANALYZER_BASE}/api/analytics/summary?hours=24`);
      setStats(res.data.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchTrends = async () => {
    try {
      const res = await axios.get(`${ANALYZER_BASE}/api/analytics/trends?hours=24`);
      setTrends(res.data.data);
    } catch (err) {
      console.error('Error fetching trends:', err);
    }
  };

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.level === filter);
  const pieData = stats ? Object.entries(stats.byLevel).map(([name, value]) => ({ name, value })) : [];
  const serviceData = stats ? Object.entries(stats.byService).slice(0, 5).map(([name, value]) => ({ name, value })) : [];

  const getLevelColor = (level) => {
    const colors = {
      error: '#ef4444',
      warn: '#f59e0b',
      info: '#3b82f6',
      debug: '#8b5cf6'
    };
    return colors[level] || '#6b7280';
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading LogVizPro...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <h1>📊 LogVizPro</h1>
            <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          <p className="subtitle">Real-time Log Monitoring & Analytics</p>
        </div>
      </header>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>Total Logs</h3>
              <p className="stat-value">{stats.totalLogs.toLocaleString()}</p>
              <span className="stat-label">Last 24 hours</span>
            </div>
          </div>
          
          <div className="stat-card error">
            <div className="stat-icon">🔴</div>
            <div className="stat-content">
              <h3>Error Rate</h3>
              <p className="stat-value">{stats.errorRate}%</p>
              <span className="stat-label">{stats.byLevel.error || 0} errors detected</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🏢</div>
            <div className="stat-content">
              <h3>Services</h3>
              <p className="stat-value">{Object.keys(stats.byService).length}</p>
              <span className="stat-label">Active services</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⚠️</div>
            <div className="stat-content">
              <h3>Warnings</h3>
              <p className="stat-value">{stats.byLevel.warn || 0}</p>
              <span className="stat-label">Last 24 hours</span>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-card">
          <div className="chart-header">
            <h2>📈 Log Trends</h2>
            <span className="chart-subtitle">Last 24 hours</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="time" 
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
              />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #334155',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Total Logs" />
              <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} name="Errors" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h2>🥧 Log Distribution</h2>
            <span className="chart-subtitle">By severity level</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie 
                data={pieData} 
                dataKey="value" 
                nameKey="name" 
                cx="50%" 
                cy="50%" 
                outerRadius={90}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getLevelColor(entry.name)} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #334155',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card full-width">
          <div className="chart-header">
            <h2>🏢 Top Services</h2>
            <span className="chart-subtitle">By log volume</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serviceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #334155',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Logs Section */}
      <div className="logs-section">
        <div className="logs-header">
          <h2>📋 Recent Logs</h2>
          <div className="filters">
            {['all', 'info', 'warn', 'error', 'debug'].map(level => (
              <button 
                key={level}
                className={`filter-btn ${filter === level ? 'active' : ''}`}
                onClick={() => setFilter(level)}
              >
                {level.toUpperCase()}
                {level !== 'all' && stats && (
                  <span className="badge">{stats.byLevel[level] || 0}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="logs-container">
          {filteredLogs.length === 0 ? (
            <div className="empty-state">
              <p>📭 No logs found</p>
              <span>Send some logs to see them here!</span>
            </div>
          ) : (
            <div className="logs-list">
              {filteredLogs.map((log, idx) => (
                <div key={idx} className={`log-item ${log.level}`}>
                  <div className="log-header-row">
                    <span className={`log-badge ${log.level}`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="log-service">🏢 {log.service}</span>
                    <span className="log-time">
                      🕐 {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="log-message">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>Made with ❤️ by Sai Kartheek Mulukutla</p>
        <p className="footer-links">
          <span>LogVizPro v1.0.0</span>
          <span>•</span>
          <span>{logs.length} logs loaded</span>
        </p>
      </footer>
    </div>
  );
}

export default App;