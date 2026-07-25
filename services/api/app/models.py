from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4
from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, JSON, LargeBinary, String, Text
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
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole), default=UserRole.client, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StoredFile(Base):
    __tablename__ = "stored_files"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    filename: Mapped[str] = mapped_column(String(240))
    content_type: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(40), index=True)
    size_bytes: Mapped[int] = mapped_column(Integer)
    content: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    user_agent: Mapped[str] = mapped_column(String(300), default="")
    ip_address: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PasskeyCredential(Base):
    __tablename__ = "passkey_credentials"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    credential_id: Mapped[str] = mapped_column(String(1024), unique=True, index=True)
    public_key: Mapped[bytes] = mapped_column(LargeBinary)
    sign_count: Mapped[int] = mapped_column(Integer, default=0)
    label: Mapped[str] = mapped_column(String(100), default="Passkey")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PasskeyChallenge(Base):
    __tablename__ = "passkey_challenges"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    challenge: Mapped[bytes] = mapped_column(LargeBinary)
    purpose: Mapped[str] = mapped_column(String(20), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


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


class JobTrackingPing(Base):
    __tablename__ = "job_tracking_pings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    artisan_id: Mapped[str] = mapped_column(ForeignKey("artisans.id"), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    accuracy_m: Mapped[float] = mapped_column(Float, default=0)
    eta_minutes: Mapped[int] = mapped_column(Integer, default=0)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class JobEvidence(Base):
    __tablename__ = "job_evidence"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    stage: Mapped[str] = mapped_column(String(20), index=True)
    file_url: Mapped[str] = mapped_column(String(500))
    caption: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CompletionApproval(Base):
    __tablename__ = "completion_approvals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), unique=True, index=True)
    client_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str] = mapped_column(Text, default="")
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WarrantyClaim(Base):
    __tablename__ = "warranty_claims"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    client_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    reason: Mapped[str] = mapped_column(String(240))
    details: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Property(Base):
    __tablename__ = "properties"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    area: Mapped[str] = mapped_column(String(100), index=True)
    address: Mapped[str] = mapped_column(String(300), default="")
    property_type: Mapped[str] = mapped_column(String(40), default="home")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MaintenanceSchedule(Base):
    __tablename__ = "maintenance_schedules"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    property_id: Mapped[str] = mapped_column(ForeignKey("properties.id"), index=True)
    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    trade: Mapped[str] = mapped_column(String(100), index=True)
    frequency_days: Mapped[int] = mapped_column(Integer, default=30)
    next_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    reference: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    opened_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    subject: Mapped[str] = mapped_column(String(180))
    details: Mapped[str] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(20), default="normal", index=True)
    status: Mapped[str] = mapped_column(String(24), default="open", index=True)
    sla_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ArtisanEarning(Base):
    __tablename__ = "artisan_earnings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    artisan_id: Mapped[str] = mapped_column(ForeignKey("artisans.id"), index=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    client_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    earning_type: Mapped[str] = mapped_column(String(20), default="tip")
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    provider_reference: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BusinessOrganization(Base):
    __tablename__ = "business_organizations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    monthly_budget: Mapped[float] = mapped_column(Float, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("business_organizations.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(30), default="requester")
    spending_limit: Mapped[float] = mapped_column(Float, default=0)


class IntegrationOutbox(Base):
    __tablename__ = "integration_outbox"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    destination: Mapped[str] = mapped_column(String(40), default="erpnext", index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    resource_id: Mapped[str] = mapped_column(String(36), default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TrustedContact(Base):
    __tablename__ = "trusted_contacts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    phone: Mapped[str] = mapped_column(String(30))
    relationship: Mapped[str] = mapped_column(String(80), default="")


class SOSAlert(Base):
    __tablename__ = "sos_alerts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ConsentRecord(Base):
    __tablename__ = "consent_records"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(80), index=True)
    granted: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


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


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    artisan_id: Mapped[str] = mapped_column(ForeignKey("artisans.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    file_url: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SavedSearch(Base):
    __tablename__ = "saved_searches"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    query: Mapped[str] = mapped_column(String(160), default="")
    trade: Mapped[str] = mapped_column(String(100), default="")
    area: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    in_app: Mapped[bool] = mapped_column(Boolean, default=True)
    email: Mapped[bool] = mapped_column(Boolean, default=True)
    sms: Mapped[bool] = mapped_column(Boolean, default=False)
    push: Mapped[bool] = mapped_column(Boolean, default=False)
    job_updates: Mapped[bool] = mapped_column(Boolean, default=True)
    offers: Mapped[bool] = mapped_column(Boolean, default=False)


class Promotion(Base):
    __tablename__ = "promotions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(180), default="")
    discount_percent: Mapped[float] = mapped_column(Float, default=0)
    max_discount: Mapped[float] = mapped_column(Float, default=0)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    usage_limit: Mapped[int] = mapped_column(Integer, default=0)
    uses: Mapped[int] = mapped_column(Integer, default=0)


class Referral(Base):
    __tablename__ = "referrals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    referrer_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    referred_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    reward_amount: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    plan: Mapped[str] = mapped_column(String(40), default="free")
    status: Mapped[str] = mapped_column(String(24), default="active", index=True)
    monthly_amount: Mapped[float] = mapped_column(Float, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    renews_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provider_reference: Mapped[str | None] = mapped_column(String(120), nullable=True, unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(30), default="")


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    transaction_id: Mapped[str] = mapped_column(ForeignKey("payment_transactions.id"), unique=True, index=True)
    client_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    platform_fee: Mapped[float] = mapped_column(Float, default=0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="KES")
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DeviceToken(Base):
    __tablename__ = "device_tokens"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(500), unique=True)
    platform: Mapped[str] = mapped_column(String(30), default="web")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RiskSignal(Base):
    __tablename__ = "risk_signals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    job_id: Mapped[str | None] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    signal_type: Mapped[str] = mapped_column(String(80), index=True)
    severity: Mapped[str] = mapped_column(String(20), default="medium", index=True)
    score: Mapped[int] = mapped_column(Integer, default=0)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(24), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DocumentVerification(Base):
    __tablename__ = "document_verifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    application_id: Mapped[str] = mapped_column(ForeignKey("artisan_applications.id"), index=True)
    document_type: Mapped[str] = mapped_column(String(80), index=True)
    file_reference: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    provider: Mapped[str] = mapped_column(String(40), default="manual")
    confidence: Mapped[float] = mapped_column(Float, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    method_type: Mapped[str] = mapped_column(String(30), index=True)
    provider: Mapped[str] = mapped_column(String(40))
    provider_token: Mapped[str] = mapped_column(String(500), default="")
    label: Mapped[str] = mapped_column(String(80))
    last_four: Mapped[str] = mapped_column(String(4), default="")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Campaign(Base):
    __tablename__ = "campaigns"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    headline: Mapped[str] = mapped_column(String(180))
    message: Mapped[str] = mapped_column(Text)
    theme: Mapped[str] = mapped_column(String(30), default="celebration")
    offer_code: Mapped[str] = mapped_column(String(40), default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    resource_type: Mapped[str] = mapped_column(String(80), index=True)
    resource_id: Mapped[str] = mapped_column(String(80), default="")
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ArtisanInquiry(Base):
    __tablename__ = "artisan_inquiries"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    client_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    artisan_id: Mapped[str] = mapped_column(ForeignKey("artisans.id"), index=True)
    message: Mapped[str] = mapped_column(Text)
    phone: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(24), default="sent", index=True)
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
