from fastapi import HTTPException

from app.config import gemini_configured
from app.schemas import InterviewRequest
from app.services.gemini import gemini_json


async def prepare_interview(data: InterviewRequest):
    job, profile = data.job, data.profile
    technology = job.technologies[0] if job.technologies else "your main technology stack"
    fallback = {
        "questions": [
            f"Which project best demonstrates your experience for {job.title}?",
            f"Explain a production decision involving {technology}.",
            "Describe a tradeoff between reliability, delivery speed, and cost.",
            "How do you communicate technical decisions to a distributed team?",
        ],
        "coding": (
            f"Build a validated, paginated API with tests using {technology}. "
            "Discuss complexity and failure cases."
        ),
        "systemDesign": (
            f"Design a reliable event-driven ingestion system for {job.title}. "
            "Discuss idempotency, storage, monitoring, and scaling."
        ),
        "answerOutline": "\n\n".join(e.text for e in profile.evidence[:2])
        or "Add and review your experience to prepare evidence-based answers.",
    }
    if not gemini_configured():
        return fallback
    try:
        result = await gemini_json(
            (
                "Prepare interview practice material grounded only in the provided profile evidence. "
                "Return JSON with questions (array of 4 strings), coding, systemDesign, answerOutline. "
                "Do not invent experience."
            ),
            {
                "job": {
                    "title": job.title,
                    "company": job.company,
                    "technologies": job.technologies,
                },
                "evidence": [
                    {"role": e.role, "company": e.company, "text": e.text[:400]}
                    for e in profile.evidence[:6]
                ],
            },
        )
        questions = result.get("questions")
        if not isinstance(questions, list) or len(questions) < 3:
            return fallback
        return {
            "questions": [str(q) for q in questions[:6]],
            "coding": str(result.get("coding") or fallback["coding"]),
            "systemDesign": str(result.get("systemDesign") or fallback["systemDesign"]),
            "answerOutline": str(result.get("answerOutline") or fallback["answerOutline"]),
        }
    except HTTPException:
        return fallback
