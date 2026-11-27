"""AI service configuration."""
import os

ALLOWED_GEMINI_MODELS = {
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
}


def gemini_configured() -> bool:
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    return bool(os.getenv("GEMINI_API_KEY")) and model in ALLOWED_GEMINI_MODELS


def service_token() -> str:
    return os.getenv("AI_SERVICE_TOKEN", "")
