import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Container, Row, Col, Card, Badge, Button, Form } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area } from 'recharts';
import { FaDownload, FaSync } from 'react-icons/fa';
import { logsAPI, analyticsAPI } from '../services/api';
import fileDownload from 'js-file-download';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

// Convert UTC to IST
const formatToIST = (timestamp) => {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (err) {
    return 'Invalid date';
  }
};

function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    const socket = io('http://localhost:3001');
    
    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
    });
    
    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setConnected(false);
    });
    
    socket.on('new_log', (log) => {
      console.log('📨 New log received:', log);
      setLogs(prev => [log, ...prev].slice(0, 100));
      // Fetch stats after new log (debounced)
      setTimeout(() => fetchStats(), 1000);
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
      const res = await logsAPI.getLogs({ limit: 50 });
      setLogs(res.data.data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const fetchStats = async () => {
    try {
      // Fix: Limit hours to max 168 (7 days)
      const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 168;
      const res = await analyticsAPI.getSummary(hours);
      setStats(res.data.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      // Fallback to 24h if there's an error
      if (timeRange !== '24h') {
        setTimeRange('24h');
        try {
          const res = await analyticsAPI.getSummary(24);
          setStats(res.data.data);
        } catch (fallbackErr) {
          console.error('Fallback also failed:', fallbackErr);
        }
      }
    }
  };

  const fetchTrends = async () => {
    try {
      // Fix: Limit hours to max 168 (7 days)
      const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 168;
      const res = await analyticsAPI.getTrends(hours);
      setTrends(res.data.data || []);
    } catch (err) {
      console.error('Error fetching trends:', err);
      setTrends([]);
    }
  };

  const handleTimeRangeChange = async (newRange) => {
    setTimeRange(newRange);
    setLoading(true);
    
    try {
      const hours = newRange === '24h' ? 24 : newRange === '7d' ? 168 : 168;
      
      const [statsRes, trendsRes] = await Promise.all([
        analyticsAPI.getSummary(hours),
        analyticsAPI.getTrends(hours)
      ]);
      
      setStats(statsRes.data.data);
      setTrends(trendsRes.data.data || []);
    } catch (err) {
      console.error('Error changing time range:', err);
      alert('Failed to load data for selected time range');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await logsAPI.exportLogs(format);
      const filename = `logvizpro_logs_${new Date().toISOString().split('T')[0]}.${format}`;
      fileDownload(response.data, filename);
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesLevel = filter === 'all' || log.level === filter;
    const matchesService = selectedService === 'all' || log.service === selectedService;
    const matchesSearch = searchQuery === '' || 
      log.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.service?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesService && matchesSearch;
  });

  const pieData = stats ? Object.entries(stats.byLevel || {}).map(([name, value]) => ({ name, value })) : [];
  const serviceData = stats ? Object.entries(stats.byService || {}).slice(0, 7).map(([name, value]) => ({ name, value })) : [];

  const getLevelColor = (level) => {
    const colors = { error: '#ef4444', warn: '#f59e0b', info: '#3b82f6', debug: '#8b5cf6' };
    return colors[level] || '#6b7280';
  };

  const getLevelIcon = (level) => {
    const icons = { error: '🔴', warn: '⚠️', info: '💡', debug: '🔧' };
    return icons[level] || '📋';
  };

  if (!stats) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="text-center">
          <div className="spinner-border text-light mb-3" role="status" style={{ width: '4rem', height: '4rem', borderWidth: '0.4rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-white fs-5 fw-bold">Loading LogVizPro Dashboard...</p>
          <small className="text-white opacity-75">Fetching analytics data...</small>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', minHeight: '100vh' }}>
      <Container fluid className="py-4 px-4">
        {/* Header */}
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
              <div>
                <h1 className="mb-2" style={{ fontSize: '36px', fontWeight: '800', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  📊 Log Analytics Dashboard
                </h1>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <Badge 
                    bg={connected ? 'success' : 'danger'} 
                    style={{ fontSize: '14px', padding: '8px 16px', borderRadius: '20px', boxShadow: connected ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(239, 68, 68, 0.3)' }}
                  >
                    {connected ? '● Live' : '● Offline'}
                  </Badge>
                  <small style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
                    🕒 Last updated: {formatToIST(new Date())}
                  </small>
                </div>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <Form.Select 
                  value={timeRange} 
                  onChange={(e) => handleTimeRangeChange(e.target.value)}
                  disabled={loading}
                  style={{ width: 'auto', borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: '600' }}
                >
                  <option value="24h">📅 Last 24 Hours</option>
                  <option value="7d">📅 Last 7 Days</option>
                </Form.Select>
                <Button 
                  style={{ borderRadius: '12px', padding: '8px 20px', fontWeight: '600', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)' }}
                  onClick={fetchInitialData} 
                  disabled={loading}
                >
                  <FaSync className={loading ? 'spin' : ''} /> {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {/* Stats Cards */}
        <Row className="g-4 mb-4">
          {[
            { 
              icon: '📊', 
              label: 'TOTAL LOGS', 
              value: (stats.totalLogs || 0).toLocaleString(), 
              subtext: `Last ${timeRange === '24h' ? '24 hours' : '7 days'}`, 
              gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              badge: '+12.5%',
              badgeColor: 'success'
            },
            { 
              icon: '🚨', 
              label: 'ERROR RATE', 
              value: `${(stats.errorRate || 0).toFixed(1)}%`, 
              subtext: `${(stats.byLevel?.error || 0).toLocaleString()} errors detected`, 
              gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              badge: stats.errorRate > 5 ? 'High' : 'Normal',
              badgeColor: stats.errorRate > 5 ? 'danger' : 'success'
            },
            { 
              icon: '✅', 
              label: 'SUCCESS RATE', 
              value: `${(100 - (stats.errorRate || 0)).toFixed(1)}%`, 
              subtext: 'System health status', 
              gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              badge: 'Healthy',
              badgeColor: 'success'
            },
            { 
              icon: '🖥️', 
              label: 'SERVICES', 
              value: Object.keys(stats.byService || {}).length, 
              subtext: 'Active microservices', 
              gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              badge: 'Active',
              badgeColor: 'info'
            }
          ].map((stat, idx) => (
            <Col md={6} lg={3} key={idx}>
              <Card 
                className="border-0 h-100 hover-card" 
                style={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', transition: 'all 0.3s ease', cursor: 'pointer' }}
              >
                <div style={{ background: stat.gradient, padding: '24px' }}>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div style={{ fontSize: '42px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                      {stat.icon}
                    </div>
                    <Badge 
                      bg={stat.badgeColor} 
                      style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '12px', fontWeight: '600', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                    >
                      {stat.badge}
                    </Badge>
                  </div>
                  <small className="d-block mb-2" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: '600', letterSpacing: '1px' }}>{stat.label}</small>
                  <h2 className="mb-1" style={{ fontSize: '42px', fontWeight: '800', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    {stat.value}
                  </h2>
                  <small style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: '500' }}>{stat.subtext}</small>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Charts */}
        <Row className="g-4 mb-4">
          <Col lg={8}>
            <Card className="border-0" style={{ borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
              <Card.Body style={{ padding: '28px' }}>
                <h5 className="mb-1" style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>📈 Log Activity Timeline</h5>
                <small className="d-block mb-3" style={{ color: '#64748b', fontSize: '14px' }}>Real-time monitoring</small>
                {trends.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <p>No trend data available. Send some logs to see activity!</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trends}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#667eea" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#667eea" stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f5576c" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#f5576c" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
                      <Legend />
                      <Area type="monotone" dataKey="total" stroke="#667eea" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" name="Total" />
                      <Area type="monotone" dataKey="errors" stroke="#f5576c" strokeWidth={3} fillOpacity={1} fill="url(#colorErrors)" name="Errors" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4}>
            <Card className="border-0" style={{ borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
              <Card.Body style={{ padding: '28px' }}>
                <h5 className="mb-1" style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>🥧 Distribution</h5>
                <small className="d-block mb-3" style={{ color: '#64748b', fontSize: '14px' }}>By severity</small>
                {pieData.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <p>No data available</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie 
                          data={pieData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={4}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getLevelColor(entry.name)} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3">
                      {pieData.map((item, idx) => (
                        <div key={idx} className="d-flex justify-content-between align-items-center py-2" style={{ borderBottom: idx < pieData.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                          <div className="d-flex align-items-center gap-2">
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: getLevelColor(item.name) }} />
                            <span className="text-capitalize fw-semibold">{item.name}</span>
                          </div>
                          <strong>{item.value.toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Services Bar Chart */}
        {serviceData.length > 0 && (
          <Row className="mb-4">
            <Col>
              <Card className="border-0" style={{ borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                <Card.Body style={{ padding: '28px' }}>
                  <h5 className="mb-3" style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>🏢 Service Activity</h5>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={serviceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={45}>
                        {serviceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Logs */}
        <Row>
          <Col>
            <Card className="border-0" style={{ borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
              <Card.Body style={{ padding: '28px' }}>
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                  <div>
                    <h5 className="mb-1" style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>📋 Recent Logs</h5>
                    <small style={{ color: '#64748b' }}>{filteredLogs.length} logs displayed</small>
                  </div>
                  <div className="d-flex gap-2">
                    <Button variant="outline-success" size="sm" onClick={() => handleExport('csv')} style={{ borderRadius: '10px', fontWeight: '600' }}>
                      <FaDownload /> CSV
                    </Button>
                    <Button variant="outline-primary" size="sm" onClick={() => handleExport('json')} style={{ borderRadius: '10px', fontWeight: '600' }}>
                      <FaDownload /> JSON
                    </Button>
                  </div>
                </div>

                <Row className="g-3 mb-3">
                  <Col md={4}>
                    <Form.Control
                      type="text"
                      placeholder="🔍 Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ borderRadius: '10px', border: '2px solid #e2e8f0' }}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600' }}>
                      <option value="all">All Levels</option>
                      <option value="error">Errors</option>
                      <option value="warn">Warnings</option>
                      <option value="info">Info</option>
                      <option value="debug">Debug</option>
                    </Form.Select>
                  </Col>
                  <Col md={4}>
                    <Form.Select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} style={{ borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: '600' }}>
                      <option value="all">All Services</option>
                      {Object.keys(stats.byService || {}).map(service => (
                        <option key={service} value={service}>{service}</option>
                      ))}
                    </Form.Select>
                  </Col>
                </Row>

                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-5">
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                      <h5 className="text-muted">No logs found</h5>
                      <p className="text-muted small">Try adjusting your filters or send some logs</p>
                    </div>
                  ) : (
                    filteredLogs.map((log, idx) => (
                      <Card key={idx} className="mb-2 log-card" style={{ borderLeft: `4px solid ${getLevelColor(log.level)}`, borderRadius: '10px', border: 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                        <Card.Body style={{ padding: '12px 16px' }}>
                          <div className="d-flex justify-content-between align-items-start gap-3">
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                <Badge bg={log.level === 'error' ? 'danger' : log.level === 'warn' ? 'warning' : log.level === 'info' ? 'primary' : 'secondary'} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px' }}>
                                  {getLevelIcon(log.level)} {log.level.toUpperCase()}
                                </Badge>
                                <Badge bg="light" text="dark" style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px' }}>
                                  {log.service}
                                </Badge>
                              </div>
                              <p className="mb-0" style={{ fontSize: '14px', color: '#334155' }}>{log.message}</p>
                            </div>
                            <small className="text-muted text-nowrap" style={{ fontSize: '12px', backgroundColor: '#f8fafc', padding: '4px 8px', borderRadius: '6px' }}>
                              {formatToIST(log.timestamp)}
                            </small>
                          </div>
                        </Card.Body>
                      </Card>
                    ))
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .hover-card:hover { transform: translateY(-5px); }
        .log-card { transition: all 0.2s ease; cursor: pointer; }
        .log-card:hover { transform: translateX(3px); box-shadow: 0 4px 10px rgba(0,0,0,0.1) !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; }
      `}</style>
    </div>
  );
}

export default Dashboard;