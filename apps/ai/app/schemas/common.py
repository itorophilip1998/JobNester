from pydantic import BaseModel, Field


class Evidence(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=10000)
    company: str = Field(max_length=200)
    role: str = Field(max_length=200)
    start: str = Field(max_length=200)
    end: str = Field(max_length=200)


class Profile(BaseModel):
    name: str = Field(max_length=200)
    headline: str = Field(max_length=200)
    country: str = Field(max_length=100)
    skills: list[str] = Field(max_length=100)
    evidence: list[Evidence] = Field(max_length=100)
    confirmed: bool
    contactEmail: str | None = None
    phone: str | None = None
    portfolioUrl: str | None = None


class Job(BaseModel):
    title: str = Field(max_length=200)
    company: str = Field(max_length=200)
    description: str = Field(max_length=50000)
    technologies: list[str] = Field(default_factory=list, max_length=100)


class Mode(BaseModel):
    name: str = Field(max_length=200)
    keywords: list[str] = Field(max_length=50)


class GenerateRequest(BaseModel):
    profile: Profile
    job: Job
    mode: Mode
    useAi: bool = False


class InterviewRequest(BaseModel):
    profile: Profile
    job: Job


class ComposeRequest(BaseModel):
    profile: Profile
    job: Job
    mode: Mode
    coverLetter: str = Field(default="", max_length=50000)
    useAi: bool = False


class ResumeResponse(BaseModel):
    content: str
    coverLetter: str
    evidenceIds: list[str]
    method: str


class ComposeResponse(BaseModel):
    subject: str
    body: str
    coverLetter: str
    method: str


class PortfolioImportRequest(BaseModel):
    text: str = Field(min_length=20, max_length=100000)
    useAi: bool = False
