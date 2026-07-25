from contextlib import asynccontextmanager
import base64
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import httpx
import logging
import smtplib
import time
from uuid import uuid4
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .auth import create_access_token, get_current_user, hash_password, require_roles, verify_password
from .matching import score_match
from .models import ApplicationStatus, Artisan, ArtisanApplication, ArtisanAvailability, ArtisanInquiry, AuditLog, Campaign, DeviceToken, Dispute, DisputeStatus, DocumentVerification, Favorite, Invoice, Job, JobEvent, JobMessage, JobMilestone, JobStatus, MilestoneStatus, Notification, PaymentMethod, PaymentStatus, PaymentTransaction, Promotion, Quote, QuoteStatus, Referral, Review, RiskSignal, Subscription, User, UserRole
from .schemas import ApplicationCreate, ApplicationOut, ApplicationReview, ArtisanOut, JobCreate, JobOut, LoginRequest, MatchOut, RegisterRequest, TokenOut, UserOut

NAIROBI_AREAS = {
    "Airbase", "Akiba", "Athi River", "Ayany", "Baba Dogo", "Bahati", "Balozi", "Baraka",
    "Bellevue", "Buruburu Phase 1", "Buruburu Phase 2", "Buruburu Phase 3", "Buruburu Phase 4",
    "Buruburu Phase 5", "California", "CBD", "City Cabanas", "City Park", "Clay City",
    "Dagoretti Corner", "Dandora Phase 1", "Dandora Phase 2", "Dandora Phase 3", "Dandora Phase 4",
    "Dandora Phase 5", "Donholm", "Eastleigh Section 1", "Eastleigh Section 2", "Eastleigh Section 3",
    "Embakasi", "Embakasi Village", "Fedha", "Garden Estate", "Gigiri", "Githurai 44",
    "Githurai 45", "Golf Course", "Greenspan", "Highridge", "Huruma", "Imara Daima",
    "Industrial Area", "Jacaranda", "Jamhuri", "Jericho", "Kabete", "Kabiria", "Kahawa",
    "Kahawa Sukari", "Kahawa Wendani", "Kahawa West", "Kamulu", "Kangemi", "Karen",
    "Kariobangi North", "Kariobangi South", "Kasarani", "Kawangware", "Kayole", "Kiamaiko",
    "Kiamumbi", "Kiambu Road", "Kibera", "Kileleshwa", "Kilimani", "Kinoo", "Kitengela",
    "Kitisuru", "Komarock", "Korogocho", "Kyuna", "Laini Saba", "Lang'ata", "Lavington",
    "Loresho", "Lucky Summer", "Makadara", "Makina", "Makongeni", "Maringo", "Mathare",
    "Mbagathi", "Mihango", "Mirema", "Mlango Kubwa", "Mlolongo", "Mountain View", "Mowlem",
    "Mugoya", "Mukuru Kwa Njenga", "Mukuru Kwa Reuben", "Muthaiga", "Mwiki", "Nairobi West",
    "New Kitisuru", "Ngara", "Ngong", "Ngong Road", "Njiru", "Nyayo Estate", "Olympic",
    "Pangani", "Parklands", "Pipeline", "Pumwani", "Ridgeways", "Riruta", "Riverside",
    "Rongai", "Rosslyn", "Roysambu", "Ruaka", "Ruaraka", "Ruai", "Saika", "Savannah",
    "South B", "South C", "Spring Valley", "Sunton", "Syokimau", "Tassia", "Thindigua",
    "Thome", "Umoja", "Umoja 1", "Umoja 2", "Umoja 3", "Upper Hill", "Utawala", "Valley Arcade",
    "Waithaka", "Westlands", "Woodley", "Zimmerman", "Ziwani"
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, version="2.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
logger=logging.getLogger("mafundi.api")


@app.middleware("http")
async def request_observability(request:Request,call_next):
    request_id=request.headers.get("x-request-id") or str(uuid4());started=time.perf_counter()
    try: response=await call_next(request)
    except Exception:
        logger.exception("request_failed",extra={"request_id":request_id,"path":request.url.path});raise
    response.headers["X-Request-ID"]=request_id
    response.headers["Server-Timing"]=f"app;dur={(time.perf_counter()-started)*1000:.1f}"
    logger.info("request_complete",extra={"request_id":request_id,"method":request.method,"path":request.url.path,"status":response.status_code})
    return response


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "marketplace-api", "version": "2.1.0"}


@app.get("/health/ready")
def readiness(db:Session=Depends(get_db)) -> dict:
    db.execute(select(1))
    return {"status":"ready","database":"connected"}


@app.post("/v1/auth/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if data.account_type not in {UserRole.client, UserRole.artisan, UserRole.estate_manager}:
        raise HTTPException(422, "This account type cannot self-register")
    referral = db.scalar(select(Referral).where(func.upper(Referral.code) == data.referral_code.upper(), Referral.referred_user_id.is_(None))) if data.referral_code else None
    if data.referral_code and not referral:
        raise HTTPException(422, "Referral code is invalid")
    user = User(email=data.email.lower().strip(), password_hash=hash_password(data.password), name=data.name, phone=data.phone, role=data.account_type)
    db.add(user)
    try:
        db.flush()
        if referral:
            db.add(Referral(referrer_user_id=referral.referrer_user_id, referred_user_id=user.id, code=f"{referral.code[:15]}-{user.id[:6]}", reward_amount=250, status="qualified"))
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists") from exc
    db.refresh(user)
    return {"access_token": create_access_token(user), "user": user}


@app.post("/v1/auth/login", response_model=TokenOut)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower().strip()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": create_access_token(user), "user": user}


@app.get("/v1/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@app.get("/v1/estates")
def list_estates() -> dict:
    return {"county": "Nairobi", "areas": sorted(NAIROBI_AREAS), "total": len(NAIROBI_AREAS)}


@app.get("/v1/artisans", response_model=list[ArtisanOut])
def list_artisans(q: str | None = None, trade: str | None = None, area: str | None = None, available: bool | None = None, db: Session = Depends(get_db)):
    query = select(Artisan).where(Artisan.verified.is_(True))
    if q:
        term = f"%{q.strip()}%"
        query = query.where(or_(Artisan.name.ilike(term), Artisan.trade.ilike(term), Artisan.area.ilike(term), Artisan.bio.ilike(term)))
    if trade:
        query = query.where(Artisan.trade.ilike(f"%{trade}%"))
    if area:
        query = query.where(Artisan.area == area)
    if available is not None:
        query = query.where(Artisan.available.is_(available))
    return db.scalars(query.order_by(Artisan.available.desc(), Artisan.rating.desc(), Artisan.completed_jobs.desc()).limit(50)).all()


@app.get("/v1/artisans/{artisan_id}", response_model=ArtisanOut)
def get_artisan(artisan_id: str, db: Session = Depends(get_db)):
    artisan = db.get(Artisan, artisan_id)
    if not artisan or not artisan.verified:
        raise HTTPException(404, "Artisan not found")
    return artisan


@app.post("/v1/jobs", response_model=JobOut, status_code=status.HTTP_201_CREATED)
def create_job(data: JobCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.client, UserRole.estate_manager))):
    if data.area not in NAIROBI_AREAS:
        raise HTTPException(422, "Mafundi currently serves supported Nairobi neighbourhoods only.")
    if data.budget_max and data.budget_min > data.budget_max:
        raise HTTPException(422, "Maximum budget must be greater than minimum budget.")
    reference = f"MM-{1000 + (db.scalar(select(func.count(Job.id))) or 0) + 1}"
    job = Job(reference=reference, client_user_id=user.id, **data.model_dump())
    db.add(job)
    db.flush()
    db.add(JobEvent(job_id=job.id, event_type="job.created", actor_id=user.id, payload={"reference": reference}))
    recent_jobs = db.scalar(select(func.count(Job.id)).where(Job.client_user_id == user.id, Job.created_at >= datetime.now(timezone.utc) - timedelta(minutes=10))) or 0
    if data.budget_max >= 1_000_000 or recent_jobs >= 5:
        db.add(RiskSignal(user_id=user.id, job_id=job.id, signal_type="unusual_job_velocity" if recent_jobs >= 5 else "high_value_job", severity="high", score=85, details={"recent_jobs":recent_jobs,"budget_max":data.budget_max}))
    db.commit()
    db.refresh(job)
    return job


