from fastapi import APIRouter, Depends

from app.deps import authorize
from app.schemas import InterviewRequest
from app.services.interview import prepare_interview

router = APIRouter(prefix="/v1/interviews", tags=["interviews"])


@router.post("/prepare", dependencies=[Depends(authorize)])
async def interview(data: InterviewRequest):
    return await prepare_interview(data)
