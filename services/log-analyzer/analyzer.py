from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import redis
import os
from datetime import datetime, timedelta
from collections import Counter

app = FastAPI(title="LogVizPro Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB connections
mongo_client = MongoClient(os.getenv('MONGO_URI'))
db = mongo_client.logvizpro
logs_collection = db.logs

redis_client = redis.from_url(os.getenv('REDIS_URL'), decode_responses=True)

@app.get("/health")
def health():
    return {"status": "healthy", "service": "log-analyzer"}

@app.get("/api/analytics/summary")
def get_summary(hours: int = Query(24, ge=1, le=168)):
    try:
        # Calculate time range
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Query logs
        logs = list(logs_collection.find({
            "timestamp": {"$gte": start_time.isoformat()}
        }))
        
        total_logs = len(logs)
        
        # Count by level
        levels = Counter([log.get('level', 'info') for log in logs])
        
        # Count by service
        services = Counter([log.get('service', 'unknown') for log in logs])
        
        # Calculate error rate
        error_count = levels.get('error', 0) + levels.get('fatal', 0)
        error_rate = (error_count / total_logs * 100) if total_logs > 0 else 0
        
        return {
            "success": True,
            "data": {
                "totalLogs": total_logs,
                "errorRate": round(error_rate, 2),
                "timeRange": f"{hours}h",
                "byLevel": dict(levels),
                "byService": dict(services.most_common(10)),
                "topErrors": [
                    {"message": log['message'][:100], "service": log.get('service')} 
                    for log in logs if log.get('level') in ['error', 'fatal']
                ][:5]
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/analytics/trends")
def get_trends(hours: int = Query(24)):
    try:
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        logs = list(logs_collection.find({
            "timestamp": {"$gte": start_time.isoformat()}
        }).sort("timestamp", 1))
        
        # Group by hour
        hourly_data = {}
        for log in logs:
            hour = log['timestamp'][:13]  # YYYY-MM-DDTHH
            if hour not in hourly_data:
                hourly_data[hour] = {"total": 0, "errors": 0}
            hourly_data[hour]["total"] += 1
            if log.get('level') in ['error', 'fatal']:
                hourly_data[hour]["errors"] += 1
        
        trends = [
            {"time": k, "total": v["total"], "errors": v["errors"]}
            for k, v in sorted(hourly_data.items())
        ]
        
        return {"success": True, "data": trends}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv('PORT', 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)