@app.get("/v1/jobs", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Job)
    if user.role in {UserRole.client, UserRole.estate_manager}:
        query = query.where(Job.client_user_id == user.id)
    elif user.role == UserRole.artisan:
        query = query.where(Job.status.in_(["open", "matched", "assigned", "in_progress"]))
    elif user.role not in {UserRole.admin, UserRole.support}:
        raise HTTPException(403, "You do not have access to jobs")
    return db.scalars(query.order_by(Job.created_at.desc())).all()


@app.get("/v1/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if user.role in {UserRole.client, UserRole.estate_manager} and job.client_user_id != user.id:
        raise HTTPException(403, "You do not have access to this job")
    return job


@app.get("/v1/jobs/{job_id}/matches", response_model=list[MatchOut])
def get_matches(job_id: str, limit: int = Query(5, ge=1, le=20), db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.client, UserRole.estate_manager, UserRole.admin, UserRole.support))):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if user.role in {UserRole.client, UserRole.estate_manager} and job.client_user_id != user.id:
        raise HTTPException(403, "You do not have access to this job")
    ranked = [(artisan, *score_match(job, artisan)) for artisan in db.scalars(select(Artisan).where(Artisan.verified.is_(True))).all()]
    ranked.sort(key=lambda item: item[1], reverse=True)
    return [{"artisan": artisan, "score": score, "reasons": reasons} for artisan, score, reasons in ranked[:limit] if score >= 40]


@app.post("/v1/applications", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(data: ApplicationCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.artisan))):
    if data.area not in NAIROBI_AREAS:
        raise HTTPException(422, "Select a supported Nairobi service area.")
    reference = f"AP-{1050 + (db.scalar(select(func.count(ArtisanApplication.id))) or 0)}"
    application = ArtisanApplication(reference=reference, user_id=user.id, **data.model_dump())
    db.add(application)
    db.flush()
    for document in data.documents:
        db.add(DocumentVerification(application_id=application.id, document_type=document, file_reference=document, status="pending", provider="manual"))
    db.commit()
    db.refresh(application)
    return application


@app.get("/v1/admin/applications", response_model=list[ApplicationOut])
def list_applications(application_status: ApplicationStatus | None = None, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.support))):
    query = select(ArtisanApplication)
    if application_status:
        query = query.where(ArtisanApplication.status == application_status)
    return db.scalars(query.order_by(ArtisanApplication.submitted_at.desc())).all()


@app.patch("/v1/admin/applications/{application_id}", response_model=ApplicationOut)
def review_application(application_id: str, review: ApplicationReview, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin))):
    application = db.get(ArtisanApplication, application_id)
    if not application:
        application = db.scalar(select(ArtisanApplication).where(ArtisanApplication.reference == application_id))
    if not application:
        raise HTTPException(404, "Application not found")
    application.status = review.status
    application.review_note = review.review_note
    application.reviewed_at = datetime.now(timezone.utc)
    if review.status == ApplicationStatus.approved:
        user = db.get(User, application.user_id)
        if user:
            user.role = UserRole.artisan
        db.add(Artisan(user_id=application.user_id, name=application.name, trade=application.trade, area=application.area, phone=application.phone, skills=[], verified=True, available=False))
    db.commit()
    db.refresh(application)
    return application


class QuoteCreate(BaseModel):
    job_id: str
    amount: float = Field(gt=0)
    message: str = Field(min_length=3, max_length=2000)
    eta_hours: int = Field(default=24, ge=1, le=720)


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    kind: str = Field(default="text", pattern="^(text|photo|voice|document)$")
    attachment_url: str = Field(default="", max_length=500)


class MilestoneCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    amount: float = Field(ge=0)


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


class DisputeCreate(BaseModel):
    reason: str = Field(min_length=3, max_length=180)
    details: str = Field(min_length=10, max_length=4000)
    evidence: list[str] = Field(default_factory=list, max_length=10)


class DisputeReview(BaseModel):
    status: DisputeStatus
    resolution: str = Field(default="", max_length=4000)


class AvailabilityCreate(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    active: bool = True


class ArtisanProfileUpdate(BaseModel):
    bio: str = Field(default="", max_length=4000)
    skills: list[str] = Field(default_factory=list, max_length=30)
    area: str = Field(min_length=2, max_length=100)
    available: bool = False


class CheckoutCreate(BaseModel):
    job_id: str
    phone: str = Field(min_length=10, max_length=15)
    amount: float = Field(gt=0)
    promotion_code: str = Field(default="",max_length=40)


def user_artisan(db: Session, user: User) -> Artisan | None:
    return db.scalar(select(Artisan).where(Artisan.user_id == user.id))


@app.get("/v1/artisans/me")
def get_my_artisan_profile(db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.artisan))) -> dict:
    artisan=user_artisan(db,user)
    if not artisan: raise HTTPException(404,"Approved artisan profile not found")
    return {"id":artisan.id,"name":artisan.name,"trade":artisan.trade,"area":artisan.area,"bio":artisan.bio,"skills":artisan.skills,"available":artisan.available,"rating":artisan.rating,"completed_jobs":artisan.completed_jobs}


@app.patch("/v1/artisans/me")
def update_my_artisan_profile(data: ArtisanProfileUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.artisan))) -> dict:
    artisan=user_artisan(db,user)
    if not artisan: raise HTTPException(404,"Approved artisan profile not found")
    if data.area not in NAIROBI_AREAS: raise HTTPException(422,"Select a supported service area")
    artisan.bio=data.bio;artisan.skills=[skill.strip() for skill in data.skills if skill.strip()][:30];artisan.area=data.area;artisan.available=data.available
    audit(db,user.id,"artisan.profile_updated","artisan",artisan.id,{"area":artisan.area,"available":artisan.available})
    db.commit();db.refresh(artisan)
    return {"id":artisan.id,"bio":artisan.bio,"skills":artisan.skills,"area":artisan.area,"available":artisan.available}


def require_job_access(job: Job, db: Session, user: User) -> None:
    if user.role in {UserRole.admin, UserRole.support}:
        return
    if job.client_user_id == user.id:
        return
    artisan = user_artisan(db, user)
    if artisan and (job.assigned_artisan_id == artisan.id or job.status in {JobStatus.open, JobStatus.matched}):
        return
    raise HTTPException(403, "You do not have access to this job")


def quote_dict(quote: Quote, db: Session) -> dict:
    artisan = db.get(Artisan, quote.artisan_id)
    return {"id":quote.id, "job_id":quote.job_id, "artisan_id":quote.artisan_id, "artisan_name":artisan.name if artisan else "Artisan", "artisan_rating":artisan.rating if artisan else 0, "amount":quote.amount, "message":quote.message, "eta_hours":quote.eta_hours, "status":quote.status.value, "created_at":quote.created_at}


