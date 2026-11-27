import re

from fastapi import HTTPException

from app.config import gemini_configured
from app.schemas import PortfolioImportRequest
from app.services.gemini import gemini_json


def portfolio_from_text(text: str):
    """Extract common CV sections without inventing missing career facts."""
    lines = [line.strip().lstrip("•·").strip() for line in text.splitlines() if line.strip()]
    headings = {
        "skills": "skills",
        "technical skills": "skills",
        "technologies": "skills",
        "experience": "experience",
        "work experience": "experience",
        "professional experience": "experience",
        "employment history": "experience",
        "certifications": "certifications",
        "certificates": "certifications",
        "projects": "projects",
        "selected projects": "projects",
        "summary": "summary",
        "professional summary": "summary",
        "profile": "summary",
        "education": "education",
        "contact": "contact",
        "interests": "interests",
    }
    sections: dict[str, list[str]] = {}
    current = "header"
    for line in lines:
        heading = headings.get(line.lower().rstrip(":"))
        if heading:
            current = heading
        else:
            sections.setdefault(current, []).append(line)
    header = sections.get("header", [])
    candidates = [
        line
        for line in header
        if not re.search(r"@|https?://|\d{3,}|curriculum vitae|^resume$|^cv$", line, re.I)
    ]
    name = candidates[0][:200] if candidates else ""
    headline = candidates[1][:200] if len(candidates) > 1 else ""
    emails = re.findall(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", text)
    urls = re.findall(r"https?://[^\s<>]+", text)
    github = next((url.rstrip(".,)") for url in urls if "github.com/" in url), "")
    skills = list(
        dict.fromkeys(
            part.strip()
            for line in sections.get("skills", [])
            for part in re.split(r"[,|;•·]", line)
            if part.strip()
        )
    )[:100]
    certifications = []
    for i, line in enumerate(sections.get("certifications", [])[:50]):
        parts = re.split(r"\s[|–—]\s", line, maxsplit=1)
        certifications.append(
            {
                "id": f"cv-cert-{i}",
                "name": parts[0][:200],
                "issuer": parts[1][:200] if len(parts) > 1 else "",
                "issuedAt": "",
                "credentialUrl": "",
                "image": "",
                "description": "",
            }
        )
    experiences = []
    for line in sections.get("experience", []):
        parts = re.split(r"\s[|–—]\s", line)
        if len(parts) >= 2 and re.search(
            r"engineer|developer|architect|manager|designer|analyst|consultant|lead",
            parts[0],
            re.I,
        ):
            experiences.append(
                {
                    "id": f"cv-experience-{len(experiences)}",
                    "role": parts[0][:200],
                    "company": parts[1][:200],
                    "start": "",
                    "end": "",
                    "text": "",
                }
            )
        elif experiences and (
            dates := re.match(r"^(\d{4})\s*[–—-]\s*(Present|Current|\d{4})$", line, re.I)
        ):
            experiences[-1]["start"], experiences[-1]["end"] = dates.group(1), dates.group(2)
        elif experiences:
            experiences[-1]["text"] += ("\n" if experiences[-1]["text"] else "") + line
    projects = []
    for line in sections.get("projects", []):
        if " | " in line:
            parts = line.split(" | ", 1)
            url = next(iter(re.findall(r"https?://[^\s]+", parts[1])), "")
            projects.append(
                {
                    "id": f"cv-project-{len(projects)}",
                    "title": parts[0][:200],
                    "description": "",
                    "url": "" if "github.com" in url else url,
                    "repositoryUrl": url if "github.com" in url else "",
                    "image": "",
                    "tags": [],
                }
            )
        elif projects:
            projects[-1]["description"] += ("\n" if projects[-1]["description"] else "") + line
    return {
        "name": name,
        "headline": headline,
        "email": emails[0] if emails else "",
        "github": github,
        "bio": " ".join(sections.get("summary", []))[:10000],
        "skills": skills,
        "experience": experiences,
        "certifications": certifications,
        "projects": projects,
        "reviewRequired": True,
        "extractedText": text,
        "method": "rule-parsed",
    }


async def portfolio_from_cv(data: PortfolioImportRequest):
    base = portfolio_from_text(data.text)
    if not data.useAi or not gemini_configured():
        return base
    try:
        result = await gemini_json(
            (
                "Structure a portfolio draft from CV text. Return JSON with keys name, headline, "
                "email, github, bio, skills (string array), experience (array of "
                "{role,company,start,end,text}), projects (array of {title,description,url,repositoryUrl,tags}), "
                "certifications (array of {name,issuer,issuedAt,credentialUrl,description}). "
                "Never invent employers, dates, or achievements that are not present in the text."
            ),
            {"cvText": data.text[:40000]},
        )
        for key in ("name", "headline", "email", "github", "bio"):
            if isinstance(result.get(key), str) and result[key].strip():
                base[key] = result[key].strip()[:10000 if key == "bio" else 200]
        if isinstance(result.get("skills"), list):
            base["skills"] = [str(s)[:100] for s in result["skills"] if str(s).strip()][:100]
        if isinstance(result.get("experience"), list):
            experiences = []
            for i, item in enumerate(result["experience"][:40]):
                if not isinstance(item, dict):
                    continue
                experiences.append(
                    {
                        "id": f"cv-experience-{i}",
                        "role": str(item.get("role") or "")[:200],
                        "company": str(item.get("company") or "")[:200],
                        "start": str(item.get("start") or "")[:50],
                        "end": str(item.get("end") or "")[:50],
                        "text": str(item.get("text") or "")[:5000],
                    }
                )
            if experiences:
                base["experience"] = experiences
        if isinstance(result.get("projects"), list):
            projects = []
            for i, item in enumerate(result["projects"][:40]):
                if not isinstance(item, dict):
                    continue
                projects.append(
                    {
                        "id": f"cv-project-{i}",
                        "title": str(item.get("title") or "")[:200],
                        "description": str(item.get("description") or "")[:5000],
                        "url": str(item.get("url") or "")[:500],
                        "repositoryUrl": str(item.get("repositoryUrl") or "")[:500],
                        "image": "",
                        "tags": [
                            str(t)[:40] for t in (item.get("tags") or []) if str(t).strip()
                        ][:12],
                    }
                )
            if projects:
                base["projects"] = projects
        base["method"] = "ai-structured"
        base["reviewRequired"] = True
        return base
    except HTTPException:
        return base
