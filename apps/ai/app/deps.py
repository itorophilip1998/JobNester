"""FastAPI dependencies."""
import secrets
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import service_token

bearer = HTTPBearer(auto_error=False)


def authorize(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    token = service_token()
    if not token:
        raise HTTPException(503, "AI service authentication is not configured")
    if not credentials or not secrets.compare_digest(credentials.credentials, token):
        raise HTTPException(401, "Invalid AI service credentials")