@app.get("/v1/quotes")
def list_quotes(job_id: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    query = select(Quote)
    if job_id:
        job = db.get(Job, job_id)
        if not job:
            raise HTTPException(404, "Job not found")
        require_job_access(job, db, user)
        query = query.where(Quote.job_id == job_id)
    elif user.role == UserRole.artisan:
        artisan = user_artisan(db, user)
        query = query.where(Quote.artisan_id == (artisan.id if artisan else ""))
    elif user.role in {UserRole.client, UserRole.estate_manager}:
        query = query.join(Job, Quote.job_id == Job.id).where(Job.client_user_id == user.id)
    elif user.role not in {UserRole.admin, UserRole.support}:
        raise HTTPException(403, "Not authorized")
    return [quote_dict(item, db) for item in db.scalars(query.order_by(Quote.created_at.desc())).all()]


@app.post("/v1/quotes", status_code=201)
def create_quote(data: QuoteCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.artisan))) -> dict:
    artisan = user_artisan(db, user)
    job = db.get(Job, data.job_id)
    if not artisan or not artisan.verified:
        raise HTTPException(403, "Only approved artisans can quote")
    if not job or job.status not in {JobStatus.open, JobStatus.matched}:
        raise HTTPException(409, "This job is not accepting quotes")
    existing = db.scalar(select(Quote).where(Quote.job_id == job.id, Quote.artisan_id == artisan.id, Quote.status == QuoteStatus.pending))
    if existing:
        raise HTTPException(409, "You already submitted a quote")
    quote = Quote(artisan_id=artisan.id, **data.model_dump())
    db.add(quote)
    db.add(Notification(user_id=job.client_user_id, title="New quote received", body=f"{artisan.name} sent a quote for {job.reference}."))
    db.commit(); db.refresh(quote)
    return quote_dict(quote, db)


@app.post("/v1/quotes/{quote_id}/accept")
def accept_quote(quote_id: str, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.client, UserRole.estate_manager))) -> dict:
    quote = db.get(Quote, quote_id)
    job = db.get(Job, quote.job_id) if quote else None
    if not quote or not job:
        raise HTTPException(404, "Quote not found")
    if job.client_user_id != user.id:
        raise HTTPException(403, "Not your job")
    quote.status = QuoteStatus.accepted
    job.assigned_artisan_id = quote.artisan_id
    job.status = JobStatus.assigned
    for other in db.scalars(select(Quote).where(Quote.job_id == job.id, Quote.id != quote.id)).all():
        other.status = QuoteStatus.declined
    artisan = db.get(Artisan, quote.artisan_id)
    if artisan:
        db.add(Notification(user_id=artisan.user_id, title="Quote accepted", body=f"You were selected for {job.reference}."))
    db.add(JobEvent(job_id=job.id, event_type="quote.accepted", actor_id=user.id, payload={"quote_id":quote.id}))
    db.commit()
    return {"status":"accepted", "job_id":job.id}


@app.get("/v1/jobs/{job_id}/room")
def job_room(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    require_job_access(job, db, user)
    messages = db.scalars(select(JobMessage).where(JobMessage.job_id == job.id).order_by(JobMessage.created_at)).all()
    milestones = db.scalars(select(JobMilestone).where(JobMilestone.job_id == job.id).order_by(JobMilestone.created_at)).all()
    quotes = db.scalars(select(Quote).where(Quote.job_id == job.id).order_by(Quote.created_at.desc())).all()
    dispute = db.scalar(select(Dispute).where(Dispute.job_id == job.id).order_by(Dispute.created_at.desc()))
    return {
        "job":{"id":job.id,"reference":job.reference,"title":job.title,"trade":job.trade,"area":job.area,"status":job.status.value,"client_name":job.client_name,"assigned_artisan_id":job.assigned_artisan_id},
        "quotes":[quote_dict(item, db) for item in quotes],
        "messages":[{"id":item.id,"sender_id":item.sender_id,"body":item.body,"kind":item.kind,"attachment_url":item.attachment_url,"created_at":item.created_at} for item in messages],
        "milestones":[{"id":item.id,"title":item.title,"amount":item.amount,"status":item.status.value,"due_at":item.due_at} for item in milestones],
        "dispute":{"id":dispute.id,"reason":dispute.reason,"status":dispute.status.value,"resolution":dispute.resolution} if dispute else None,
        "viewer":{"id":user.id,"role":user.role.value},
    }


@app.post("/v1/jobs/{job_id}/messages", status_code=201)
def send_message(job_id: str, data: MessageCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    require_job_access(job, db, user)
    message = JobMessage(job_id=job.id, sender_id=user.id, **data.model_dump())
    db.add(message); db.commit(); db.refresh(message)
    return {"id":message.id,"sender_id":message.sender_id,"body":message.body,"kind":message.kind,"attachment_url":message.attachment_url,"created_at":message.created_at}


@app.post("/v1/jobs/{job_id}/milestones", status_code=201)
def create_milestone(job_id: str, data: MilestoneCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    require_job_access(job, db, user)
    if user.role not in {UserRole.admin, UserRole.support}:
        artisan = user_artisan(db, user)
        if not artisan or job.assigned_artisan_id != artisan.id:
            raise HTTPException(403, "Only the assigned artisan can propose milestones")
    milestone = JobMilestone(job_id=job.id, **data.model_dump())
    db.add(milestone); db.commit(); db.refresh(milestone)
    return {"id":milestone.id,"title":milestone.title,"amount":milestone.amount,"status":milestone.status.value}


@app.patch("/v1/jobs/{job_id}/status")
def update_job_status(job_id: str, next_status: JobStatus, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    require_job_access(job, db, user)
    artisan = user_artisan(db, user)
    if user.role not in {UserRole.admin, UserRole.support} and (not artisan or job.assigned_artisan_id != artisan.id):
        raise HTTPException(403, "Only the assigned artisan can update progress")
    allowed = {JobStatus.assigned:{JobStatus.in_progress}, JobStatus.in_progress:{JobStatus.completed}}
    if next_status not in allowed.get(job.status, set()):
        raise HTTPException(409, "Invalid job status transition")
    job.status = next_status
    if next_status == JobStatus.completed:
        referral=db.scalar(select(Referral).where(Referral.referred_user_id==job.client_user_id,Referral.status=="qualified"))
        if referral:
            referral.status="rewarded"
            db.add(Notification(user_id=referral.referrer_user_id,title="Referral reward earned",body=f"KSh {referral.reward_amount:,.0f} was added to your referral rewards."))
    db.add(JobEvent(job_id=job.id, event_type=f"job.{next_status.value}", actor_id=user.id, payload={}))
    db.add(Notification(user_id=job.client_user_id, title="Job status updated", body=f"{job.reference} is now {next_status.value.replace('_',' ')}."))
    db.commit()
    return {"id":job.id,"status":job.status.value}


@app.post("/v1/jobs/{job_id}/reviews", status_code=201)
def create_review(job_id: str, data: ReviewCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.client, UserRole.estate_manager))) -> dict:
    job = db.get(Job, job_id)
    if not job or job.client_user_id != user.id:
        raise HTTPException(404, "Completed job not found")
    if job.status != JobStatus.completed or not job.assigned_artisan_id:
        raise HTTPException(409, "Reviews require a completed job")
    if db.scalar(select(Review).where(Review.job_id == job.id)):
        raise HTTPException(409, "This job already has a review")
    review = Review(job_id=job.id, client_user_id=user.id, artisan_id=job.assigned_artisan_id, **data.model_dump())
    db.add(review); db.flush()
    artisan = db.get(Artisan, job.assigned_artisan_id)
    if artisan:
        ratings = db.scalars(select(Review.rating).where(Review.artisan_id == artisan.id)).all()
        artisan.rating = sum(ratings) / len(ratings)
        artisan.completed_jobs = max(artisan.completed_jobs, len(ratings))
    db.commit(); db.refresh(review)
    return {"id":review.id,"rating":review.rating,"comment":review.comment,"verified":True}


@app.post("/v1/jobs/{job_id}/disputes", status_code=201)
def create_dispute(job_id: str, data: DisputeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    require_job_access(job, db, user)
    if db.scalar(select(Dispute).where(Dispute.job_id == job.id, Dispute.status.in_([DisputeStatus.open, DisputeStatus.investigating]))):
        raise HTTPException(409, "An active dispute already exists")
    dispute = Dispute(job_id=job.id, opened_by=user.id, **data.model_dump())
    db.add(dispute); db.commit(); db.refresh(dispute)
    return {"id":dispute.id,"status":dispute.status.value}


@app.get("/v1/admin/disputes")
def list_disputes(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.support))) -> list[dict]:
    rows = db.execute(select(Dispute, Job).join(Job, Dispute.job_id == Job.id).order_by(Dispute.created_at.desc())).all()
    return [{"id":item.id,"job_id":job.id,"reference":job.reference,"title":job.title,"area":job.area,"reason":item.reason,"details":item.details,"evidence":item.evidence,"status":item.status.value,"resolution":item.resolution,"created_at":item.created_at} for item, job in rows]


@app.patch("/v1/admin/disputes/{dispute_id}")
def review_dispute(dispute_id: str, data: DisputeReview, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.support))) -> dict:
    dispute = db.get(Dispute, dispute_id)
    if not dispute:
        raise HTTPException(404, "Dispute not found")
    dispute.status = data.status
    dispute.resolution = data.resolution
    db.commit()
    return {"id":dispute.id,"status":dispute.status.value,"resolution":dispute.resolution}


