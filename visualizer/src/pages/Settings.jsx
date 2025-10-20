import { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { FaCog, FaBell, FaPalette, FaSave } from 'react-icons/fa';

function Settings() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    alertSound: true,
    theme: 'dark',
    refreshInterval: '30',
    logsPerPage: '50',
    dateFormat: 'locale',
    timeZone: 'UTC',
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('appSettings', JSON.stringify(settings));
    setMessage('Settings saved successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="bg-light min-vh-100">
      <Container fluid className="py-4">
        <Row className="mb-4">
          <Col>
            <h2 className="mb-1">Settings</h2>
            <p className="text-muted mb-0">Customize your LogVizPro experience</p>
          </Col>
        </Row>

        {message && (
          <Row className="mb-3">
            <Col lg={8}>
              <Alert variant="success" dismissible onClose={() => setMessage('')}>
                {message}
              </Alert>
            </Col>
          </Row>
        )}

        <Form onSubmit={handleSubmit}>
          <Row>
            <Col lg={8}>
              {/* Notification Settings */}
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body>
                  <h5 className="mb-4">
                    <FaBell className="me-2" />
                    Notifications
                  </h5>
                  <Form.Group className="mb-3">
                    <Form.Check
                      type="switch"
                      id="emailNotifications"
                      name="emailNotifications"
                      label="Email Notifications"
                      checked={settings.emailNotifications}
                      onChange={handleChange}
                    />
                    <Form.Text className="text-muted ms-4">
                      Receive email alerts when critical events occur
                    </Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Check
                      type="switch"
                      id="pushNotifications"
                      name="pushNotifications"
                      label="Push Notifications"
                      checked={settings.pushNotifications}
                      onChange={handleChange}
                    />
                    <Form.Text className="text-muted ms-4">
                      Get browser notifications for alerts
                    </Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Check
                      type="switch"
                      id="alertSound"
                      name="alertSound"
                      label="Alert Sound"
                      checked={settings.alertSound}
                      onChange={handleChange}
                    />
                    <Form.Text className="text-muted ms-4">
                      Play sound when new alerts are triggered
                    </Form.Text>
                  </Form.Group>
                </Card.Body>
              </Card>

              {/* Appearance Settings */}
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body>
                  <h5 className="mb-4">
                    <FaPalette className="me-2" />
                    Appearance
                  </h5>
                  <Form.Group className="mb-3">
                    <Form.Label>Theme</Form.Label>
                    <Form.Select name="theme" value={settings.theme} onChange={handleChange}>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">Auto (System)</option>
                    </Form.Select>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Date Format</Form.Label>
                    <Form.Select name="dateFormat" value={settings.dateFormat} onChange={handleChange}>
                      <option value="locale">Local Format</option>
                      <option value="iso">ISO 8601</option>
                      <option value="us">US Format (MM/DD/YYYY)</option>
                      <option value="eu">EU Format (DD/MM/YYYY)</option>
                    </Form.Select>
                  </Form.Group>
                </Card.Body>
              </Card>

              {/* Display Settings */}
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body>
                  <h5 className="mb-4">
                    <FaCog className="me-2" />
                    Display Settings
                  </h5>
                  <Form.Group className="mb-3">
                    <Form.Label>Auto Refresh Interval (seconds)</Form.Label>
                    <Form.Select name="refreshInterval" value={settings.refreshInterval} onChange={handleChange}>
                      <option value="10">10 seconds</option>
                      <option value="30">30 seconds</option>
                      <option value="60">1 minute</option>
                      <option value="300">5 minutes</option>
                      <option value="0">Disabled</option>
                    </Form.Select>
                    <Form.Text className="text-muted">
                      How often to refresh dashboard data
                    </Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Logs Per Page</Form.Label>
                    <Form.Select name="logsPerPage" value={settings.logsPerPage} onChange={handleChange}>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="200">200</option>
                    </Form.Select>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Time Zone</Form.Label>
                    <Form.Select name="timeZone" value={settings.timeZone} onChange={handleChange}>
                      <option value="UTC">UTC</option>
                      <option value="local">Local Time</option>
                      <option value="EST">EST</option>
                      <option value="PST">PST</option>
                      <option value="IST">IST</option>
                    </Form.Select>
                  </Form.Group>
                </Card.Body>
              </Card>

              <div className="d-flex gap-2">
                <Button variant="primary" type="submit">
                  <FaSave className="me-2" />
                  Save Settings
                </Button>
                <Button variant="outline-secondary" type="button">
                  Reset to Defaults
                </Button>
              </div>
            </Col>

            <Col lg={4}>
              <Card className="border-0 shadow-sm">
                <Card.Body>
                  <h5 className="mb-3">💡 Tips</h5>
                  <ul className="small ps-3">
                    <li className="mb-2">Enable email notifications to stay updated on critical issues</li>
                    <li className="mb-2">Adjust refresh interval based on your monitoring needs</li>
                    <li className="mb-2">Dark theme reduces eye strain during extended use</li>
                    <li className="mb-2">Export logs regularly for compliance and auditing</li>
                  </ul>
                  <hr />
                  <div className="small text-muted">
                    <p className="mb-1"><strong>Version:</strong> 1.0.0</p>
                    <p className="mb-0"><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Form>
      </Container>
    </div>
  );
}

export default Settings;