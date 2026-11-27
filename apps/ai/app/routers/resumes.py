from fastapi import APIRouter, Depends

from app.deps import authorize
from app.schemas import GenerateRequest, ResumeResponse
from app.services.resume_compose import generate_resume

router = APIRouter(prefix="/v1/resumes", tags=["resumes"])


@router.post("/generate", dependencies=[Depends(authorize)], response_model=ResumeResponse)
async def generate(data: GenerateRequest):
    return await generate_resume(data)