@app.get("/v1/favorites")
def list_favorites(db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.client, UserRole.estate_manager))) -> list[dict]:
    rows = db.execute(select(Favorite, Artisan).join(Artisan, Favorite.artisan_id == Artisan.id).where(Favorite.user_id == user.id).order_by(Favorite.created_at.desc())).all()
    return [{"id":favorite.id,"artisan":{"id":artisan.id,"name":artisan.name,"trade":artisan.trade,"area":artisan.area,"rating":artisan.rating}} for favorite, artisan in rows]


@app.post("/v1/favorites/{artisan_id}", status_code=201)
def add_favorite(artisan_id: str, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.client, UserRole.estate_manager))) -> dict:
    if not db.get(Artisan, artisan_id):
        raise HTTPException(404, "Artisan not found")
    favorite = db.scalar(select(Favorite).where(Favorite.user_id == user.id, Favorite.artisan_id == artisan_id))
    if not favorite:
        favorite = Favorite(user_id=user.id, artisan_id=artisan_id); db.add(favorite); db.commit(); db.refresh(favorite)
    return {"id":favorite.id,"artisan_id":favorite.artisan_id}


@app.get("/v1/availability")
def get_availability(db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.artisan))) -> list[dict]:
    artisan = user_artisan(db, user)
    rows = db.scalars(select(ArtisanAvailability).where(ArtisanAvailability.artisan_id == (artisan.id if artisan else "")).order_by(ArtisanAvailability.weekday)).all()
    return [{"id":row.id,"weekday":row.weekday,"start_time":row.start_time,"end_time":row.end_time,"active":row.active} for row in rows]


@app.put("/v1/availability")
def set_availability(items: list[AvailabilityCreate], db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.artisan))) -> list[dict]:
    artisan = user_artisan(db, user)
    if not artisan:
        raise HTTPException(403, "Approved artisan profile required")
    for row in db.scalars(select(ArtisanAvailability).where(ArtisanAvailability.artisan_id == artisan.id)).all():
        db.delete(row)
    for item in items:
        db.add(ArtisanAvailability(artisan_id=artisan.id, **item.model_dump()))
    db.commit()
    return get_availability(db, user)


@app.get("/v1/notifications")
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50)).all()
    return [{"id":row.id,"title":row.title,"body":row.body,"channel":row.channel,"read":row.read,"created_at":row.created_at} for row in rows]


@app.get("/v1/integrations/status")
def integration_status(_: User = Depends(require_roles(UserRole.admin, UserRole.support))) -> dict:
    return {
        "mpesa":{"configured":all([settings.mpesa_consumer_key, settings.mpesa_consumer_secret, settings.mpesa_shortcode, settings.mpesa_passkey, settings.mpesa_callback_url])},
        "google_maps":{"configured":bool(settings.google_maps_key)},
        "whatsapp":{"configured":bool(settings.whatsapp_token)},
        "in_app_notifications":{"configured":True},
    }


@app.post("/v1/payments/mpesa/checkout", status_code=202)
async def mpesa_checkout(data: CheckoutCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.client, UserRole.estate_manager))) -> dict:
    job = db.get(Job, data.job_id)
    if not job or job.client_user_id != user.id:
        raise HTTPException(404, "Job not found")
    if not all([settings.mpesa_consumer_key, settings.mpesa_consumer_secret, settings.mpesa_shortcode, settings.mpesa_passkey, settings.mpesa_callback_url]):
        raise HTTPException(503, "M-Pesa is not configured")
    payable=data.amount;promotion=None
    if data.promotion_code:
        now=datetime.now(timezone.utc)
        promotion=db.scalar(select(Promotion).where(func.upper(Promotion.code)==data.promotion_code.upper(),Promotion.active.is_(True),Promotion.starts_at<=now,or_(Promotion.ends_at.is_(None),Promotion.ends_at>=now)))
        if not promotion or (promotion.usage_limit and promotion.uses>=promotion.usage_limit): raise HTTPException(422,"Promotion is unavailable")
        discount=payable*promotion.discount_percent/100
        if promotion.max_discount: discount=min(discount,promotion.max_discount)
        payable=max(round(payable-discount,2),1)
    phone = data.phone.replace("+", "")
    if phone.startswith("0"):
        phone = f"254{phone[1:]}"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{settings.mpesa_shortcode}{settings.mpesa_passkey}{timestamp}".encode()).decode()
    async with httpx.AsyncClient(timeout=20) as client:
        auth = await client.get(f"{settings.mpesa_base_url}/oauth/v1/generate?grant_type=client_credentials", auth=(settings.mpesa_consumer_key, settings.mpesa_consumer_secret))
        if auth.status_code != 200:
            raise HTTPException(502, "M-Pesa authentication failed")
        response = await client.post(f"{settings.mpesa_base_url}/mpesa/stkpush/v1/processrequest", headers={"Authorization":f"Bearer {auth.json()['access_token']}"}, json={
            "BusinessShortCode":settings.mpesa_shortcode,"Password":password,"Timestamp":timestamp,"TransactionType":"CustomerPayBillOnline",
            "Amount":round(payable),"PartyA":phone,"PartyB":settings.mpesa_shortcode,"PhoneNumber":phone,"CallBackURL":settings.mpesa_callback_url,
            "AccountReference":job.reference,"TransactionDesc":f"Mafundi job {job.reference}",
        })
    if response.status_code != 200:
        raise HTTPException(502, "M-Pesa checkout request failed")
    payload = response.json()
    fee = round(payable * settings.platform_fee_rate, 2)
    transaction = PaymentTransaction(job_id=job.id, client_user_id=user.id, artisan_id=job.assigned_artisan_id, provider="mpesa", provider_reference=payload["CheckoutRequestID"], amount=payable, platform_fee=fee, artisan_net=payable-fee, status=PaymentStatus.pending)
    if promotion: promotion.uses+=1
    db.add(transaction); db.commit()
    return {"checkout_request_id":payload["CheckoutRequestID"],"status":"pending","message":"Confirm the M-Pesa prompt on your phone."}


