/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Container, Row, Col, Card, Badge, Button, Form } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area } from 'recharts';
import { FaDownload, FaSync, FaSearch } from 'react-icons/fa';
import { logsAPI, analyticsAPI } from '../services/api';
import fileDownload from 'js-file-download';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

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
      const res = await logsAPI.getLogs({ limit: 50 });
      setLogs(res.data.data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
      const res = await analyticsAPI.getSummary(hours);
      setStats(res.data.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchTrends = async () => {
    try {
      const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
      const res = await analyticsAPI.getTrends(hours);
      setTrends(res.data.data || []);
    } catch (err) {
      console.error('Error fetching trends:', err);
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await logsAPI.exportLogs(format);
      const filename = `logs_${new Date().toISOString()}.${format}`;
      fileDownload(response.data, filename);
    } catch (err) {
      alert('Export failed. Please try again.');
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesLevel = filter === 'all' || log.level === filter;
    const matchesService = selectedService === 'all' || log.service === selectedService;
    const matchesSearch = searchQuery === '' || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.service.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesService && matchesSearch;
  });

  const pieData = stats ? Object.entries(stats.byLevel).map(([name, value]) => ({ name, value })) : [];
  const serviceData = stats ? Object.entries(stats.byService).slice(0, 7).map(([name, value]) => ({ name, value })) : [];

  const getLevelColor = (level) => {
    const colors = { error: '#ef4444', warn: '#f59e0b', info: '#3b82f6', debug: '#8b5cf6' };
    return colors[level] || '#6b7280';
  };

  const getLevelIcon = (level) => {
    const icons = { error: '🔴', warn: '⚠️', info: '🔵', debug: '🔍' };
    return icons[level] || '📋';
  };

  if (!stats) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Container fluid className="py-4">
        {/* Header */}
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
              <div>
                <h1 className="mb-2" style={{ fontSize: '32px', fontWeight: '700' }}>
                  Log Analytics Dashboard
                </h1>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <Badge bg={connected ? 'success' : 'danger'}>
                    {connected ? '🟢 Live Connection' : '🔴 Disconnected'}
                  </Badge>
                  <small className="text-muted">
                    🕒 Last updated: {new Date().toLocaleTimeString()}
                  </small>
                </div>
              </div>
              <div className="d-flex gap-2">
                <Form.Select 
                  value={timeRange} 
                  onChange={(e) => { setTimeRange(e.target.value); fetchInitialData(); }}
                  style={{ width: 'auto' }}
                >
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </Form.Select>
                <Button variant="primary" onClick={fetchInitialData} disabled={loading}>
                  <FaSync className={loading ? 'spin' : ''} /> Refresh
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {/* Stats Cards */}
        <Row className="g-3 mb-4">
          {[
            { 
              icon: '📊', 
              label: 'TOTAL LOGS', 
              value: stats.totalLogs.toLocaleString(), 
              subtext: `Last ${timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'}`, 
              bg: 'primary',
              badge: '+12.5%',
              badgeColor: 'success'
            },
            { 
              icon: '🚨', 
              label: 'ERROR RATE', 
              value: `${stats.errorRate}%`, 
              subtext: `${stats.byLevel.error || 0} errors detected`, 
              bg: 'danger',
              badge: stats.errorRate > 5 ? 'High' : 'Normal',
              badgeColor: stats.errorRate > 5 ? 'danger' : 'success'
            },
            { 
              icon: '✅', 
              label: 'SUCCESS RATE', 
              value: `${(100 - stats.errorRate).toFixed(1)}%`, 
              subtext: 'Above target threshold', 
              bg: 'success',
              badge: 'Healthy',
              badgeColor: 'success'
            },
            { 
              icon: '🖥️', 
              label: 'SERVICES', 
              value: Object.keys(stats.byService).length, 
              subtext: 'Monitored services', 
              bg: 'info',
              badge: 'Active',
              badgeColor: 'info'
            }
          ].map((stat, idx) => (
            <Col md={6} lg={3} key={idx}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div 
                      className={`bg-${stat.bg} bg-opacity-10 p-3 rounded`}
                      style={{ fontSize: '28px' }}
                    >
                      {stat.icon}
                    </div>
                    <Badge bg={stat.badgeColor}>{stat.badge}</Badge>
                  </div>
                  <small className="text-muted d-block mb-2">{stat.label}</small>
                  <h2 className="mb-1" style={{ fontSize: '36px', fontWeight: '700' }}>
                    {stat.value}
                  </h2>
                  <small className="text-muted">{stat.subtext}</small>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Charts */}
        <Row className="g-3 mb-4">
          {/* Area Chart */}
          <Col lg={8}>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5 className="mb-1">📈 Log Activity Timeline</h5>
                    <small className="text-muted">Real-time log volume and error tracking</small>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trends}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" name="Total Logs" />
                    <Area type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorErrors)" name="Errors" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          </Col>

          {/* Pie Chart */}
          <Col lg={4}>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <h5 className="mb-1">🥧 Log Distribution</h5>
                <small className="text-muted d-block mb-3">By severity level</small>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie 
                      data={pieData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
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
                    <div key={idx} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: getLevelColor(item.name) }} />
                        <span className="text-capitalize">{item.name}</span>
                      </div>
                      <strong>{item.value.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Bar Chart */}
        <Row className="mb-4">
          <Col>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <h5 className="mb-1">🏢 Service Performance</h5>
                <small className="text-muted d-block mb-3">Log volume by service</small>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={serviceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
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

        {/* Recent Logs */}
        <Row>
          <Col>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5 className="mb-1">📋 Recent Logs</h5>
                    <small className="text-muted">{filteredLogs.length} logs displayed</small>
                  </div>
                  <div className="d-flex gap-2">
                    <Button variant="outline-success" size="sm" onClick={() => handleExport('csv')}>
                      <FaDownload /> CSV
                    </Button>
                    <Button variant="outline-primary" size="sm" onClick={() => handleExport('json')}>
                      <FaDownload /> JSON
                    </Button>
                  </div>
                </div>

                {/* Filters */}
                <Row className="g-3 mb-3">
                  <Col md={4}>
                    <Form.Control
                      type="text"
                      placeholder="🔍 Search logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Select value={filter} onChange={(e) => setFilter(e.target.value)}>
                      <option value="all">All Levels</option>
                      <option value="error">Errors Only</option>
                      <option value="warn">Warnings Only</option>
                      <option value="info">Info Only</option>
                      <option value="debug">Debug Only</option>
                    </Form.Select>
                  </Col>
                  <Col md={4}>
                    <Form.Select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}>
                      <option value="all">All Services</option>
                      {Object.keys(stats.byService).map(service => (
                        <option key={service} value={service}>{service}</option>
                      ))}
                    </Form.Select>
                  </Col>
                </Row>

                {/* Log List */}
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-5">
                      <div style={{ fontSize: '48px' }}>🔍</div>
                      <h5 className="text-muted mt-3">No logs found</h5>
                      <small className="text-muted">Try adjusting your filters</small>
                    </div>
                  ) : (
                    filteredLogs.map((log, idx) => (
                      <Card 
                        key={idx} 
                        className="mb-2" 
                        style={{ borderLeft: `4px solid ${getLevelColor(log.level)}` }}
                      >
                        <Card.Body className="py-2">
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                <Badge bg={log.level === 'error' ? 'danger' : log.level === 'warn' ? 'warning' : log.level === 'info' ? 'primary' : 'secondary'}>
                                  {getLevelIcon(log.level)} {log.level.toUpperCase()}
                                </Badge>
                                <Badge bg="light" text="dark">
                                  🖥️ {log.service}
                                </Badge>
                              </div>
                              <p className="mb-0">{log.message}</p>
                            </div>
                            <small className="text-muted text-nowrap ms-3">
                              {new Date(log.timestamp).toLocaleString()}
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
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;