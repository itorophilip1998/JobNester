import json
import os
from typing import Any

import httpx
from fastapi import HTTPException

from app.config import gemini_configured


async def gemini_json(system: str, user: dict[str, Any]) -> dict[str, Any]:
    if not gemini_configured():
        raise HTTPException(503, "Gemini is not configured")
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={os.environ['GEMINI_API_KEY']}"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps(user)}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
            "maxOutputTokens": 4096,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=55) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            raise ValueError("Expected JSON object")
        return parsed
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as error:
        raise HTTPException(502, "Gemini failed or returned invalid JSON") from error