@app.post("/v1/payments/mpesa/callback")
def mpesa_callback(payload: dict, request:Request, callback_secret:str="",db: Session = Depends(get_db)) -> dict:
    supplied=callback_secret or request.headers.get("x-callback-secret","")
    if settings.mpesa_callback_secret and supplied!=settings.mpesa_callback_secret: raise HTTPException(401,"Invalid callback secret")
    callback = payload.get("Body",{}).get("stkCallback",{})
    reference = callback.get("CheckoutRequestID","")
    transaction = db.scalar(select(PaymentTransaction).where(PaymentTransaction.provider_reference == reference))
    if transaction:
        transaction.status = PaymentStatus.held if callback.get("ResultCode") == 0 else PaymentStatus.failed
        if transaction.status == PaymentStatus.held:
            transaction.completed_at = datetime.now(timezone.utc)
            if not db.scalar(select(Invoice).where(Invoice.transaction_id == transaction.id)):
                sequence = (db.scalar(select(func.count(Invoice.id))) or 0) + 1
                tax = round(transaction.platform_fee * settings.tax_rate, 2)
                db.add(Invoice(number=f"MM-{datetime.now().year}-{sequence:06d}", transaction_id=transaction.id, client_user_id=transaction.client_user_id, subtotal=transaction.amount, platform_fee=transaction.platform_fee, tax_amount=tax, total=transaction.amount, currency="KES"))
        db.commit()
    else:
        subscription=db.scalar(select(Subscription).where(Subscription.provider_reference==reference))
        if subscription:
            subscription.status="active" if callback.get("ResultCode")==0 else "payment_failed"
            if subscription.status=="active": subscription.renews_at=datetime.now(timezone.utc)+timedelta(days=30)
            db.commit()
    return {"ResultCode":0,"ResultDesc":"Accepted"}


class PromotionCreate(BaseModel):
    code: str = Field(min_length=3, max_length=40)
    description: str = Field(default="", max_length=180)
    discount_percent: float = Field(ge=0, le=100)
    max_discount: float = Field(default=0, ge=0)
    usage_limit: int = Field(default=0, ge=0)


class SubscriptionCreate(BaseModel):
    plan: str = Field(pattern="^(free|pro|business)$")


class DeviceCreate(BaseModel):
    token: str = Field(min_length=8, max_length=500)
    platform: str = Field(default="web", pattern="^(web|android|ios)$")


class DispatchCreate(BaseModel):
    user_id: str
    title: str = Field(min_length=2, max_length=180)
    body: str = Field(min_length=2, max_length=2000)
    channels: list[str] = Field(default_factory=lambda:["in_app"])


class PaymentMethodCreate(BaseModel):
    method_type: str = Field(pattern="^(mpesa|card|cash|wallet)$")
    provider: str = Field(min_length=2, max_length=40)
    provider_token: str = Field(default="", max_length=500)
    label: str = Field(min_length=2, max_length=80)
    last_four: str = Field(default="", pattern=r"^\d{0,4}$")
    is_default: bool = False


class InquiryCreate(BaseModel):
    artisan_id: str
    message: str = Field(min_length=10,max_length=4000)
    phone: str = Field(min_length=7,max_length=30)


class CampaignCreate(BaseModel):
    slug: str = Field(min_length=3, max_length=80, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=2, max_length=120)
    headline: str = Field(min_length=3, max_length=180)
    message: str = Field(min_length=3, max_length=2000)
    theme: str = Field(default="celebration", pattern="^(celebration|christmas|new-year|valentine|easter|eid|halloween|kenya|launch)$")
    offer_code: str = Field(default="", max_length=40)
    starts_at: datetime
    ends_at: datetime


class CampaignUpdate(BaseModel):
    headline: str | None = Field(default=None, max_length=180)
    message: str | None = Field(default=None, max_length=2000)
    offer_code: str | None = Field(default=None, max_length=40)
    active: bool | None = None


def audit(db: Session, actor_id: str | None, action: str, resource_type: str, resource_id: str = "", metadata: dict | None = None) -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, resource_type=resource_type, resource_id=resource_id, metadata_json=metadata or {}))


def automatic_campaign(now: datetime) -> dict | None:
    month, day = now.month, now.day
    rules = [
        ((12,18),(12,27),{"slug":"christmas","name":"Christmas","headline":"Thank you for building Nairobi with us.","message":"Book early for holiday repairs and give yourself more time for what matters.","theme":"christmas","offer_code":""}),
        ((12,28),(1,5),{"slug":"new-year","name":"New Year","headline":"A fresh start for every home.","message":"Start the year with trusted help and neighbourhood professionals.","theme":"new-year","offer_code":""}),
        ((2,10),(2,16),{"slug":"valentine","name":"Valentine season","headline":"Care for the spaces you love.","message":"Refresh, repair and prepare your home with verified local artisans.","theme":"valentine","offer_code":""}),
        ((10,25),(11,1),{"slug":"halloween","name":"Halloween","headline":"No scary surprises in your repairs.","message":"Get transparent quotes and protected work from verified professionals.","theme":"halloween","offer_code":""}),
        ((5,28),(6,2),{"slug":"madaraka","name":"Madaraka Day","headline":"Built by Kenyan hands.","message":"Celebrating the skilled people who keep our neighbourhoods moving.","theme":"kenya","offer_code":""}),
        ((10,17),(10,22),{"slug":"mashujaa","name":"Mashujaa Day","headline":"Celebrating everyday neighbourhood heroes.","message":"Thank you to every artisan and client building stronger communities.","theme":"kenya","offer_code":""}),
        ((12,9),(12,14),{"slug":"jamhuri","name":"Jamhuri Day","headline":"Made for Nairobi. Built for Kenya.","message":"Reliable local work, transparent progress and stronger neighbourhoods.","theme":"kenya","offer_code":""}),
    ]
    current = month * 100 + day
    for start, end, campaign in rules:
        lower, upper = start[0]*100+start[1], end[0]*100+end[1]
        if (lower <= upper and lower <= current <= upper) or (lower > upper and (current >= lower or current <= upper)):
            return campaign
    return None


@app.get("/v1/campaigns/active")
def active_campaign(db: Session = Depends(get_db)) -> dict | None:
    now=datetime.now(timezone.utc)
    item=db.scalar(select(Campaign).where(Campaign.active.is_(True),Campaign.starts_at<=now,Campaign.ends_at>=now).order_by(Campaign.starts_at.desc()))
    if item:
        return {"slug":item.slug,"name":item.name,"headline":item.headline,"message":item.message,"theme":item.theme,"offer_code":item.offer_code,"source":"operations"}
    campaign=automatic_campaign(now)
    return {**campaign,"source":"calendar"} if campaign else None


@app.post("/v1/admin/campaigns", status_code=201)
def create_campaign(data: CampaignCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin))) -> dict:
    if data.ends_at <= data.starts_at: raise HTTPException(422,"Campaign end must follow its start")
    item=Campaign(**data.model_dump());db.add(item);db.flush();audit(db,user.id,"campaign.created","campaign",item.id,{"slug":item.slug});db.commit();db.refresh(item)
    return {"id":item.id,"slug":item.slug,"active":item.active}


@app.get("/v1/admin/campaigns")
def list_campaigns(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin,UserRole.support))) -> list[dict]:
    rows=db.scalars(select(Campaign).order_by(Campaign.starts_at.desc())).all()
    return [{"id":row.id,"slug":row.slug,"name":row.name,"headline":row.headline,"message":row.message,"theme":row.theme,"offer_code":row.offer_code,"starts_at":row.starts_at,"ends_at":row.ends_at,"active":row.active} for row in rows]


@app.patch("/v1/admin/campaigns/{campaign_id}")
def update_campaign(campaign_id:str,data:CampaignUpdate,db:Session=Depends(get_db),user:User=Depends(require_roles(UserRole.admin))) -> dict:
    item=db.get(Campaign,campaign_id)
    if not item: raise HTTPException(404,"Campaign not found")
    changes=data.model_dump(exclude_none=True)
    for key,value in changes.items(): setattr(item,key,value)
    audit(db,user.id,"campaign.updated","campaign",item.id,changes);db.commit()
    return {"id":item.id,"slug":item.slug,"active":item.active}


