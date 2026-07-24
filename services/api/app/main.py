from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .auth import create_access_token, get_current_user, hash_password, require_roles, verify_password
from .matching import score_match
from .models import ApplicationStatus, Artisan, ArtisanApplication, Job, JobEvent, JobStatus, PaymentStatus, PaymentTransaction, User, UserRole
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
