from fastapi import HTTPException

from app.schemas import GenerateRequest, ResumeResponse
from app.services.evidence import choose_evidence
from app.services.text import includes


async def generate_resume(data: GenerateRequest) -> ResumeResponse:
    profile, job, mode = data.profile, data.job, data.mode
    if not profile.confirmed or not profile.evidence:
        raise HTTPException(
            422,
            "Review and confirm your professional evidence before generating a CV",
        )
    ids = await choose_evidence(data)
    if ids is None:
        evidence = sorted(
            profile.evidence,
            key=lambda e: -sum(includes(e.text, k) for k in mode.keywords),
        )
    else:
        by_id = {e.id: e for e in profile.evidence}
        evidence = [by_id[i] for i in ids]
    skills = sorted(profile.skills, key=lambda s: -int(includes(job.description, s)))
    contact = " | ".join(
        filter(None, [profile.contactEmail, profile.phone, profile.country, profile.portfolioUrl])
    )
    lines = [
        profile.name,
        profile.headline,
        contact,
        "",
        "SKILLS",
        " • ".join(skills),
        "",
        "EXPERIENCE",
    ]
    for e in evidence:
        lines.extend([f"{e.role} | {e.company}", f"{e.start} – {e.end}", e.text, ""])
    letter = (
        f"Dear Hiring Team,\n\nI am applying for {job.title} at {job.company}. "
        f"My background includes {', '.join(skills[:5])}.\n\n"
        + "\n\n".join(e.text for e in evidence[:3])
        + "\n\nI would welcome a conversation about how this experience could support your team."
        + f"\n\nBest regards,\n{profile.name}"
    )
    return ResumeResponse(
        content="\n".join(lines),
        coverLetter=letter,
        evidenceIds=[e.id for e in evidence],
        method="ai-selected" if ids else "rule-ranked",
    )