@app.get("/v1/payment-methods")
def list_payment_methods(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    rows=db.scalars(select(PaymentMethod).where(PaymentMethod.user_id==user.id,PaymentMethod.active.is_(True)).order_by(PaymentMethod.is_default.desc(),PaymentMethod.created_at)).all()
    return [{"id":row.id,"method_type":row.method_type,"provider":row.provider,"label":row.label,"last_four":row.last_four,"is_default":row.is_default} for row in rows]


@app.post("/v1/inquiries",status_code=201)
def create_inquiry(data:InquiryCreate,db:Session=Depends(get_db),user:User=Depends(require_roles(UserRole.client,UserRole.estate_manager))) -> dict:
    artisan=db.get(Artisan,data.artisan_id)
    if not artisan or not artisan.verified: raise HTTPException(404,"Verified artisan not found")
    item=ArtisanInquiry(client_user_id=user.id,**data.model_dump());db.add(item);db.add(Notification(user_id=artisan.user_id,title="New client introduction",body="A client sent a secure introduction. Open your dashboard to respond."));db.flush();audit(db,user.id,"inquiry.created","artisan_inquiry",item.id,{"artisan_id":artisan.id});db.commit();db.refresh(item)
    return {"id":item.id,"status":item.status}


@app.post("/v1/payment-methods", status_code=201)
def add_payment_method(data: PaymentMethodCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    if data.method_type=="card" and not data.provider_token: raise HTTPException(422,"Cards must be tokenized by the payment provider")
    if data.is_default:
        for row in db.scalars(select(PaymentMethod).where(PaymentMethod.user_id==user.id)): row.is_default=False
    item=PaymentMethod(user_id=user.id,**data.model_dump());db.add(item);db.flush();audit(db,user.id,"payment_method.added","payment_method",item.id,{"type":item.method_type,"provider":item.provider});db.commit();db.refresh(item)
    return {"id":item.id,"method_type":item.method_type,"label":item.label,"last_four":item.last_four,"is_default":item.is_default}


@app.delete("/v1/payment-methods/{method_id}", status_code=204)
def remove_payment_method(method_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    item=db.get(PaymentMethod,method_id)
    if not item or item.user_id!=user.id: raise HTTPException(404,"Payment method not found")
    item.active=False;audit(db,user.id,"payment_method.removed","payment_method",item.id);db.commit()


@app.get("/v1/admin/audit-logs")
def list_audit_logs(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin,UserRole.support)), limit:int=Query(100,ge=1,le=500)) -> list[dict]:
    rows=db.scalars(select(AuditLog).order_by(AuditLog.occurred_at.desc()).limit(limit)).all()
    return [{"id":row.id,"actor_id":row.actor_id,"action":row.action,"resource_type":row.resource_type,"resource_id":row.resource_id,"metadata":row.metadata_json,"occurred_at":row.occurred_at} for row in rows]


@app.get("/v1/referrals/me")
def my_referral(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    referral = db.scalar(select(Referral).where(Referral.referrer_user_id == user.id, Referral.referred_user_id.is_(None)))
    if not referral:
        referral = Referral(referrer_user_id=user.id, code=f"MM-{user.id.replace('-','')[:8].upper()}", reward_amount=0)
        db.add(referral); db.commit(); db.refresh(referral)
    completed = db.scalar(select(func.count(Referral.id)).where(Referral.referrer_user_id == user.id, Referral.status == "rewarded")) or 0
    rewards = db.scalar(select(func.coalesce(func.sum(Referral.reward_amount),0)).where(Referral.referrer_user_id == user.id, Referral.status == "rewarded")) or 0
    return {"code":referral.code,"completed_referrals":completed,"rewards_earned":rewards}


@app.get("/v1/promotions/{code}")
def validate_promotion(code: str, amount: float = Query(gt=0), db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> dict:
    now = datetime.now(timezone.utc)
    promotion = db.scalar(select(Promotion).where(func.upper(Promotion.code) == code.upper(), Promotion.active.is_(True), Promotion.starts_at <= now, or_(Promotion.ends_at.is_(None),Promotion.ends_at >= now)))
    if not promotion or (promotion.usage_limit and promotion.uses >= promotion.usage_limit):
        raise HTTPException(404, "Promotion is unavailable")
    discount = amount * promotion.discount_percent / 100
    if promotion.max_discount:
        discount = min(discount, promotion.max_discount)
    return {"code":promotion.code,"discount":round(discount,2),"payable":round(max(amount-discount,0),2),"description":promotion.description}


@app.post("/v1/admin/promotions", status_code=201)
def create_promotion(data: PromotionCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin))) -> dict:
    promotion = Promotion(code=data.code.upper(), **data.model_dump(exclude={"code"}))
    db.add(promotion)
    try: db.commit()
    except IntegrityError as exc:
        db.rollback(); raise HTTPException(409,"Promotion code already exists") from exc
    return {"id":promotion.id,"code":promotion.code,"active":promotion.active}


@app.get("/v1/subscriptions/me")
def my_subscription(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    item = db.scalar(select(Subscription).where(Subscription.user_id == user.id, Subscription.status.in_(["active","pending"])).order_by(Subscription.started_at.desc()))
    return {"plan":item.plan if item else "free","status":item.status if item else "active","monthly_amount":item.monthly_amount if item else 0,"renews_at":item.renews_at if item else None}


@app.post("/v1/subscriptions")
def choose_subscription(data: SubscriptionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    prices={"free":0,"pro":999,"business":2999}
    for current in db.scalars(select(Subscription).where(Subscription.user_id == user.id, Subscription.status.in_(["active","pending"]))).all():
        current.status="cancelled"
    item=Subscription(user_id=user.id,plan=data.plan,monthly_amount=prices[data.plan],status="active" if data.plan=="free" else "pending")
    db.add(item);db.commit();db.refresh(item)
    return {"id":item.id,"plan":item.plan,"status":item.status,"monthly_amount":item.monthly_amount,"payment_required":item.status=="pending"}


class SubscriptionCheckout(BaseModel):
    phone:str=Field(min_length=10,max_length=16)


@app.post("/v1/subscriptions/checkout")
async def subscription_checkout(data:SubscriptionCheckout,db:Session=Depends(get_db),user:User=Depends(get_current_user)) -> dict:
    item=db.scalar(select(Subscription).where(Subscription.user_id==user.id,Subscription.status=="pending").order_by(Subscription.started_at.desc()))
    if not item or item.monthly_amount<=0: raise HTTPException(409,"No paid subscription is awaiting payment")
    if not all([settings.mpesa_consumer_key,settings.mpesa_consumer_secret,settings.mpesa_shortcode,settings.mpesa_passkey,settings.mpesa_callback_url]): raise HTTPException(503,"M-Pesa is not configured")
    phone=data.phone.replace("+","").replace(" ","")
    timestamp=datetime.now().strftime("%Y%m%d%H%M%S")
    password=base64.b64encode(f"{settings.mpesa_shortcode}{settings.mpesa_passkey}{timestamp}".encode()).decode()
    async with httpx.AsyncClient(timeout=20) as client:
        auth=await client.get(f"{settings.mpesa_base_url}/oauth/v1/generate?grant_type=client_credentials",auth=(settings.mpesa_consumer_key,settings.mpesa_consumer_secret))
        if not auth.is_success: raise HTTPException(502,"M-Pesa authentication failed")
        response=await client.post(f"{settings.mpesa_base_url}/mpesa/stkpush/v1/processrequest",headers={"Authorization":f"Bearer {auth.json()['access_token']}"},json={"BusinessShortCode":settings.mpesa_shortcode,"Password":password,"Timestamp":timestamp,"TransactionType":"CustomerPayBillOnline","Amount":round(item.monthly_amount),"PartyA":phone,"PartyB":settings.mpesa_shortcode,"PhoneNumber":phone,"CallBackURL":settings.mpesa_callback_url,"AccountReference":f"PLAN-{item.plan.upper()}","TransactionDesc":f"Mafundi {item.plan} subscription"})
    if not response.is_success: raise HTTPException(502,"M-Pesa checkout request failed")
    item.provider_reference=response.json()["CheckoutRequestID"];item.phone=phone;db.commit()
    return {"checkout_request_id":item.provider_reference,"status":"pending","message":"Confirm the subscription prompt on your phone."}


@app.get("/v1/invoices")
def list_invoices(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    query=select(Invoice)
    if user.role in {UserRole.client,UserRole.estate_manager}: query=query.where(Invoice.client_user_id==user.id)
    elif user.role==UserRole.artisan:
        artisan=user_artisan(db,user)
        query=query.join(PaymentTransaction,Invoice.transaction_id==PaymentTransaction.id).where(PaymentTransaction.artisan_id==(artisan.id if artisan else ""))
    elif user.role not in {UserRole.admin,UserRole.support}: raise HTTPException(403,"Not authorized")
    rows=db.scalars(query.order_by(Invoice.issued_at.desc())).all()
    return [{"id":row.id,"number":row.number,"subtotal":row.subtotal,"platform_fee":row.platform_fee,"tax_amount":row.tax_amount,"total":row.total,"currency":row.currency,"issued_at":row.issued_at} for row in rows]


def simple_pdf(lines:list[str]) -> bytes:
    escaped=[line.replace("\\","\\\\").replace("(","\\(").replace(")","\\)") for line in lines]
    stream="BT /F1 12 Tf 52 790 Td 18 TL "+" ".join(f"({line}) Tj T*" for line in escaped)+" ET"
    objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",f"<< /Length {len(stream.encode())} >>\nstream\n{stream}\nendstream"]
    pdf=b"%PDF-1.4\n";offsets=[]
    for index,obj in enumerate(objects,1): offsets.append(len(pdf));pdf+=f"{index} 0 obj\n{obj}\nendobj\n".encode()
    xref=len(pdf);pdf+=f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode()
    for offset in offsets: pdf+=f"{offset:010d} 00000 n \n".encode()
    pdf+=f"trailer << /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return pdf


@app.get("/v1/invoices/{invoice_id}/pdf")
def invoice_pdf(invoice_id:str,db:Session=Depends(get_db),user:User=Depends(get_current_user)) -> Response:
    invoice=db.get(Invoice,invoice_id)
    if not invoice: raise HTTPException(404,"Invoice not found")
    transaction=db.get(PaymentTransaction,invoice.transaction_id)
    if user.role in {UserRole.client,UserRole.estate_manager} and invoice.client_user_id!=user.id: raise HTTPException(403,"Not authorized")
    if user.role==UserRole.artisan:
        artisan=user_artisan(db,user)
        if not artisan or not transaction or transaction.artisan_id!=artisan.id: raise HTTPException(403,"Not authorized")
    lines=["MAFUNDI MTAANI","Tax invoice",f"Invoice: {invoice.number}",f"Issued: {invoice.issued_at.date().isoformat()}",f"Subtotal: KES {invoice.subtotal:,.2f}",f"Platform fee: KES {invoice.platform_fee:,.2f}",f"Tax: KES {invoice.tax_amount:,.2f}",f"Total: KES {invoice.total:,.2f}","info@mafundimtaani.co.ke | +254 720 898678"]
    return Response(simple_pdf(lines),media_type="application/pdf",headers={"Content-Disposition":f'attachment; filename="{invoice.number}.pdf"'})


@app.get("/v1/admin/reconciliation")
def reconciliation(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin,UserRole.support))) -> dict:
    by_status=db.execute(select(PaymentTransaction.status,func.count(PaymentTransaction.id),func.coalesce(func.sum(PaymentTransaction.amount),0)).group_by(PaymentTransaction.status)).all()
    return {"payments":[{"status":status.value,"count":count,"amount":amount} for status,count,amount in by_status],"invoice_count":db.scalar(select(func.count(Invoice.id))) or 0,"un_invoiced":db.scalar(select(func.count(PaymentTransaction.id)).outerjoin(Invoice,Invoice.transaction_id==PaymentTransaction.id).where(Invoice.id.is_(None),PaymentTransaction.status.in_([PaymentStatus.held,PaymentStatus.completed]))) or 0}


@app.post("/v1/admin/reconciliation/run")
def run_reconciliation(db:Session=Depends(get_db),user:User=Depends(require_roles(UserRole.admin,UserRole.support))) -> dict:
    transactions=db.scalars(select(PaymentTransaction).outerjoin(Invoice,Invoice.transaction_id==PaymentTransaction.id).where(Invoice.id.is_(None),PaymentTransaction.status.in_([PaymentStatus.held,PaymentStatus.completed]))).all()
    base=db.scalar(select(func.count(Invoice.id))) or 0
    for index,transaction in enumerate(transactions,1):
        db.add(Invoice(number=f"MM-{datetime.now().year}-{base+index:06d}",transaction_id=transaction.id,client_user_id=transaction.client_user_id,subtotal=transaction.amount,platform_fee=transaction.platform_fee,tax_amount=round(transaction.platform_fee*settings.tax_rate,2),total=transaction.amount,currency="KES"))
    audit(db,user.id,"reconciliation.completed","payment",metadata={"invoices_created":len(transactions)});db.commit()
    return {"invoices_created":len(transactions)}


class RefundCreate(BaseModel):
    reason:str=Field(min_length=5,max_length=300)


@app.post("/v1/admin/payments/{transaction_id}/refund")
def record_refund(transaction_id:str,data:RefundCreate,db:Session=Depends(get_db),user:User=Depends(require_roles(UserRole.admin))) -> dict:
    transaction=db.get(PaymentTransaction,transaction_id)
    if not transaction: raise HTTPException(404,"Payment not found")
    if transaction.status not in {PaymentStatus.held,PaymentStatus.completed}: raise HTTPException(409,"Payment cannot be refunded")
    transaction.status=PaymentStatus.refunded
    audit(db,user.id,"payment.refund_recorded","payment",transaction.id,{"reason":data.reason,"provider_reference":transaction.provider_reference});db.commit()
    return {"id":transaction.id,"status":transaction.status.value,"provider_action_required":transaction.provider=="mpesa"}


@app.post("/v1/devices", status_code=201)
def register_device(data: DeviceCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    item=db.scalar(select(DeviceToken).where(DeviceToken.token==data.token))
    if item: item.user_id=user.id;item.platform=data.platform;item.active=True
    else: item=DeviceToken(user_id=user.id,**data.model_dump());db.add(item)
    db.commit();db.refresh(item)
    return {"id":item.id,"platform":item.platform,"active":item.active}


async def deliver_notification(db:Session,user: User, title: str, body: str, channels: list[str]) -> dict:
    results={"in_app":"queued"}
    if "email" in channels:
        if settings.smtp_host and user.email:
            message=EmailMessage();message["Subject"]=title;message["From"]=settings.smtp_from;message["To"]=user.email;message.set_content(body)
            try:
                with smtplib.SMTP(settings.smtp_host,settings.smtp_port,timeout=15) as smtp:
                    smtp.starttls()
                    if settings.smtp_username: smtp.login(settings.smtp_username,settings.smtp_password)
                    smtp.send_message(message)
                results["email"]="sent"
            except Exception: results["email"]="failed"
        else: results["email"]="not_configured"
    if "whatsapp" in channels:
        if settings.whatsapp_token and settings.whatsapp_phone_number_id and user.phone:
            async with httpx.AsyncClient(timeout=15) as client:
                response=await client.post(f"https://graph.facebook.com/v22.0/{settings.whatsapp_phone_number_id}/messages",headers={"Authorization":f"Bearer {settings.whatsapp_token}"},json={"messaging_product":"whatsapp","to":user.phone.replace("+",""),"type":"text","text":{"body":f"{title}\n{body}"}})
            results["whatsapp"]="sent" if response.is_success else "failed"
        else: results["whatsapp"]="not_configured"
    if "sms" in channels:
        if settings.sms_api_key and settings.sms_username and user.phone:
            async with httpx.AsyncClient(timeout=15) as client:
                response=await client.post("https://api.africastalking.com/version1/messaging",headers={"apiKey":settings.sms_api_key,"Accept":"application/json"},data={"username":settings.sms_username,"to":user.phone,"message":f"{title}: {body}"})
            results["sms"]="sent" if response.is_success else "failed"
        else: results["sms"]="not_configured"
    if "push" in channels:
        tokens=db.scalars(select(DeviceToken).where(DeviceToken.user_id==user.id,DeviceToken.active.is_(True),DeviceToken.platform.in_(["android","ios"]))).all()
        if tokens:
            async with httpx.AsyncClient(timeout=15) as client:
                response=await client.post("https://exp.host/--/api/v2/push/send",headers={"Accept":"application/json","Content-Type":"application/json"},json=[{"to":item.token,"title":title,"body":body,"sound":"default"} for item in tokens])
            results["push"]="sent" if response.is_success else "failed"
        else: results["push"]="no_active_device"
    return results


@app.post("/v1/admin/notifications/dispatch")
async def dispatch_notification(data: DispatchCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin,UserRole.support))) -> dict:
    recipient=db.get(User,data.user_id)
    if not recipient: raise HTTPException(404,"Recipient not found")
    db.add(Notification(user_id=recipient.id,title=data.title,body=data.body,channel=",".join(data.channels)));db.commit()
    return {"delivery":await deliver_notification(db,recipient,data.title,data.body,data.channels)}


@app.get("/v1/admin/risk-signals")
def list_risk_signals(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin,UserRole.support))) -> list[dict]:
    rows=db.scalars(select(RiskSignal).order_by(RiskSignal.created_at.desc()).limit(100)).all()
    return [{"id":row.id,"user_id":row.user_id,"job_id":row.job_id,"signal_type":row.signal_type,"severity":row.severity,"score":row.score,"details":row.details,"status":row.status,"created_at":row.created_at} for row in rows]


