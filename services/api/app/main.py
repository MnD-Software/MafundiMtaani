from contextlib import asynccontextmanager
import base64
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import httpx
import smtplib
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .auth import create_access_token, get_current_user, hash_password, require_roles, verify_password
from .matching import score_match
from .models import ApplicationStatus, Artisan, ArtisanApplication, ArtisanAvailability, DeviceToken, Dispute, DisputeStatus, DocumentVerification, Favorite, Invoice, Job, JobEvent, JobMessage, JobMilestone, JobStatus, MilestoneStatus, Notification, PaymentStatus, PaymentTransaction, Promotion, Quote, QuoteStatus, Referral, Review, RiskSignal, Subscription, User, UserRole
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
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "marketplace-api", "version": "2.1.0"}


@app.post("/v1/auth/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if data.account_type not in {UserRole.client, UserRole.artisan, UserRole.estate_manager}:
        raise HTTPException(422, "This account type cannot self-register")
    user = User(email=data.email.lower().strip(), password_hash=hash_password(data.password), name=data.name, phone=data.phone, role=data.account_type)
    db.add(user)
    try:
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


class CheckoutCreate(BaseModel):
    job_id: str
    phone: str = Field(min_length=10, max_length=15)
    amount: float = Field(gt=0)


def user_artisan(db: Session, user: User) -> Artisan | None:
    return db.scalar(select(Artisan).where(Artisan.user_id == user.id))


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
            "Amount":round(data.amount),"PartyA":phone,"PartyB":settings.mpesa_shortcode,"PhoneNumber":phone,"CallBackURL":settings.mpesa_callback_url,
            "AccountReference":job.reference,"TransactionDesc":f"Mafundi job {job.reference}",
        })
    if response.status_code != 200:
        raise HTTPException(502, "M-Pesa checkout request failed")
    payload = response.json()
    fee = round(data.amount * settings.platform_fee_rate, 2)
    transaction = PaymentTransaction(job_id=job.id, client_user_id=user.id, artisan_id=job.assigned_artisan_id, provider="mpesa", provider_reference=payload["CheckoutRequestID"], amount=data.amount, platform_fee=fee, artisan_net=data.amount-fee, status=PaymentStatus.pending)
    db.add(transaction); db.commit()
    return {"checkout_request_id":payload["CheckoutRequestID"],"status":"pending","message":"Confirm the M-Pesa prompt on your phone."}


@app.post("/v1/payments/mpesa/callback")
def mpesa_callback(payload: dict, db: Session = Depends(get_db)) -> dict:
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


@app.get("/v1/admin/reconciliation")
def reconciliation(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin,UserRole.support))) -> dict:
    by_status=db.execute(select(PaymentTransaction.status,func.count(PaymentTransaction.id),func.coalesce(func.sum(PaymentTransaction.amount),0)).group_by(PaymentTransaction.status)).all()
    return {"payments":[{"status":status.value,"count":count,"amount":amount} for status,count,amount in by_status],"invoice_count":db.scalar(select(func.count(Invoice.id))) or 0,"un_invoiced":db.scalar(select(func.count(PaymentTransaction.id)).outerjoin(Invoice,Invoice.transaction_id==PaymentTransaction.id).where(Invoice.id.is_(None),PaymentTransaction.status.in_([PaymentStatus.held,PaymentStatus.completed]))) or 0}


@app.post("/v1/devices", status_code=201)
def register_device(data: DeviceCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    item=db.scalar(select(DeviceToken).where(DeviceToken.token==data.token))
    if item: item.user_id=user.id;item.platform=data.platform;item.active=True
    else: item=DeviceToken(user_id=user.id,**data.model_dump());db.add(item)
    db.commit();db.refresh(item)
    return {"id":item.id,"platform":item.platform,"active":item.active}


async def deliver_notification(user: User, title: str, body: str, channels: list[str]) -> dict:
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
    if "sms" in channels: results["sms"]="not_configured" if not settings.sms_api_key else "queued"
    if "push" in channels: results["push"]="not_configured" if not settings.web_push_private_key else "queued"
    return results


@app.post("/v1/admin/notifications/dispatch")
async def dispatch_notification(data: DispatchCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin,UserRole.support))) -> dict:
    recipient=db.get(User,data.user_id)
    if not recipient: raise HTTPException(404,"Recipient not found")
    db.add(Notification(user_id=recipient.id,title=data.title,body=data.body,channel=",".join(data.channels)));db.commit()
    return {"delivery":await deliver_notification(recipient,data.title,data.body,data.channels)}


@app.get("/v1/admin/risk-signals")
def list_risk_signals(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin,UserRole.support))) -> list[dict]:
    rows=db.scalars(select(RiskSignal).order_by(RiskSignal.created_at.desc()).limit(100)).all()
    return [{"id":row.id,"user_id":row.user_id,"job_id":row.job_id,"signal_type":row.signal_type,"severity":row.severity,"score":row.score,"details":row.details,"status":row.status,"created_at":row.created_at} for row in rows]


@app.get("/v1/admin/document-verifications")
def list_document_verifications(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin,UserRole.support))) -> list[dict]:
    rows=db.scalars(select(DocumentVerification).order_by(DocumentVerification.created_at.desc())).all()
    return [{"id":row.id,"application_id":row.application_id,"document_type":row.document_type,"status":row.status,"provider":row.provider,"confidence":row.confidence,"expires_at":row.expires_at,"notes":row.notes} for row in rows]


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
