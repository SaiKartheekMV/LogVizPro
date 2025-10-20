/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, Alert } from 'react-bootstrap';
import { FaPlus, FaBell } from 'react-icons/fa';
import AlertCard from '../components/AlertCard';
import { alertsAPI } from '../services/api';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    condition: 'error_rate',
    threshold: '',
    severity: 'warning',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await alertsAPI.getAlerts();
      setAlerts(res.data.data || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      // Demo data if API fails
      setAlerts([
        {
          id: 1,
          name: 'High Error Rate',
          description: 'Triggers when error rate exceeds 10%',
          condition: 'error_rate',
          threshold: '10',
          severity: 'critical',
        },
        {
          id: 2,
          name: 'Service Down',
          description: 'No logs received from service in 5 minutes',
          condition: 'service_inactive',
          threshold: '5',
          severity: 'critical',
        },
      ]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await alertsAPI.createAlert(formData);
      setMessage('Alert created successfully!');
      setShowModal(false);
      fetchAlerts();
      setFormData({ name: '', description: '', condition: 'error_rate', threshold: '', severity: 'warning' });
      setTimeout(() => setMessage(''), 3000); 
    } catch (err) {
      alert('Failed to create alert. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      try {
        await alertsAPI.deleteAlert(id);
        setAlerts(alerts.filter(a => a.id !== id));
        setMessage('Alert deleted successfully!');
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        alert('Failed to delete alert.');
      }
    }
  };

  return (
    <div className="bg-light min-vh-100">
      <Container fluid className="py-4">
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="mb-1">Alert Management</h2>
                <p className="text-muted mb-0">Configure custom alerts for your logs</p>
              </div>
              <Button variant="primary" onClick={() => setShowModal(true)}>
                <FaPlus className="me-2" />
                Create Alert
              </Button>
            </div>
          </Col>
        </Row>

        {message && (
          <Row className="mb-3">
            <Col>
              <Alert variant="success" dismissible onClose={() => setMessage('')}>
                {message}
              </Alert>
            </Col>
          </Row>
        )}

        <Row>
          <Col lg={8}>
            {alerts.length === 0 ? (
              <Card className="border-0 shadow-sm text-center py-5">
                <Card.Body>
                  <FaBell className="fs-1 text-muted mb-3" />
                  <h5>No alerts configured</h5>
                  <p className="text-muted">Create your first alert to get notified about important events</p>
                  <Button variant="primary" onClick={() => setShowModal(true)}>
                    <FaPlus className="me-2" />
                    Create Alert
                  </Button>
                </Card.Body>
              </Card>
            ) : (
              alerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} onDelete={handleDelete} />
              ))
            )}
          </Col>
          <Col lg={4}>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <h5 className="mb-3">📚 Alert Conditions</h5>
                <div className="small">
                  <p><strong>Error Rate:</strong> Percentage of error logs</p>
                  <p><strong>Log Volume:</strong> Number of logs per minute</p>
                  <p><strong>Service Inactive:</strong> No logs from service</p>
                  <p><strong>Keyword Match:</strong> Specific text in logs</p>
                </div>
                <hr />
                <h6 className="mb-2">Severity Levels</h6>
                <div className="d-flex flex-column gap-1">
                  <span><span className="badge bg-danger">Critical</span> Immediate action required</span>
                  <span><span className="badge bg-warning">Warning</span> Should be reviewed soon</span>
                  <span><span className="badge bg-info">Info</span> For your information</span>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Create Alert Modal */}
        <Modal show={showModal} onHide={() => setShowModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Create New Alert</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Alert Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., High Error Rate"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="What does this alert monitor?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Condition</Form.Label>
                <Form.Select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                >
                  <option value="error_rate">Error Rate (%)</option>
                  <option value="log_volume">Log Volume (per min)</option>
                  <option value="service_inactive">Service Inactive (min)</option>
                  <option value="keyword_match">Keyword Match</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Threshold</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., 10 (for 10%)"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Severity</Form.Label>
                <Form.Select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </Form.Select>
              </Form.Group>

              <div className="d-flex gap-2">
                <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-grow-1">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" className="flex-grow-1">
                  Create Alert
                </Button>
              </div>
            </Form>
          </Modal.Body>
        </Modal>
      </Container>
    </div>
  );
}

export default Alerts;