@app.get("/v1/admin/document-verifications")
def list_document_verifications(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin,UserRole.support))) -> list[dict]:
    rows=db.scalars(select(DocumentVerification).order_by(DocumentVerification.created_at.desc())).all()
    return [{"id":row.id,"application_id":row.application_id,"document_type":row.document_type,"status":row.status,"provider":row.provider,"confidence":row.confidence,"expires_at":row.expires_at,"notes":row.notes} for row in rows]


class VerificationResult(BaseModel):
    verification_id:str
    status:str=Field(pattern="^(pending|verified|rejected|expired)$")
    provider:str=Field(min_length=2,max_length=80)
    confidence:float=Field(default=0,ge=0,le=1)
    notes:str=Field(default="",max_length=1000)
    expires_at:datetime|None=None


@app.post("/v1/webhooks/verification")
def verification_webhook(data:VerificationResult,request:Request,db:Session=Depends(get_db)) -> dict:
    supplied=request.headers.get("x-webhook-secret","")
    if not settings.verification_webhook_secret or supplied!=settings.verification_webhook_secret: raise HTTPException(401,"Invalid webhook secret")
    item=db.get(DocumentVerification,data.verification_id)
    if not item: raise HTTPException(404,"Verification not found")
    item.status=data.status;item.provider=data.provider;item.confidence=data.confidence;item.notes=data.notes;item.expires_at=data.expires_at
    audit(db,None,"verification.result_received","document_verification",item.id,{"provider":data.provider,"status":data.status});db.commit()
    return {"id":item.id,"status":item.status}


