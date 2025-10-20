import { Card, Badge, Button } from 'react-bootstrap';
import { FaBell, FaTrash } from 'react-icons/fa';

function AlertCard({ alert, onDelete }) {
  const getBadgeVariant = (severity) => {
    const variants = {
      critical: 'danger',
      warning: 'warning',
      info: 'info',
    };
    return variants[severity] || 'secondary';
  };

  return (
    <Card className="mb-3 shadow-sm">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center mb-2">
              <FaBell className="text-primary me-2" />
              <Card.Title className="mb-0">{alert.name}</Card.Title>
              <Badge bg={getBadgeVariant(alert.severity)} className="ms-2">
                {alert.severity}
              </Badge>
            </div>
            <Card.Text className="text-muted mb-2">
              {alert.description}
            </Card.Text>
            <div className="small text-muted">
              <strong>Condition:</strong> {alert.condition} | 
              <strong className="ms-2">Threshold:</strong> {alert.threshold}
            </div>
          </div>
          <Button 
            variant="outline-danger" 
            size="sm" 
            onClick={() => onDelete(alert.id)}
          >
            <FaTrash />
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}

export default AlertCard;