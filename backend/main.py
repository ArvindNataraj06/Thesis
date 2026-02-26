from fastapi import FastAPI, HTTPException
from traffic_model.llm_client import llama_explain

app = FastAPI()

@app.post("/llm/explain")
def llm_explain(payload: dict):
    try:
        event = payload.get("event", {})
        model_pred = payload.get("model_pred")  # optional
        text = llama_explain(event, model_pred)
        return {"llm_output": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))