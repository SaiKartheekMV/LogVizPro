from asyncio.log import logger
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit # type: ignore
from flask_cors import CORS
from pymongo import MongoClient
import redis # type: ignore
import os
import jwt
import bcrypt
from datetime import datetime, timedelta
from functools import wraps
import requests
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production-2024')
SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL', '')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# DB connections
mongo_client = MongoClient(os.getenv('MONGO_URI'))
db = mongo_client.logvizpro
logs_collection = db.logs
users_collection = db.users
alerts_collection = db.alerts

redis_client = redis.from_url(os.getenv('REDIS_URL'), decode_responses=True)

# JWT decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'success': False, 'message': 'Token is missing'}), 401
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_collection.find_one({'email': data['email']})
        except:
            return jsonify({'success': False, 'message': 'Token is invalid'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def send_slack_notification(log_entry):
    """Send critical logs to Slack"""
    if not SLACK_WEBHOOK_URL or log_entry['level'] not in ['error', 'fatal']:
        return
    
    color = '#ff4444' if log_entry['level'] == 'error' else '#ff0000'
    
    message = {
        "text": f"🚨 *{log_entry['level'].upper()}* Alert from *{log_entry['service']}*",
        "attachments": [{
            "color": color,
            "fields": [
                {
                    "title": "Message",
                    "value": log_entry['message'][:200],
                    "short": False
                },
                {
                    "title": "Service",
                    "value": log_entry['service'],
                    "short": True
                },
                {
                    "title": "Time",
                    "value": log_entry['timestamp'],
                    "short": True
                }
            ],
            "footer": "LogVizPro",
            "ts": int(datetime.utcnow().timestamp())
        }]
    }
    
    try:
        requests.post(SLACK_WEBHOOK_URL, json=message, timeout=3)
    except Exception as e:
        logger.error(f"Failed to send Slack notification: {e}")




# Health check
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "log-collector"}), 200

# ============ AUTH ENDPOINTS ============

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.json
        if data is None:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        # Check if user exists
        if users_collection.find_one({'email': data['email']}):
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        # Hash password
        hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
        
        # Create user
        user = {
            'name': data['name'],
            'email': data['email'],
            'password': hashed_password,
            'role': 'user',
            'createdAt': datetime.utcnow().isoformat()
        }
        
        users_collection.insert_one(user)
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully'
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        if data is None:
            return jsonify({'success': False, 'message': 'Invalid request data'}), 400
        
        # Find user
        user = users_collection.find_one({'email': data['email']})
        
        if not user:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
        
        # Check password
        if not bcrypt.checkpw(data['password'].encode('utf-8'), user['password']):
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
        
        # Generate JWT token
        token = jwt.encode({
            'email': user['email'],
            'exp': datetime.utcnow() + timedelta(days=7)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({
            'success': True,
            'token': token,
            'user': {
                'name': user['name'],
                'email': user['email'],
                'role': user['role']
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    if current_user is None:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    return jsonify({
        'success': True,
        'user': {
            'name': current_user['name'],
            'email': current_user['email'],
            'role': current_user['role']
        }
    }), 200

# ============ LOG ENDPOINTS ============

@app.route('/api/logs', methods=['POST'])
def create_log():
    try:
        data = request.json
        log_entry = {
            "level": data.get("level", "info"), # type: ignore
            "message": data.get("message"), # type: ignore
            "service": data.get("service"), # pyright: ignore[reportOptionalMemberAccess]
            "timestamp": data.get("timestamp", datetime.utcnow().isoformat()), # type: ignore
            "metadata": data.get("metadata", {}) # type: ignore
        }
        
        result = logs_collection.insert_one(log_entry)
        log_entry['_id'] = str(result.inserted_id)
        
        redis_client.lpush("recent_logs", str(log_entry))
        redis_client.ltrim("recent_logs", 0, 99)
        
        socketio.emit('new_log', log_entry)
        
        # Send to Slack if critical
        send_slack_notification(log_entry)
        
        return jsonify({"success": True, "data": log_entry}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
@app.route('/api/logs', methods=['GET'])
def get_logs():
    try:
        level = request.args.get('level')
        service = request.args.get('service')
        limit = int(request.args.get('limit', 100))
        
        query = {}
        if level:
            query['level'] = level
        if service:
            query['service'] = service
        
        logs = list(logs_collection.find(query).sort("timestamp", -1).limit(limit))
        
        for log in logs:
            log['_id'] = str(log['_id'])
        
        return jsonify({"success": True, "data": logs}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/logs/export', methods=['GET'])
@token_required
def export_logs(current_user):
    try:
        format_type = request.args.get('format', 'json')
        logs = list(logs_collection.find().limit(1000))
        
        for log in logs:
            log['_id'] = str(log['_id'])
        
        if format_type == 'csv':
            # Simple CSV conversion
            import csv
            from io import StringIO
            
            output = StringIO()
            if logs:
                writer = csv.DictWriter(output, fieldnames=logs[0].keys())
                writer.writeheader()
                writer.writerows(logs)
            
            return output.getvalue(), 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename=logs.csv'
            }
        else:
            return jsonify(logs), 200, {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename=logs.json'
            }
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ============ ALERT ENDPOINTS ============

@app.route('/api/alerts', methods=['GET'])
@token_required
def get_alerts(current_user):
    try:
        if current_user is None:
            return jsonify({"success": False, "error": "User not found"}), 404
        
        alerts = list(alerts_collection.find({'userEmail': current_user['email']}))
        for alert in alerts:
            alert['_id'] = str(alert['_id'])
            alert['id'] = alert['_id']
        return jsonify({"success": True, "data": alerts}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/alerts', methods=['POST'])
@token_required
def create_alert(current_user):
    try:
        if current_user is None:
            return jsonify({"success": False, "error": "User not found"}), 404
        
        data = request.json
        if data is None:
            return jsonify({"success": False, "error": "Invalid request data"}), 400
        
        alert = {
            'name': data['name'],
            'description': data['description'],
            'condition': data['condition'],
            'threshold': data['threshold'],
            'severity': data['severity'],
            'userEmail': current_user['email'],
            'createdAt': datetime.utcnow().isoformat()
        }
        
        result = alerts_collection.insert_one(alert)
        alert['_id'] = str(result.inserted_id)
        alert['id'] = alert['_id']
        
        return jsonify({"success": True, "data": alert}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/alerts/<alert_id>', methods=['DELETE'])
@token_required
def delete_alert(current_user, alert_id):
    try:
        if current_user is None:
            return jsonify({"success": False, "error": "User not found"}), 404
        
        from bson import ObjectId
        result = alerts_collection.delete_one({
            '_id': ObjectId(alert_id),
            'userEmail': current_user['email']
        })
        
        if result.deleted_count:
            return jsonify({"success": True, "message": "Alert deleted"}), 200
        else:
            return jsonify({"success": False, "message": "Alert not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# WebSocket
@socketio.on('connect')
def handle_connect():
    emit('connected', {'message': 'Connected to LogVizPro'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3001))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)