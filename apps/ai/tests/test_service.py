import json
import os
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from app.main import app, GenerateRequest, ComposeRequest, choose_evidence, deterministic_compose


DATA = {
    "profile": {
        "name": "Test Engineer", "headline": "Senior Engineer", "country": "Canada",
        "skills": ["React", "TypeScript"], "confirmed": True,
        "evidence": [
            {"id": "real-1", "company": "Real Company", "role": "Engineer",
             "start": "2020", "end": "Present", "text": "Built TypeScript APIs."},
            {"id": "real-2", "company": "Real Company", "role": "Engineer",
             "start": "2020", "end": "Present", "text": "Designed React interfaces."},
        ],
    },
    "job": {"title": "Senior Engineer", "company": "Acme", "description": "TypeScript APIs", "technologies": ["TypeScript"]},
    "mode": {"name": "Senior Full-Stack Developer", "keywords": ["TypeScript", "APIs"]},
    "useAi": False,
}


class ServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.env = patch.dict(os.environ, {"AI_SERVICE_TOKEN": "test-service-token", "GEMINI_API_KEY": ""})
        self.env.start()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.headers = {"Authorization": "Bearer test-service-token"}

    async def asyncTearDown(self):
        await self.client.aclose()
        self.env.stop()

    async def test_private_generation_requires_service_token(self):
        response = await self.client.post("/v1/resumes/generate", json=DATA)
        self.assertEqual(response.status_code, 401)

    async def test_unconfigured_service_fails_closed(self):
        with patch.dict(os.environ, {"AI_SERVICE_TOKEN": ""}):
            response = await self.client.get("/health")
            self.assertEqual(response.status_code, 503)
            response = await self.client.post("/v1/resumes/generate", headers=self.headers, json=DATA)
            self.assertEqual(response.status_code, 503)

    async def test_cv_contains_only_reviewed_professional_claims(self):
        response = await self.client.post("/v1/resumes/generate", headers=self.headers, json=DATA)
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["method"], "rule-ranked")
        self.assertEqual(result["evidenceIds"], ["real-1", "real-2"])
        for evidence in DATA["profile"]["evidence"]:
            self.assertIn(evidence["text"], result["content"])
        self.assertNotIn("increased revenue", result["content"])
        self.assertIn("Built TypeScript APIs.", result["coverLetter"])

    async def test_unreviewed_experience_is_rejected(self):
        data = {**DATA, "profile": {**DATA["profile"], "confirmed": False}}
        response = await self.client.post("/v1/resumes/generate", headers=self.headers, json=data)
        self.assertEqual(response.status_code, 422)

    async def test_budget_disabled_ai_never_calls_provider(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-only"}):
            ids = await choose_evidence(GenerateRequest.model_validate(DATA))
            self.assertIsNone(ids)

    async def test_provider_cannot_invent_evidence(self):
        request = GenerateRequest.model_validate({**DATA, "useAi": True})
        transport = httpx.MockTransport(lambda request: httpx.Response(200, json={
            "candidates": [{"content": {"parts": [{"text": json.dumps({"evidenceIds": ["invented"]})}]}}]
        }))
        real_client = httpx.AsyncClient
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-only", "GEMINI_MODEL": "gemini-2.0-flash"}):
            with patch("app.main.httpx.AsyncClient", side_effect=lambda **kwargs: real_client(transport=transport, **kwargs)):
                with self.assertRaises(HTTPException) as caught:
                    await choose_evidence(request)
                self.assertEqual(caught.exception.status_code, 502)

    async def test_compose_deterministic_includes_job_and_name(self):
        draft = deterministic_compose(ComposeRequest.model_validate({**DATA, "coverLetter": "Custom letter"}))
        self.assertIn("Senior Engineer", draft.subject)
        self.assertIn("Test Engineer", draft.body)
        self.assertEqual(draft.coverLetter, "Custom letter")
        self.assertEqual(draft.method, "rule-ranked")

    async def test_compose_endpoint_without_ai(self):
        response = await self.client.post(
            "/v1/applications/compose",
            headers=self.headers,
            json={**DATA, "coverLetter": "Attached cover letter"},
        )
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["method"], "rule-ranked")
        self.assertIn("Acme", result["body"])

    async def test_health_reports_gemini_provider(self):
        response = await self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["provider"], "gemini")
        self.assertFalse(body["llmConfigured"])
