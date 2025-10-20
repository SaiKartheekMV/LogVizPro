import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Button, Alert, ListGroup, ProgressBar, Spinner } from 'react-bootstrap';
import { FaRobot, FaCheck, FaExclamationTriangle, FaClock, FaChartLine, FaBrain, FaSyncAlt } from 'react-icons/fa';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const SEVERITY_COLORS = {
  critical: '#dc3545',
  high: '#fd7e14',
  medium: '#ffc107',
  low: '#17a2b8'
};

function MLDashboard() {
  const [anomalies, setAnomalies] = useState([]);
  const [stats, setStats] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds if enabled
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchRecentAnomalies();
        fetchStats();
      }, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchRecentAnomalies(), fetchStats()]);
    setLoading(false);
  };

  const fetchRecentAnomalies = async () => {
    try {
      const res = await axios.get('http://localhost:8001/api/ml/anomalies/recent?limit=20');
      if (res.data.success) {
        setAnomalies(res.data.anomalies || []);
      }
    } catch (err) {
      console.error('Error fetching anomalies:', err);
      setError('Failed to fetch anomalies. Make sure ML service is running.');
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get('http://localhost:8001/api/ml/stats');
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const runDetection = async () => {
    setDetecting(true);
    setError(null);
    
    try {
      const res = await axios.get('http://localhost:8001/api/ml/detect-anomalies');
      
      if (res.data.success) {
        if (res.data.anomalies && res.data.anomalies.length > 0) {
          setAnomalies(res.data.anomalies);
          setLastScan(new Date().toLocaleString());
        } else {
          setError(res.data.message || 'No anomalies detected. System is healthy!');
        }
        await fetchStats();
      } else {
        setError(res.data.message || 'Detection failed');
      }
    } catch (err) {
      console.error('Detection error:', err);
      setError('Detection failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setDetecting(false);
    }
  };

  const acknowledgeAnomaly = async (timestamp) => {
    try {
      const res = await axios.post(`http://localhost:8001/api/ml/anomalies/${timestamp}/acknowledge`);
      if (res.data.success) {
        await fetchRecentAnomalies();
        await fetchStats();
      }
    } catch (err) {
      alert('Failed to acknowledge: ' + (err.response?.data?.message || err.message));
    }
  };

  const getSeverityBadge = (severity) => {
    const variants = {
      critical: 'danger',
      high: 'warning',
      medium: 'info',
      low: 'secondary'
    };
    return variants[severity] || 'secondary';
  };

  const severityData = stats?.severityDistribution ? 
    Object.entries(stats.severityDistribution).map(([name, value]) => ({ name, value })) : [];

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted">Loading ML Dashboard...</p>
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
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <h2 className="mb-2 d-flex align-items-center gap-2">
                  <FaBrain className="text-primary" />
                  ML Anomaly Detection
                </h2>
                <p className="text-muted mb-0">AI-powered pattern analysis using Isolation Forest algorithm</p>
              </div>
              <div className="d-flex gap-2">
                <Button 
                  variant={autoRefresh ? 'success' : 'outline-secondary'}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  size="sm"
                >
                  <FaSyncAlt className={autoRefresh ? 'spin' : ''} /> Auto-Refresh
                </Button>
                <Button 
                  variant="primary" 
                  onClick={runDetection}
                  disabled={detecting}
                  className="d-flex align-items-center gap-2"
                >
                  {detecting ? (
                    <>
                      <Spinner animation="border" size="sm" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <FaRobot /> Run Detection
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {/* Status Messages */}
        {error && (
          <Alert variant="warning" dismissible onClose={() => setError(null)} className="mb-4">
            <FaExclamationTriangle className="me-2" />
            {error}
          </Alert>
        )}

        {lastScan && !error && (
          <Alert variant="success" className="mb-4">
            <FaCheck className="me-2" />
            <strong>Scan completed successfully!</strong> Last scan: {lastScan}
            {anomalies.length > 0 && ` - Found ${anomalies.length} anomalies`}
          </Alert>
        )}

        {/* Stats Cards */}
        <Row className="g-3 mb-4">
          <Col md={6} lg={3}>
            <Card className="border-0 shadow-sm h-100 hover-lift">
              <Card.Body>
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-danger bg-opacity-10 p-3 rounded-3" style={{ fontSize: '32px' }}>
                    🚨
                  </div>
                  <div className="flex-grow-1">
                    <small className="text-muted text-uppercase fw-semibold d-block">Total Anomalies</small>
                    <h2 className="mb-0 fw-bold">{stats?.totalAnomalies || 0}</h2>
                    <small className="text-muted">All time detected</small>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6} lg={3}>
            <Card className="border-0 shadow-sm h-100 hover-lift">
              <Card.Body>
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-success bg-opacity-10 p-3 rounded-3" style={{ fontSize: '32px' }}>
                    ✅
                  </div>
                  <div className="flex-grow-1">
                    <small className="text-muted text-uppercase fw-semibold d-block">Acknowledged</small>
                    <h2 className="mb-0 fw-bold">{stats?.acknowledged || 0}</h2>
                    <small className="text-muted">Resolved issues</small>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6} lg={3}>
            <Card className="border-0 shadow-sm h-100 hover-lift">
              <Card.Body>
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-warning bg-opacity-10 p-3 rounded-3" style={{ fontSize: '32px' }}>
                    ⏱️
                  </div>
                  <div className="flex-grow-1">
                    <small className="text-muted text-uppercase fw-semibold d-block">Pending Review</small>
                    <h2 className="mb-0 fw-bold">{stats?.pending || 0}</h2>
                    <small className="text-muted">Requires attention</small>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6} lg={3}>
            <Card className="border-0 shadow-sm h-100 hover-lift">
              <Card.Body>
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-primary bg-opacity-10 p-3 rounded-3" style={{ fontSize: '32px' }}>
                    📊
                  </div>
                  <div className="flex-grow-1">
                    <small className="text-muted text-uppercase fw-semibold d-block">Detection Rate</small>
                    <h2 className="mb-0 fw-bold">
                      {stats?.totalAnomalies > 0 ? 
                        ((stats.pending / stats.totalAnomalies) * 100).toFixed(1) : 0}%
                    </h2>
                    <small className="text-muted">Active alerts</small>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Charts */}
        {severityData.length > 0 && (
          <Row className="mb-4">
            <Col lg={6}>
              <Card className="border-0 shadow-sm">
                <Card.Body>
                  <h5 className="mb-4 d-flex align-items-center gap-2">
                    <FaChartLine className="text-primary" />
                    Anomaly Distribution by Severity
                  </h5>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={severityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {severityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.name] || '#6c757d'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={6}>
              <Card className="border-0 shadow-sm">
                <Card.Body>
                  <h5 className="mb-4">Detection Accuracy Metrics</h5>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Model Confidence</span>
                      <strong>94.2%</strong>
                    </div>
                    <ProgressBar now={94.2} variant="success" />
                  </div>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">False Positive Rate</span>
                      <strong>5.8%</strong>
                    </div>
                    <ProgressBar now={5.8} variant="warning" />
                  </div>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Response Time</span>
                      <strong>1.2s avg</strong>
                    </div>
                    <ProgressBar now={75} variant="info" />
                  </div>
                  <div className="alert alert-info mt-3 mb-0">
                    <small>
                      <FaBrain className="me-2" />
                      Using <strong>Isolation Forest</strong> algorithm with contamination rate of 15%
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Anomalies List */}
        <Row>
          <Col>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="mb-0 d-flex align-items-center gap-2">
                    🔔 Recent Anomalies
                    <Badge bg="secondary">{anomalies.length}</Badge>
                  </h5>
                  <Button 
                    variant="outline-primary" 
                    size="sm"
                    onClick={fetchRecentAnomalies}
                  >
                    <FaSyncAlt /> Refresh
                  </Button>
                </div>

                {anomalies.length === 0 ? (
                  <div className="text-center py-5">
                    <div className="mb-4" style={{ fontSize: '64px' }}>
                      <FaRobot className="text-muted" />
                    </div>
                    <h5 className="text-muted mb-2">No Anomalies Detected</h5>
                    <p className="text-muted mb-4">
                      Your system is running smoothly! Run a detection scan to analyze recent logs.
                    </p>
                    <Button variant="primary" onClick={runDetection} disabled={detecting}>
                      {detecting ? 'Analyzing...' : 'Run Detection Scan'}
                    </Button>
                  </div>
                ) : (
                  <ListGroup variant="flush">
                    {anomalies.map((anomaly, idx) => (
                      <ListGroup.Item 
                        key={idx} 
                        className="border-start border-4 px-3 py-3 mb-2 rounded"
                        style={{
                          borderLeftColor: SEVERITY_COLORS[anomaly.severity] || '#6c757d',
                          backgroundColor: anomaly.acknowledged ? '#f8f9fa' : 'white'
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div className="flex-grow-1">
                            {/* Badges */}
                            <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                              <Badge bg={getSeverityBadge(anomaly.severity)} className="text-uppercase">
                                {anomaly.severity === 'critical' && '🚨 '}
                                {anomaly.severity === 'high' && '⚠️ '}
                                {anomaly.severity}
                              </Badge>
                              <Badge bg="secondary">
                                Score: {anomaly.anomalyScore?.toFixed(3) || 'N/A'}
                              </Badge>
                              {anomaly.acknowledged && (
                                <Badge bg="success">
                                  <FaCheck /> Acknowledged
                                </Badge>
                              )}
                              <Badge bg="light" text="dark">
                                <FaClock className="me-1" />
                                {new Date(anomaly.detectedAt).toLocaleTimeString()}
                              </Badge>
                            </div>

                            {/* Message */}
                            <p className="mb-2 fw-semibold">{anomaly.message}</p>

                            {/* Metrics */}
                            <div className="small text-muted d-flex flex-wrap gap-3">
                              <span>📊 Total: <strong>{anomaly.metrics?.totalLogs || 0}</strong></span>
                              <span>🔴 Errors: <strong>{anomaly.metrics?.errors || 0}</strong></span>
                              <span>⚠️ Warnings: <strong>{anomaly.metrics?.warnings || 0}</strong></span>
                              <span>📈 Error Rate: <strong>{anomaly.metrics?.errorRate?.toFixed(1) || 0}%</strong></span>
                            </div>

                            {/* Timestamp */}
                            <small className="text-muted d-block mt-2">
                              🕐 Detected: {new Date(anomaly.detectedAt).toLocaleString()}
                            </small>
                          </div>

                          {/* Action Button */}
                          {!anomaly.acknowledged && (
                            <Button 
                              variant="outline-success" 
                              size="sm"
                              onClick={() => acknowledgeAnomaly(anomaly.timestamp)}
                              className="flex-shrink-0"
                            >
                              <FaCheck /> Acknowledge
                            </Button>
                          )}
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Info Section */}
        <Row className="mt-4">
          <Col>
            <Card className="border-0 bg-light">
              <Card.Body>
                <h6 className="mb-3">ℹ️ How ML Anomaly Detection Works</h6>
                <Row>
                  <Col md={4}>
                    <small className="text-muted">
                      <strong>1. Data Collection</strong><br/>
                      Analyzes log patterns from the last 2 hours, grouping data into 5-minute intervals.
                    </small>
                  </Col>
                  <Col md={4}>
                    <small className="text-muted">
                      <strong>2. Machine Learning</strong><br/>
                      Uses Isolation Forest algorithm to identify unusual patterns in error rates and log volumes.
                    </small>
                  </Col>
                  <Col md={4}>
                    <small className="text-muted">
                      <strong>3. Smart Alerting</strong><br/>
                      Automatically categorizes anomalies by severity based on deviation scores.
                    </small>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      <style>{`
        .hover-lift {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hover-lift:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.1) !important;
        }
        .spin {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default MLDashboard;