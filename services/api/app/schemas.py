from datetime import datetime
from pydantic import BaseModel, Field
from .models import ApplicationStatus, JobStatus, UserRole


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=10, max_length=128)
    name: str = Field(min_length=2, max_length=160)
    phone: str = Field(default="", max_length=30)
    account_type: UserRole = UserRole.client


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    phone: str
    role: UserRole
    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ArtisanOut(BaseModel):
    id: str
    name: str
    trade: str
    area: str
    bio: str
    skills: list[str]
    rating: float
    completed_jobs: int
    verified: bool
    available: bool
    latitude: float | None
    longitude: float | None
    model_config = {"from_attributes": True}


class JobCreate(BaseModel):
    client_name: str = Field(min_length=2, max_length=160)
    client_phone: str = Field(min_length=7, max_length=30)
    trade: str = Field(min_length=2, max_length=100)
    title: str = Field(min_length=4, max_length=180)
    description: str = Field(min_length=10, max_length=4000)
    area: str = Field(min_length=2, max_length=100)
    urgency: str = "this_week"
    budget_min: float = Field(default=0, ge=0)
    budget_max: float = Field(default=0, ge=0)


class JobOut(JobCreate):
    id: str
    reference: str
    status: JobStatus
    assigned_artisan_id: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class MatchOut(BaseModel):
    artisan: ArtisanOut
    score: int
    reasons: list[str]


class ApplicationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    phone: str = Field(min_length=7, max_length=30)
    trade: str = Field(min_length=2, max_length=100)
    area: str = Field(min_length=2, max_length=100)
    years_experience: int = Field(default=0, ge=0, le=70)
    documents: list[str] = Field(default_factory=list)


class ApplicationReview(BaseModel):
    status: ApplicationStatus
    review_note: str = Field(default="", max_length=2000)


class ApplicationOut(ApplicationCreate):
    id: str
    reference: str
    status: ApplicationStatus
    review_note: str
    submitted_at: datetime
    reviewed_at: datetime | None
    model_config = {"from_attributes": True}
