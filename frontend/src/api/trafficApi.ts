// src/api/trafficApi.ts

export type ModelChoice = "both" | "catboost" | "rf";

export type PredictRequest = {
  model?: ModelChoice;

  event_type: string;
  event_subtype: string;
  severity: string;

  lane_impact_binary: number;        // 0 or 1
  created_hour: number;             // 0..23
  is_weekend: number;               // 0 or 1
  is_night: number;                 // 0 or 1
  planned_duration_hours: number;   // float
};

export type SingleModelResult = {
  predicted_lane_state: string;
  probabilities: Record<string, number>;
  features_used?: Record<string, any>;
};

export type PredictResponse = {
  // When model="both", you will get both objects.
  // When model="catboost", only catboost may be present.
  // When model="rf", only rf may be present.
  catboost?: SingleModelResult;
  rf?: SingleModelResult;

  // Optional metadata (safe to ignore if backend doesn't send)
  meta?: {
    model_used?: string;
    timestamp?: string;
  };
};

export type LlmExplanation = {
  explanation_paragraph?: string;
  commuter_summary?: string;
  operator_note?: string;
  suggested_action?: string;
  risk_level?: string; // "low" | "medium" | "high" | "UNKNOWN"
  _latency_ms?: number;
};

export type PredictResponse = {
  features_used: Record<string, any>;
  accuracies: { catboost?: number; rf?: number };

  catboost?: {
    predicted_lane_state?: string;
    probabilities?: Record<string, number>;
  };

  rf?: {
    predicted_lane_state?: string;
    probabilities?: Record<string, number>;
  };

  llm_explanation?: LlmExplanation;
  llm_latency_ms?: number;
};

export type HealthResponse = {
  status: string;
};

// ---- Base URL ----
// Put this in frontend/.env:
// VITE_API_BASE_URL=http://127.0.0.1:8000
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://127.0.0.1:8000";

// ---- Small helper: fetch with timeout ----
async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function handleJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    // Try to extract error message from backend
    let msg = `Request failed (${res.status})`;
    if (isJson) {
      try {
        const body: any = await res.json();
        msg = body?.detail || body?.message || msg;
      } catch {
        // ignore
      }
    } else {
      try {
        const txt = await res.text();
        if (txt) msg = txt;
      } catch {
        // ignore
      }
    }
    throw new Error(msg);
  }

  if (!isJson) {
    throw new Error("Backend did not return JSON.");
  }
  return res.json();
}

export const TrafficApi = {
  baseUrl: API_BASE_URL,

  async health(): Promise<HealthResponse> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/health`, {
      method: "GET",
    });
    return handleJson<HealthResponse>(res);
  },

  async predict(payload: PredictRequest): Promise<PredictResponse> {
    // Basic client-side validation (helps avoid confusing backend errors)
    if (!payload.event_type || !payload.event_subtype || !payload.severity) {
      throw new Error("Please select Event Type, Event Subtype and Severity.");
    }

    const res = await fetchWithTimeout(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return handleJson<PredictResponse>(res);
  },
};
