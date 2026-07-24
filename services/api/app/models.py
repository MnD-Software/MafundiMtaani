from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4
from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def uid() -> str:
    return str(uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, Enum):
    client = "client"
    artisan = "artisan"
    estate_manager = "estate_manager"
    support = "support"
    admin = "admin"


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(160))
    phone: Mapped[str] = mapped_column(String(30), default="")
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole), default=UserRole.client, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class JobStatus(str, Enum):
    draft = "draft"
    open = "open"
    matched = "matched"
    assigned = "assigned"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class Artisan(Base):
    __tablename__ = "artisans"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    trade: Mapped[str] = mapped_column(String(100), index=True)
    area: Mapped[str] = mapped_column(String(100), index=True)
    phone: Mapped[str] = mapped_column(String(30))
    bio: Mapped[str] = mapped_column(Text, default="")
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    rating: Mapped[float] = mapped_column(Float, default=0)
    completed_jobs: Mapped[int] = mapped_column(Integer, default=0)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    available: Mapped[bool] = mapped_column(Boolean, default=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    reference: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    client_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    client_name: Mapped[str] = mapped_column(String(160))
    client_phone: Mapped[str] = mapped_column(String(30))
    trade: Mapped[str] = mapped_column(String(100), index=True)
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text)
    area: Mapped[str] = mapped_column(String(100), index=True)
    urgency: Mapped[str] = mapped_column(String(30), default="this_week")
    budget_min: Mapped[float] = mapped_column(Float, default=0)
    budget_max: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[JobStatus] = mapped_column(SqlEnum(JobStatus), default=JobStatus.open)
    assigned_artisan_id: Mapped[str | None] = mapped_column(ForeignKey("artisans.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    assigned_artisan: Mapped[Artisan | None] = relationship()


class JobEvent(Base):
    __tablename__ = "job_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(60), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PaymentStatus(str, Enum):
    pending = "pending"
    held = "held"
    completed = "completed"
    refunded = "refunded"
    failed = "failed"


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    client_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    artisan_id: Mapped[str | None] = mapped_column(ForeignKey("artisans.id"), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(40), default="")
    provider_reference: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    amount: Mapped[float] = mapped_column(Float, default=0)
    platform_fee: Mapped[float] = mapped_column(Float, default=0)
    artisan_net: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[PaymentStatus] = mapped_column(SqlEnum(PaymentStatus), default=PaymentStatus.pending, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class QuoteStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    withdrawn = "withdrawn"


class Quote(Base):
    __tablename__ = "quotes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    artisan_id: Mapped[str] = mapped_column(ForeignKey("artisans.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    message: Mapped[str] = mapped_column(Text, default="")
    eta_hours: Mapped[int] = mapped_column(Integer, default=24)
    status: Mapped[QuoteStatus] = mapped_column(SqlEnum(QuoteStatus), default=QuoteStatus.pending, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MilestoneStatus(str, Enum):
    proposed = "proposed"
    funded = "funded"
    submitted = "submitted"
    released = "released"
    disputed = "disputed"


class JobMilestone(Base):
    __tablename__ = "job_milestones"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    amount: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[MilestoneStatus] = mapped_column(SqlEnum(MilestoneStatus), default=MilestoneStatus.proposed, index=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class JobMessage(Base):
    __tablename__ = "job_messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(30), default="text")
    attachment_url: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), unique=True, index=True)
    client_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    artisan_id: Mapped[str] = mapped_column(ForeignKey("artisans.id"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DisputeStatus(str, Enum):
    open = "open"
    investigating = "investigating"
    resolved = "resolved"
    rejected = "rejected"


class Dispute(Base):
    __tablename__ = "disputes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    opened_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    reason: Mapped[str] = mapped_column(String(180))
    details: Mapped[str] = mapped_column(Text)
    evidence: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[DisputeStatus] = mapped_column(SqlEnum(DisputeStatus), default=DisputeStatus.open, index=True)
    resolution: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Favorite(Base):
    __tablename__ = "favorites"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    artisan_id: Mapped[str] = mapped_column(ForeignKey("artisans.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ArtisanAvailability(Base):
    __tablename__ = "artisan_availability"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    artisan_id: Mapped[str] = mapped_column(ForeignKey("artisans.id"), index=True)
    weekday: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[str] = mapped_column(String(5), default="08:00")
    end_time: Mapped[str] = mapped_column(String(5), default="17:00")
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text, default="")
    channel: Mapped[str] = mapped_column(String(20), default="in_app")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApplicationStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ArtisanApplication(Base):
    __tablename__ = "artisan_applications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    reference: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    phone: Mapped[str] = mapped_column(String(30))
    trade: Mapped[str] = mapped_column(String(100), index=True)
    area: Mapped[str] = mapped_column(String(100), index=True)
    years_experience: Mapped[int] = mapped_column(Integer, default=0)
    documents: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[ApplicationStatus] = mapped_column(SqlEnum(ApplicationStatus), default=ApplicationStatus.pending)
    review_note: Mapped[str] = mapped_column(Text, default="")
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