@app.post("/v1/admin/document-verifications/expiry-scan")
def verification_expiry_scan(db:Session=Depends(get_db),user:User=Depends(require_roles(UserRole.admin,UserRole.support))) -> dict:
    now=datetime.now(timezone.utc)
    rows=db.scalars(select(DocumentVerification).where(DocumentVerification.expires_at.is_not(None),DocumentVerification.expires_at<now,DocumentVerification.status=="verified")).all()
    for item in rows: item.status="expired"
    audit(db,user.id,"verification.expiry_scan","document_verification",metadata={"expired":len(rows)});db.commit()
    return {"expired":len(rows)}


@app.get("/v1/admin/metrics")
def admin_metrics(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.support))) -> dict:
    status_rows = db.execute(select(Job.status, func.count(Job.id)).group_by(Job.status)).all()
    role_rows = db.execute(select(User.role, func.count(User.id)).group_by(User.role)).all()
    trade_rows = db.execute(select(Job.trade, func.count(Job.id)).group_by(Job.trade).order_by(func.count(Job.id).desc()).limit(6)).all()
    area_rows = db.execute(select(Job.area, func.count(Job.id)).group_by(Job.area).order_by(func.count(Job.id).desc()).limit(6)).all()
    completed_payments = PaymentTransaction.status == PaymentStatus.completed
    return {
        "active_artisans": db.scalar(select(func.count(Artisan.id)).where(Artisan.verified.is_(True))) or 0,
        "open_jobs": db.scalar(select(func.count(Job.id)).where(Job.status == "open")) or 0,
        "pending_applications": db.scalar(select(func.count(ArtisanApplication.id)).where(ArtisanApplication.status == ApplicationStatus.pending)) or 0,
        "supported_estates": len(NAIROBI_AREAS),
        "total_users": db.scalar(select(func.count(User.id))) or 0,
        "total_jobs": db.scalar(select(func.count(Job.id))) or 0,
        "payments_received": db.scalar(select(func.coalesce(func.sum(PaymentTransaction.amount), 0)).where(completed_payments)) or 0,
        "platform_commission": db.scalar(select(func.coalesce(func.sum(PaymentTransaction.platform_fee), 0)).where(completed_payments)) or 0,
        "artisan_payouts": db.scalar(select(func.coalesce(func.sum(PaymentTransaction.artisan_net), 0)).where(completed_payments)) or 0,
        "funds_held": db.scalar(select(func.coalesce(func.sum(PaymentTransaction.amount), 0)).where(PaymentTransaction.status == PaymentStatus.held)) or 0,
        "open_disputes": db.scalar(select(func.count(Dispute.id)).where(Dispute.status.in_([DisputeStatus.open, DisputeStatus.investigating]))) or 0,
        "jobs_by_status": {str(status.value): count for status, count in status_rows},
        "users_by_role": {str(role.value): count for role, count in role_rows},
        "jobs_by_trade": [{"label": trade, "value": count} for trade, count in trade_rows],
        "jobs_by_area": [{"label": area, "value": count} for area, count in area_rows],
        "finance_source": "payment_transactions",
    }


@app.get("/v1/dashboard/metrics")
def dashboard_metrics(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    job_query = select(Job)
    payment_query = select(PaymentTransaction)
    if user.role in {UserRole.client, UserRole.estate_manager}:
        job_query = job_query.where(Job.client_user_id == user.id)
        payment_query = payment_query.where(PaymentTransaction.client_user_id == user.id)
    elif user.role == UserRole.artisan:
        artisan_id = db.scalar(select(Artisan.id).where(Artisan.user_id == user.id))
        job_query = job_query.where(Job.assigned_artisan_id == artisan_id)
        payment_query = payment_query.where(PaymentTransaction.artisan_id == artisan_id)
    else:
        raise HTTPException(403, "Use the operations analytics endpoint")
    jobs = db.scalars(job_query).all()
    payments = db.scalars(payment_query).all()
    status_counts = {status.value: 0 for status in JobStatus}
    for job in jobs:
        status_counts[job.status.value] += 1
    completed = [payment for payment in payments if payment.status == PaymentStatus.completed]
    return {
        "role": user.role.value,
        "jobs_total": len(jobs),
        "jobs_by_status": status_counts,
        "money_spent": sum(payment.amount for payment in completed) if user.role in {UserRole.client, UserRole.estate_manager} else 0,
        "gross_earnings": sum(payment.amount for payment in completed) if user.role == UserRole.artisan else 0,
        "platform_fees": sum(payment.platform_fee for payment in completed),
        "net_earnings": sum(payment.artisan_net for payment in completed) if user.role == UserRole.artisan else 0,
        "funds_held": sum(payment.amount for payment in payments if payment.status == PaymentStatus.held),
        "transactions": len(payments),
    }
