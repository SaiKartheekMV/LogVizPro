from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB Connection
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://mongodb:27017/')
client = MongoClient(MONGO_URI)
db = client['logviz_db']
logs_collection = db['logs']

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "log-collector"}), 200

@app.route('/logs', methods=['POST'])
def collect_logs():
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data or 'message' not in data:
            return jsonify({"error": "Missing 'message' field"}), 400
        
        # Prepare log entry
        log_entry = {
            "message": data.get('message'),
            "level": data.get('level', 'INFO'),
            "source": data.get('source', 'unknown'),
            "timestamp": datetime.utcnow(),
            "metadata": data.get('metadata', {})
        }
        
        # Insert into MongoDB
        result = logs_collection.insert_one(log_entry)
        
        return jsonify({
            "status": "success",
            "log_id": str(result.inserted_id)
        }), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/logs', methods=['GET'])
def get_logs():
    try:
        # Pagination
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        skip = (page - 1) * limit
        
        # Filters
        level = request.args.get('level')
        source = request.args.get('source')
        
        query = {}
        if level:
            query['level'] = level
        if source:
            query['source'] = source
        
        # Fetch logs
        logs = list(logs_collection.find(query).sort('timestamp', -1).skip(skip).limit(limit))
        
        # Convert ObjectId to string
        for log in logs:
            log['_id'] = str(log['_id'])
            log['timestamp'] = log['timestamp'].isoformat()
        
        total = logs_collection.count_documents(query)
        
        return jsonify({
            "logs": logs,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/logs/stats', methods=['GET'])
def get_stats():
    try:
        pipeline = [
            {
                "$group": {
                    "_id": "$level",
                    "count": {"$sum": 1}
                }
            }
        ]
        
        stats = list(logs_collection.aggregate(pipeline))
        
        return jsonify({"stats": stats}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)