from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import redis
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import os
import logging
from collections import defaultdict
import joblib
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Enhanced ML Anomaly Detector")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB connections
mongo_client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017'))
db = mongo_client.logvizpro
logs_collection = db.logs
anomalies_collection = db.anomalies

redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'), decode_responses=True)

# IST timezone
IST = ZoneInfo("Asia/Kolkata")

# Model persistence
MODEL_DIR = Path("models")
MODEL_DIR.mkdir(exist_ok=True)
MODEL_PATH = MODEL_DIR / "isolation_forest.pkl"
SCALER_PATH = MODEL_DIR / "scaler.pkl"

def get_ist_time():
    """Get current time in IST"""
    return datetime.now(IST)

def utc_to_ist(dt):
    """Convert UTC datetime to IST"""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)

class AnomalyDetector:
    """Enhanced anomaly detection with persistent learning"""
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_names = [
            'total_logs', 'errors', 'warnings', 'error_rate', 'warn_rate',
            'unique_services', 'unique_users', 'avg_response_time',
            'status_5xx_count', 'status_4xx_count', 'log_velocity'
        ]
        self.load_or_create_model()
    
    def load_or_create_model(self):
        """Load existing model or create new one"""
        try:
            if MODEL_PATH.exists() and SCALER_PATH.exists():
                self.model = joblib.load(MODEL_PATH)
                self.scaler = joblib.load(SCALER_PATH)
                logger.info("Loaded existing model and scaler")
            else:
                self.model = IsolationForest(
                    contamination=0.1,
                    random_state=42,
                    n_estimators=200,
                    max_samples=256,
                    bootstrap=True,
                    n_jobs=-1
                )
                self.scaler = StandardScaler()
                logger.info("Created new model and scaler")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            self.model = IsolationForest(contamination=0.1, random_state=42)
            self.scaler = StandardScaler()
    
    def save_model(self):
        """Persist model to disk"""
        try:
            joblib.dump(self.model, MODEL_PATH)
            joblib.dump(self.scaler, SCALER_PATH)
            logger.info("Model and scaler saved successfully")
        except Exception as e:
            logger.error(f"Error saving model: {e}")
    
    def extract_features(self, logs, time_buckets):
        """Extract enhanced features from logs"""
        features = []
        timestamps = []
        
        for bucket_time, counts in sorted(time_buckets.items()):
            # Get logs for this bucket
            bucket_logs = [
                log for log in logs 
                if self._get_bucket_time(log['timestamp']) == bucket_time
            ]
            
            # Calculate rates
            total = counts["total"]
            error_rate = (counts["errors"] / total * 100) if total > 0 else 0
            warn_rate = (counts["warns"] / total * 100) if total > 0 else 0
            
            # Extract additional features
            unique_services = len(set(log.get('service', 'unknown') for log in bucket_logs))
            unique_users = len(set(log.get('userId', 'unknown') for log in bucket_logs))
            
            # Response time analysis
            response_times = [
                log.get('responseTime', 0) 
                for log in bucket_logs 
                if log.get('responseTime')
            ]
            avg_response_time = np.mean(response_times) if response_times else 0
            
            # HTTP status codes
            status_5xx = sum(1 for log in bucket_logs if str(log.get('statusCode', '')).startswith('5'))
            status_4xx = sum(1 for log in bucket_logs if str(log.get('statusCode', '')).startswith('4'))
            
            # Log velocity (logs per minute in this bucket)
            log_velocity = total / 5.0
            
            feature_vector = [
                total,
                counts["errors"],
                counts["warns"],
                error_rate,
                warn_rate,
                unique_services,
                unique_users,
                avg_response_time,
                status_5xx,
                status_4xx,
                log_velocity
            ]
            
            features.append(feature_vector)
            timestamps.append(bucket_time)
        
        return np.array(features), timestamps
    
    def _get_bucket_time(self, timestamp_str):
        """Convert timestamp to bucket key (in IST)"""
        try:
            if isinstance(timestamp_str, str):
                timestamp_str = timestamp_str.replace('Z', '+00:00')
                timestamp = datetime.fromisoformat(timestamp_str)
            else:
                timestamp = timestamp_str
            
            # Convert to IST
            timestamp_ist = utc_to_ist(timestamp)
            
            bucket = timestamp_ist.replace(
                minute=(timestamp_ist.minute // 5) * 5, 
                second=0, 
                microsecond=0
            )
            return bucket.isoformat()
        except Exception as e:
            logger.warning(f"Error getting bucket time: {e}")
            return None
    
    def detect(self, features_array, timestamps, features_list):
        """Detect anomalies with confidence scores"""
        # Scale features
        features_scaled = self.scaler.fit_transform(features_array)
        
        # Detect anomalies
        predictions = self.model.fit_predict(features_scaled)
        scores = self.model.score_samples(features_scaled)
        
        # Calculate dynamic thresholds based on score distribution
        score_mean = np.mean(scores)
        score_std = np.std(scores)
        
        anomalies = []
        for i, (pred, score) in enumerate(zip(predictions, scores)):
            if pred == -1:  # Anomaly detected
                # Calculate confidence (how far from normal)
                z_score = abs((score - score_mean) / score_std) if score_std > 0 else 0
                confidence = min(z_score / 3.0, 1.0)
                
                # Dynamic severity based on Z-score
                if z_score > 3:
                    severity = "critical"
                elif z_score > 2:
                    severity = "high"
                elif z_score > 1:
                    severity = "medium"
                else:
                    severity = "low"
                
                # Identify primary cause
                feature_values = features_list[i]
                causes = self._identify_causes(feature_values)
                
                anomaly = {
                    "timestamp": timestamps[i],
                    "timestampIST": timestamps[i],  # Already in IST format
                    "severity": severity,
                    "anomalyScore": float(score),
                    "confidence": float(confidence),
                    "zScore": float(z_score),
                    "metrics": {
                        "totalLogs": int(feature_values[0]),
                        "errors": int(feature_values[1]),
                        "warnings": int(feature_values[2]),
                        "errorRate": float(feature_values[3]),
                        "warnRate": float(feature_values[4]),
                        "uniqueServices": int(feature_values[5]),
                        "uniqueUsers": int(feature_values[6]),
                        "avgResponseTime": float(feature_values[7]),
                        "status5xx": int(feature_values[8]),
                        "status4xx": int(feature_values[9]),
                        "logVelocity": float(feature_values[10])
                    },
                    "primaryCauses": causes,
                    "message": self._generate_message(feature_values, causes),
                    "detectedAt": get_ist_time().isoformat(),
                    "acknowledged": False
                }
                anomalies.append(anomaly)
        
        return anomalies
    
    def _identify_causes(self, features):
        """Identify what caused the anomaly"""
        causes = []
        
        # High error rate
        if features[3] > 20:
            causes.append(f"High error rate: {features[3]:.1f}%")
        
        # High response time
        if features[7] > 2000:
            causes.append(f"Slow response times: {features[7]:.0f}ms")
        
        # Many 5xx errors
        if features[8] > 10:
            causes.append(f"Server errors: {int(features[8])} 5xx responses")
        
        # Traffic spike
        if features[10] > 100:
            causes.append(f"Traffic spike: {features[10]:.1f} logs/min")
        
        # Low traffic (potential outage)
        if features[0] < 5:
            causes.append("Unusually low traffic (potential outage)")
        
        if not causes:
            causes.append("Pattern deviation detected")
        
        return causes
    
    def _generate_message(self, features, causes):
        """Generate human-readable message"""
        primary_cause = causes[0] if causes else "Unusual pattern"
        return f"{primary_cause} - {int(features[1])} errors, {int(features[2])} warnings in 5-min window"

# Initialize detector
detector = AnomalyDetector()

@app.get("/health")
def health():
    return {
        "status": "healthy", 
        "service": "ml-analyzer",
        "model_loaded": detector.model is not None,
        "currentTime": get_ist_time().isoformat(),
        "timezone": "Asia/Kolkata (IST)"
    }

@app.get("/api/ml/detect-anomalies")
def detect_anomalies(
    hours: int = Query(default=24, ge=1, le=168, description="Hours of data to analyze"),
    min_confidence: float = Query(default=0.5, ge=0, le=1, description="Minimum confidence threshold")
):
    """Detect anomalies with enhanced ML analysis"""
    try:
        # Get logs (using UTC for MongoDB query)
        time_ago = datetime.now(timezone.utc) - timedelta(hours=hours)
        logs = list(logs_collection.find({
            "timestamp": {"$gte": time_ago.isoformat()}
        }))
        
        if len(logs) < 50:
            return {
                "success": True,
                "message": f"Not enough data (have {len(logs)}, need 50+)",
                "anomalies": [],
                "totalLogs": len(logs),
                "currentTime": get_ist_time().isoformat()
            }
        
        # Group into time buckets
        time_buckets = defaultdict(lambda: {"total": 0, "errors": 0, "warns": 0})
        
        for log in logs:
            try:
                bucket_key = detector._get_bucket_time(log['timestamp'])
                if bucket_key:
                    time_buckets[bucket_key]["total"] += 1
                    if log.get('level') == 'error':
                        time_buckets[bucket_key]["errors"] += 1
                    elif log.get('level') == 'warn':
                        time_buckets[bucket_key]["warns"] += 1
            except Exception as e:
                logger.warning(f"Error processing log: {e}")
                continue
        
        if len(time_buckets) < 3:
            return {
                "success": True,
                "message": "Not enough time buckets",
                "anomalies": [],
                "buckets": len(time_buckets),
                "currentTime": get_ist_time().isoformat()
            }
        
        # Extract features
        features_array, timestamps = detector.extract_features(logs, time_buckets)
        
        # Detect anomalies
        anomalies = detector.detect(features_array, timestamps, features_array.tolist())
        
        # Filter by confidence
        filtered_anomalies = [
            a for a in anomalies 
            if a.get('confidence', 0) >= min_confidence
        ]
        
        # Save to database
        for anomaly in filtered_anomalies:
            try:
                anomalies_collection.insert_one(anomaly.copy())
            except Exception as e:
                logger.error(f"Failed to save anomaly: {e}")
        
        # Save updated model periodically
        if len(features_array) >= 50:
            detector.save_model()
        
        logger.info(f"Detected {len(filtered_anomalies)} high-confidence anomalies")
        
        return {
            "success": True,
            "anomalies": filtered_anomalies,
            "totalBuckets": len(features_array),
            "totalAnomalies": len(anomalies),
            "filteredAnomalies": len(filtered_anomalies),
            "analysisWindow": f"{hours} hours",
            "totalLogs": len(logs),
            "minConfidence": min_confidence,
            "currentTime": get_ist_time().isoformat(),
            "timezone": "IST"
        }
        
    except Exception as e:
        logger.error(f"Error in anomaly detection: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": "Anomaly detection failed",
            "currentTime": get_ist_time().isoformat()
        }

@app.get("/api/ml/anomalies/recent")
def get_recent_anomalies(
    limit: int = Query(default=20, ge=1, le=100),
    severity: str = Query(default=None, regex="^(critical|high|medium|low)$")
):
    """Get recent anomalies with optional filtering"""
    try:
        query = {}
        if severity:
            query["severity"] = severity
        
        anomalies = list(anomalies_collection.find(
            query,
            {"_id": 0}
        ).sort("detectedAt", -1).limit(limit))
        
        return {
            "success": True,
            "anomalies": anomalies,
            "count": len(anomalies),
            "filter": {"severity": severity} if severity else None,
            "currentTime": get_ist_time().isoformat(),
            "timezone": "IST"
        }
    except Exception as e:
        logger.error(f"Error fetching anomalies: {e}")
        return {"success": False, "error": str(e), "anomalies": []}

@app.post("/api/ml/anomalies/{timestamp}/acknowledge")
def acknowledge_anomaly(timestamp: str):
    """Mark anomaly as acknowledged"""
    try:
        result = anomalies_collection.update_one(
            {"timestamp": timestamp},
            {"$set": {
                "acknowledged": True,
                "acknowledgedAt": get_ist_time().isoformat()
            }}
        )
        
        return {
            "success": True,
            "modified": result.modified_count,
            "message": "Acknowledged" if result.modified_count > 0 else "Not found",
            "acknowledgedAt": get_ist_time().isoformat()
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/ml/stats")
def get_ml_stats():
    """Get comprehensive ML statistics"""
    try:
        total = anomalies_collection.count_documents({})
        acknowledged = anomalies_collection.count_documents({"acknowledged": True})
        
        # Severity distribution
        severity_dist = {}
        for sev in ["critical", "high", "medium", "low"]:
            count = anomalies_collection.count_documents({"severity": sev})
            if count > 0:
                severity_dist[sev] = count
        
        # Recent trend (last 24 hours in IST)
        day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_count = anomalies_collection.count_documents({
            "detectedAt": {"$gte": day_ago.isoformat()}
        })
        
        return {
            "success": True,
            "stats": {
                "totalAnomalies": total,
                "acknowledged": acknowledged,
                "pending": total - acknowledged,
                "severityDistribution": severity_dist,
                "last24Hours": recent_count,
                "modelStatus": {
                    "trained": detector.model is not None,
                    "features": len(detector.feature_names),
                    "algorithm": "Isolation Forest"
                }
            },
            "currentTime": get_ist_time().isoformat(),
            "timezone": "IST"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/ml/retrain")
def retrain_model():
    """Manually trigger model retraining"""
    try:
        # Get historical data
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        logs = list(logs_collection.find({
            "timestamp": {"$gte": week_ago.isoformat()}
        }).limit(10000))
        
        if len(logs) < 100:
            return {
                "success": False,
                "message": "Not enough historical data for retraining",
                "currentTime": get_ist_time().isoformat()
            }
        
        # Process and retrain
        time_buckets = defaultdict(lambda: {"total": 0, "errors": 0, "warns": 0})
        for log in logs:
            bucket_key = detector._get_bucket_time(log['timestamp'])
            if bucket_key:
                time_buckets[bucket_key]["total"] += 1
                if log.get('level') == 'error':
                    time_buckets[bucket_key]["errors"] += 1
                elif log.get('level') == 'warn':
                    time_buckets[bucket_key]["warns"] += 1
        
        features_array, _ = detector.extract_features(logs, time_buckets)
        
        # Retrain
        features_scaled = detector.scaler.fit_transform(features_array)
        detector.model.fit(features_scaled)
        detector.save_model()
        
        logger.info(f"Model retrained on {len(features_array)} samples")
        
        return {
            "success": True,
            "message": "Model retrained successfully",
            "samplesUsed": len(features_array),
            "dataWindow": "7 days",
            "retrainedAt": get_ist_time().isoformat(),
            "timezone": "IST"
        }
    except Exception as e:
        logger.error(f"Retraining failed: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv('PORT', 8001))
    logger.info(f"Starting Enhanced ML Analyzer on port {port}")
    logger.info(f"Timezone: IST (Asia/Kolkata)")
    logger.info(f"Current IST time: {get_ist_time()}")
    uvicorn.run(app, host="0.0.0.0", port=port)