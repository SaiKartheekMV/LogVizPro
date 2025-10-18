from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from pymongo import MongoClient
import redis
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# DB connections
mongo_client = MongoClient(os.getenv('MONGO_URI'))
db = mongo_client.logvizpro
logs_collection = db.logs

redis_client = redis.from_url(os.getenv('REDIS_URL'), decode_responses=True)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "log-collector"}), 200

@app.route('/api/logs', methods=['POST'])
def create_log():
    try:
        data = request.json
        log_entry = {
            "level": data.get("level", "info"),
            "message": data.get("message"),
            "service": data.get("service"),
            "timestamp": data.get("timestamp", datetime.utcnow().isoformat()),
            "metadata": data.get("metadata", {})
        }
        
        # Insert to MongoDB
        result = logs_collection.insert_one(log_entry)
        log_entry['_id'] = str(result.inserted_id)
        
        # Cache in Redis (recent 100 logs)
        redis_client.lpush("recent_logs", str(log_entry))
        redis_client.ltrim("recent_logs", 0, 99)
        
        # Emit via WebSocket
        socketio.emit('new_log', log_entry)
        
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
        
        # Convert ObjectId to string
        for log in logs:
            log['_id'] = str(log['_id'])
        
        return jsonify({"success": True, "data": logs}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@socketio.on('connect')
def handle_connect():
    emit('connected', {'message': 'Connected to LogVizPro'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3001))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)