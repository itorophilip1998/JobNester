"""Private AI service. NestJS owns authentication/data; Python owns generation via Gemini."""
from fastapi import FastAPI

from app.routers import applications, health, interviews, portfolio, resumes
from app.schemas import ComposeRequest, GenerateRequest
from app.services.email_compose import deterministic_compose
from app.services.evidence import choose_evidence

app = FastAPI(title="JobNester AI", version="1.0.0", docs_url=None, redoc_url=None)
app.include_router(health.router)
app.include_router(resumes.router)
app.include_router(applications.router)
app.include_router(interviews.router)
app.include_router(portfolio.router)

# Re-exports for unit tests and compatibility.
__all__ = [
    "app",
    "GenerateRequest",
    "ComposeRequest",
    "choose_evidence",
    "deterministic_compose",
]
