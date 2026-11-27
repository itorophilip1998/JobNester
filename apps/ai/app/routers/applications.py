from fastapi import APIRouter, Depends

from app.deps import authorize
from app.schemas import ComposeRequest, ComposeResponse
from app.services.email_compose import compose_application

router = APIRouter(prefix="/v1/applications", tags=["applications"])


@router.post("/compose", dependencies=[Depends(authorize)], response_model=ComposeResponse)
async def compose(data: ComposeRequest):
    return await compose_application(data)
