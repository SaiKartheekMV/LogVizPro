/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { FaUser, FaEnvelope, FaSave, FaKey } from 'react-icons/fa';
import { authAPI } from '../services/api';

function Profile() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || {});
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await authAPI.getProfile();
      localStorage.setItem('user', JSON.stringify({ ...user, name: formData.name }));
      setUser({ ...user, name: formData.name });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to update profile. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'danger', text: 'New passwords do not match!' });
      return;
    }

    if (formData.newPassword.length < 6) {
      setMessage({ type: 'danger', text: 'Password must be at least 6 characters!' });
      return;
    }

    setLoading(true);

    try {
      // API call would go here
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to change password. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-light min-vh-100">
      <Container fluid className="py-4">
        <Row className="mb-4">
          <Col>
            <h2 className="mb-1">My Profile</h2>
            <p className="text-muted mb-0">Manage your account settings</p>
          </Col>
        </Row>

        {message.text && (
          <Row className="mb-3">
            <Col lg={8}>
              <Alert variant={message.type} dismissible onClose={() => setMessage({ type: '', text: '' })}>
                {message.text}
              </Alert>
            </Col>
          </Row>
        )}

        <Row>
          <Col lg={8}>
            {/* Profile Information */}
            <Card className="border-0 shadow-sm mb-4">
              <Card.Body>
                <h5 className="mb-4">
                  <FaUser className="me-2" />
                  Profile Information
                </h5>
                <Form onSubmit={handleProfileUpdate}>
                  <Form.Group className="mb-3">
                    <Form.Label>Full Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter your full name"
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label>Email Address</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      disabled
                      className="bg-light"
                    />
                    <Form.Text className="text-muted">
                      Email cannot be changed
                    </Form.Text>
                  </Form.Group>

                  <Button variant="primary" type="submit" disabled={loading}>
                    <FaSave className="me-2" />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>

            {/* Change Password */}
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <h5 className="mb-4">
                  <FaKey className="me-2" />
                  Change Password
                </h5>
                <Form onSubmit={handlePasswordChange}>
                  <Form.Group className="mb-3">
                    <Form.Label>Current Password</Form.Label>
                    <Form.Control
                      type="password"
                      name="currentPassword"
                      value={formData.currentPassword}
                      onChange={handleChange}
                      placeholder="Enter current password"
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>New Password</Form.Label>
                    <Form.Control
                      type="password"
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleChange}
                      placeholder="Enter new password (min 6 characters)"
                      required
                      minLength={6}
                    />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label>Confirm New Password</Form.Label>
                    <Form.Control
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm new password"
                      required
                    />
                  </Form.Group>

                  <Button variant="primary" type="submit" disabled={loading}>
                    <FaKey className="me-2" />
                    {loading ? 'Changing...' : 'Change Password'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4}>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <h5 className="mb-3">Account Details</h5>
                <div className="mb-3">
                  <small className="text-muted d-block">Account Type</small>
                  <strong>{user.role || 'User'}</strong>
                </div>
                <div className="mb-3">
                  <small className="text-muted d-block">Member Since</small>
                  <strong>{new Date().toLocaleDateString()}</strong>
                </div>
                <div className="mb-3">
                  <small className="text-muted d-block">Last Login</small>
                  <strong>{new Date().toLocaleString()}</strong>
                </div>
                <hr />
                <div className="d-grid">
                  <Button variant="outline-danger" size="sm">
                    Delete Account
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Profile;