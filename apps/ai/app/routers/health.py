import os

from fastapi import APIRouter, HTTPException

from app.config import gemini_configured

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    if not os.getenv("AI_SERVICE_TOKEN"):
        raise HTTPException(503, "AI_SERVICE_TOKEN is required")
    return {
        "status": "ok",
        "service": "jobnester-ai",
        "llmConfigured": gemini_configured(),
        "provider": "gemini",
    }
