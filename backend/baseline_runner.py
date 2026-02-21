import random
import requests
import time

URL = "http://127.0.0.1:8000/predict"

event_types = ["INCIDENT", "CONSTRUCTION", "ROAD_CONDITION", "SPECIAL_EVENT"]
subtypes = [
    "Traffic Collision", "Stalled Vehicle", "Debris", "Disabled Vehicle",
    "Road Work", "Lane Closure", "Signal Malfunction", "Police Activity"
]
severities = ["Minor", "Moderate", "Major"]

def sample_payload():
    return {
        "model": "catboost",
        "event_type": random.choice(event_types),
        "event_subtype": random.choice(subtypes),
        "severity": random.choice(severities),
        "lane_impact_binary": random.choice([0, 1]),
        "created_hour": random.randint(0, 23),
        "is_weekend": random.choice([0, 1]),
        "is_night": random.choice([0, 1]),
        "planned_duration_hours": round(random.uniform(0.1, 6.0), 1),
    }

def main(n=60, delay=0.3):
    ok = 0
    for i in range(n):
        payload = sample_payload()
        r = requests.post(URL, json=payload, timeout=60)
        if r.status_code == 200:
            ok += 1
        print(f"{i+1}/{n} status={r.status_code}")
        time.sleep(delay)
    print("Done. Successful:", ok)

if __name__ == "__main__":
    main(n=60, delay=0.3)