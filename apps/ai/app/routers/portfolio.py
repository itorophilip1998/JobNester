from fastapi import APIRouter, Depends

from app.deps import authorize
from app.schemas import PortfolioImportRequest
from app.services.portfolio_parse import portfolio_from_cv

router = APIRouter(prefix="/v1/portfolio", tags=["portfolio"])


@router.post("/from-cv", dependencies=[Depends(authorize)])
async def from_cv(data: PortfolioImportRequest):
    return await portfolio_from_cv(data)
