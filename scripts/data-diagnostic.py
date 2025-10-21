"""
Diagnostic script to check why you're not getting enough buckets
"""

from pymongo import MongoClient
from datetime import datetime, timedelta
from collections import defaultdict
import os

mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
client = MongoClient(mongo_uri)
db = client.logvizpro
logs_collection = db.logs

def diagnose():
    print("=" * 60)
    print("LOG DATA DIAGNOSTIC")
    print("=" * 60)
    
    # Check total logs
    total_logs = logs_collection.count_documents({})
    print(f"\n📊 Total logs in database: {total_logs}")
    
    if total_logs == 0:
        print("❌ No logs found! Please insert logs first.")
        return
    
    # Check recent logs (last 24 hours)
    day_ago = datetime.utcnow() - timedelta(hours=24)
    recent_logs = list(logs_collection.find({
        "timestamp": {"$gte": day_ago.isoformat()}
    }).limit(1000))
    
    print(f"📅 Logs from last 24 hours: {len(recent_logs)}")
    
    if len(recent_logs) < 50:
        print(f"⚠️  WARNING: Only {len(recent_logs)} recent logs (need 50+)")
        print("   Solution: Run the log generator script to add more data")
        return
    
    # Analyze timestamps
    print("\n🕐 Timestamp Analysis:")
    timestamps = []
    invalid_count = 0
    
    for log in recent_logs:
        try:
            ts_str = log.get('timestamp', '')
            if isinstance(ts_str, str):
                ts_str = ts_str.replace('Z', '+00:00')
                timestamp = datetime.fromisoformat(ts_str)
                timestamps.append(timestamp)
        except Exception as e:
            invalid_count += 1
    
    print(f"   Valid timestamps: {len(timestamps)}")
    print(f"   Invalid timestamps: {invalid_count}")
    
    if not timestamps:
        print("❌ No valid timestamps found!")
        return
    
    # Time range
    min_time = min(timestamps)
    max_time = max(timestamps)
    time_span = (max_time - min_time).total_seconds() / 60  # minutes
    
    print(f"   Earliest: {min_time}")
    print(f"   Latest: {max_time}")
    print(f"   Span: {time_span:.1f} minutes ({time_span/60:.1f} hours)")
    
    if time_span < 25:
        print(f"⚠️  WARNING: Logs span only {time_span:.1f} minutes (need 25+ for 5 buckets)")
        print("   Solution: Generate logs with wider time distribution")
    
    # Bucket analysis
    print("\n🪣 Time Bucket Analysis (5-minute intervals):")
    buckets = defaultdict(lambda: {"count": 0, "errors": 0, "warns": 0})
    
    for i, log in enumerate(recent_logs):
        try:
            ts_str = log.get('timestamp', '')
            if isinstance(ts_str, str):
                ts_str = ts_str.replace('Z', '+00:00')
                timestamp = datetime.fromisoformat(ts_str)
            else:
                continue
            
            # Create bucket key
            bucket = timestamp.replace(
                minute=(timestamp.minute // 5) * 5,
                second=0,
                microsecond=0
            )
            bucket_key = bucket.isoformat()
            
            buckets[bucket_key]["count"] += 1
            if log.get('level') == 'error':
                buckets[bucket_key]["errors"] += 1
            elif log.get('level') == 'warn':
                buckets[bucket_key]["warns"] += 1
        except Exception as e:
            continue
    
    print(f"   Total buckets created: {len(buckets)}")
    
    if len(buckets) < 5:
        print(f"   ❌ PROBLEM: Only {len(buckets)} buckets (need 5+)")
        print("\n💡 Solutions:")
        print("   1. Run: python generate_logs.py  (to add more test data)")
        print("   2. Lower bucket requirement in code: if len(time_buckets) < 3")
        print("   3. Increase analysis window: ?hours=6 in API call")
    else:
        print(f"   ✅ GOOD: {len(buckets)} buckets available")
    
    # Show bucket distribution
    if buckets:
        print(f"\n   Logs per bucket:")
        for i, (bucket_time, data) in enumerate(sorted(buckets.items())[:10]):
            bucket_dt = datetime.fromisoformat(bucket_time)
            print(f"   [{i+1}] {bucket_dt.strftime('%H:%M')}: {data['count']} logs ({data['errors']} errors, {data['warns']} warns)")
        
        if len(buckets) > 10:
            print(f"   ... and {len(buckets) - 10} more buckets")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY:")
    if len(buckets) >= 5 and len(timestamps) >= 50:
        print("✅ Your data looks good for anomaly detection!")
        print("   Try: curl http://localhost:8001/api/ml/detect-anomalies")
    else:
        print("⚠️  Data needs improvement:")
        if len(timestamps) < 50:
            print(f"   - Need {50 - len(timestamps)} more logs")
        if len(buckets) < 5:
            print(f"   - Need logs spread across {5 - len(buckets)} more time buckets")
        print("\n   Run the log generator script to fix this!")
    print("=" * 60)

if __name__ == "__main__":
    diagnose()