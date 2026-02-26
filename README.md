🚦 Traffic Incident Prediction & Intelligent Alert Dashboard

A full-stack AI system for predicting traffic lane-state impact from structured incident attributes and generating human-readable safety explanations using a fine-tuned Large Language Model (LLM).

This project was developed as part of a Master’s thesis in Applied Computer Science and combines classical machine learning with modern LLM-based explanation generation to improve interpretability and usability of traffic prediction systems.

1. Project Objective

Traffic incidents such as collisions, construction, and hazards can significantly disrupt lane availability and commuter flow.

The objective of this system is to:

Predict the expected lane state impact of a traffic event.

Provide probability-based model confidence.

Generate a plain-English explanation and risk level using a fine-tuned LLM.

Present results in an interactive web-based dashboard.

The system bridges structured ML prediction with natural-language explanation to improve decision-making for drivers and operators.

2. System Architecture

The system consists of three main components:

2.1 Machine Learning Layer (Prediction Engine)

Two supervised models were trained on cleaned historical traffic incident data:

Random Forest

CatBoost

Target Variable:

lane_state

OPEN

SOME_LANES_CLOSED

CLOSED

SINGLE_LANE_ALTERNATING

Each prediction returns:

Predicted lane state

Class probability distribution

Model confidence

Model performance:

Random Forest Accuracy ≈ 98.6%

CatBoost Accuracy ≈ 98.5%

5-fold cross-validation performed

Macro-F1 evaluation included

2.2 LLM Explanation Layer

A LoRA fine-tuned adapter based on:

meta-llama/Llama-3.2-3B-Instruct

Deployed as a private Hugging Face Inference Endpoint.

Input:

Structured event_data

ML prediction

Output (strict JSON format):

{
  "explanation_paragraph": "...",
  "risk_level": "LOW | MEDIUM | HIGH"
}

The LLM converts structured predictions into plain English explanations suitable for non-technical users.

Latency is measured and returned for transparency.

2.3 Frontend Dashboard

Built using:

React + TypeScript

Vite

Custom CSS UI

Leaflet (Live Map integration)

The interface allows users to:

Select event type and subtype

Adjust severity

Define lane impact

Set time-of-day features

Specify planned duration

Choose model (CatBoost, RF, or both)

The output panel displays:

Predicted lane state

Probability distribution bars

Model comparison

LLM guidance with risk badge and latency

Feature-based reasoning summary

3. Features Used for Prediction

The models use structured attributes:

event_type

event_subtype

severity

lane_impact_binary

created_hour

is_weekend

is_night

planned_duration_hours

Feature engineering included:

Binary transformation of lane impact

Time-based extraction (hour, weekend, night)

Duration scaling

Leakage prevention

4. Backend API

Framework:

FastAPI

Uvicorn

Endpoints:

GET /health

Returns service status.

POST /predict

Accepts structured traffic attributes and returns:

ML predictions

Probabilities

LLM explanation

Latency metrics

Example request:

{
  "model": "both",
  "event_type": "INCIDENT",
  "event_subtype": "Traffic Collision",
  "severity": "Moderate",
  "lane_impact_binary": 1,
  "created_hour": 17,
  "is_weekend": 0,
  "is_night": 0,
  "planned_duration_hours": 2.5
}
5. Technology Stack

Backend:

Python

FastAPI

scikit-learn

CatBoost

Torch

Transformers

PEFT (LoRA)

LLM Deployment:

Hugging Face Inference Endpoint

AWS (NVIDIA T4 GPU)

Frontend:

React

TypeScript

Leaflet

6. Deployment Setup

Backend:

uvicorn app:app --reload --port 8000

Frontend:

npm install
npm run dev

Environment variables (backend):

HF_TOKEN=your_token
HF_ENDPOINT_URL=https://your-endpoint-url
HF_ENDPOINT_TOKEN=your_endpoint_token
7. Evaluation and Logging

The system logs:

Model accuracy

Probability distributions

LLM JSON validity

Risk-level correctness

Latency metrics (average, p50, p95)

Evaluation logs are stored for thesis documentation and reproducibility.

8. Contribution

This project demonstrates:

Integration of classical ML and LLM systems

Real-time API orchestration

Structured-to-natural-language transformation

Practical deployment of LoRA fine-tuning

End-to-end AI system design (model → API → UI → explanation)

9. Author

Arvind Nataraj
Master’s in Applied Computer Science
SRH University Heidelberg

Thesis Project:
Traffic Incident Prediction & Intelligent Alert Dashboard