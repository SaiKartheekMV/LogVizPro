from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import redis
import numpy as np
from sklearn.ensemble import IsolationForest
from datetime import datetime, timedelta
import os
import logging
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ML Anomaly Detector")

# ✅ ADD CORS MIDDLEWARE - This fixes the error!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# DB connections
mongo_client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017'))
db = mongo_client.logvizpro
logs_collection = db.logs
anomalies_collection = db.anomalies

redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'), decode_responses=True)

@app.get("/health")
def health():
    return {"status": "healthy", "service": "ml-analyzer"}

@app.get("/api/ml/detect-anomalies")
def detect_anomalies():
    """Detect anomalies in log patterns"""
    try:
        # Get last 2 hours of logs
        two_hours_ago = datetime.utcnow() - timedelta(hours=2)
        
        logs = list(logs_collection.find({
            "timestamp": {"$gte": two_hours_ago.isoformat()}
        }))
        
        if len(logs) < 50:
            return {
                "success": True,
                "message": "Not enough data for analysis (minimum 50 logs required)",
                "anomalies": [],
                "totalLogs": len(logs),
                "minRequired": 50
            }
        
        # Group logs by 5-minute intervals
        time_buckets = defaultdict(lambda: {"total": 0, "errors": 0, "warns": 0})
        
        for log in logs:
            try:
                # Handle different timestamp formats
                timestamp_str = log['timestamp']
                if isinstance(timestamp_str, str):
                    # Remove 'Z' and parse
                    timestamp_str = timestamp_str.replace('Z', '+00:00')
                    timestamp = datetime.fromisoformat(timestamp_str)
                else:
                    timestamp = timestamp_str
                
                bucket = timestamp.replace(minute=(timestamp.minute // 5) * 5, second=0, microsecond=0)
                bucket_key = bucket.isoformat()
                
                time_buckets[bucket_key]["total"] += 1
                if log.get('level') == 'error':
                    time_buckets[bucket_key]["errors"] += 1
                elif log.get('level') == 'warn':
                    time_buckets[bucket_key]["warns"] += 1
            except Exception as e:
                logger.warning(f"Error processing log timestamp: {e}")
                continue
        
        if len(time_buckets) < 5:
            return {
                "success": True,
                "message": "Not enough time buckets for analysis",
                "anomalies": [],
                "totalLogs": len(logs),
                "buckets": len(time_buckets)
            }
        
        # Prepare features for ML
        features = []
        timestamps = []
        
        for bucket_time, counts in sorted(time_buckets.items()):
            error_rate = (counts["errors"] / counts["total"] * 100) if counts["total"] > 0 else 0
            warn_rate = (counts["warns"] / counts["total"] * 100) if counts["total"] > 0 else 0
            
            features.append([
                counts["total"],
                counts["errors"],
                counts["warns"],
                error_rate,
                warn_rate
            ])
            timestamps.append(bucket_time)
        
        features_array = np.array(features)
        
        # Train Isolation Forest
        model = IsolationForest(
            contamination=0.15,  # Expect 15% anomalies
            random_state=42,
            n_estimators=100
        )
        
        predictions = model.fit_predict(features_array)
        scores = model.score_samples(features_array)
        
        # Find anomalies
        anomalies = []
        for i, (pred, score) in enumerate(zip(predictions, scores)):
            if pred == -1:  # Anomaly detected
                severity = "critical" if score < -0.6 else "high" if score < -0.4 else "medium"
                
                anomaly = {
                    "timestamp": timestamps[i],
                    "severity": severity,
                    "anomalyScore": float(score),
                    "metrics": {
                        "totalLogs": int(features[i][0]),
                        "errors": int(features[i][1]),
                        "warnings": int(features[i][2]),
                        "errorRate": float(features[i][3]),
                        "warnRate": float(features[i][4])
                    },
                    "message": f"Unusual pattern detected: {int(features[i][1])} errors, {int(features[i][2])} warnings in 5-minute window",
                    "detectedAt": datetime.utcnow().isoformat(),
                    "acknowledged": False
                }
                anomalies.append(anomaly)
                
                # Save to database
                try:
                    anomalies_collection.insert_one(anomaly.copy())
                except Exception as e:
                    logger.error(f"Failed to save anomaly: {e}")
        
        logger.info(f"Detected {len(anomalies)} anomalies out of {len(features)} time buckets")
        
        return {
            "success": True,
            "anomalies": anomalies,
            "totalBuckets": len(features),
            "anomalyCount": len(anomalies),
            "analysisWindow": "2 hours",
            "totalLogs": len(logs)
        }
        
    except Exception as e:
        logger.error(f"Error in anomaly detection: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": "Anomaly detection failed. Check logs for details."
        }

@app.get("/api/ml/anomalies/recent")
def get_recent_anomalies(limit: int = 20):
    """Get recent detected anomalies"""
    try:
        anomalies = list(anomalies_collection.find(
            {},
            {"_id": 0}
        ).sort("detectedAt", -1).limit(limit))
        
        return {
            "success": True,
            "anomalies": anomalies,
            "count": len(anomalies)
        }
    except Exception as e:
        logger.error(f"Error fetching anomalies: {e}")
        return {
            "success": False,
            "error": str(e),
            "anomalies": []
        }

@app.post("/api/ml/anomalies/{timestamp}/acknowledge")
def acknowledge_anomaly(timestamp: str):
    """Mark anomaly as acknowledged"""
    try:
        result = anomalies_collection.update_one(
            {"timestamp": timestamp},
            {"$set": {
                "acknowledged": True,
                "acknowledgedAt": datetime.utcnow().isoformat()
            }}
        )
        
        return {
            "success": True,
            "modified": result.modified_count,
            "message": "Anomaly acknowledged" if result.modified_count > 0 else "Anomaly not found"
        }
    except Exception as e:
        logger.error(f"Error acknowledging anomaly: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/ml/stats")
def get_ml_stats():
    """Get ML service statistics"""
    try:
        total_anomalies = anomalies_collection.count_documents({})
        acknowledged = anomalies_collection.count_documents({"acknowledged": True})
        pending = total_anomalies - acknowledged
        
        # Get severity distribution
        severity_dist = {}
        for severity in ["critical", "high", "medium", "low"]:
            count = anomalies_collection.count_documents({"severity": severity})
            if count > 0:
                severity_dist[severity] = count
        
        return {
            "success": True,
            "stats": {
                "totalAnomalies": total_anomalies,
                "acknowledged": acknowledged,
                "pending": pending,
                "severityDistribution": severity_dist
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv('PORT', 8001))
    logger.info(f"Starting ML Analyzer on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)