from pymongo import MongoClient
import pandas as pd
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import time

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://mongodb:27017/')
client = MongoClient(MONGO_URI)
db = client['logviz_db']
logs_collection = db['logs']
analytics_collection = db['analytics']

def analyze_logs():
    print(f"[{datetime.now()}] Running log analysis...")
    
    try:
        # Get logs from last 24 hours
        time_threshold = datetime.utcnow() - timedelta(hours=24)
        logs = list(logs_collection.find({"timestamp": {"$gte": time_threshold}}))
        
        if not logs:
            print("No logs to analyze")
            return
        
        df = pd.DataFrame(logs)
        
        # Analysis 1: Count by level
        level_counts = df['level'].value_counts().to_dict()
        
        # Analysis 2: Count by source
        source_counts = df['source'].value_counts().to_dict()
        
        # Analysis 3: Error patterns
        error_logs = df[df['level'] == 'ERROR']
        error_patterns = {}
        if not error_logs.empty:
            error_patterns = error_logs['message'].value_counts().head(10).to_dict()
        
        # Analysis 4: Hourly trends
        df['hour'] = pd.to_datetime(df['timestamp']).dt.hour
        hourly_counts = df.groupby('hour').size().to_dict()
        
        # Save analytics
        analytics_entry = {
            "timestamp": datetime.utcnow(),
            "period": "24h",
            "total_logs": len(logs),
            "level_distribution": level_counts,
            "source_distribution": source_counts,
            "top_errors": error_patterns,
            "hourly_trends": hourly_counts
        }
        
        analytics_collection.insert_one(analytics_entry)
        print(f"Analysis complete. Total logs analyzed: {len(logs)}")
        
    except Exception as e:
        print(f"Error during analysis: {str(e)}")

def detect_anomalies():
    """Detect unusual patterns in logs"""
    try:
        # Get recent error rate
        time_threshold = datetime.utcnow() - timedelta(hours=1)
        recent_logs = logs_collection.count_documents({"timestamp": {"$gte": time_threshold}})
        recent_errors = logs_collection.count_documents({
            "timestamp": {"$gte": time_threshold},
            "level": "ERROR"
        })
        
        if recent_logs > 0:
            error_rate = (recent_errors / recent_logs) * 100
            if error_rate > 20:  # Alert threshold
                print(f"⚠️ HIGH ERROR RATE DETECTED: {error_rate:.2f}%")
                
                # Save anomaly
                db['anomalies'].insert_one({
                    "timestamp": datetime.utcnow(),
                    "type": "high_error_rate",
                    "value": error_rate,
                    "threshold": 20
                })
    
    except Exception as e:
        print(f"Error detecting anomalies: {str(e)}")

if __name__ == '__main__':
    print("Log Analyzer Service Started")
    
    while True:
        analyze_logs()
        detect_anomalies()
        time.sleep(300)  # Run every 5 minutes