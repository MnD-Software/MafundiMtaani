# Mafundi Mtaani

Nairobi-first marketplace for clients, verified artisans, estate teams and marketplace operators.

## Applications

- `apps/web`: Next.js 15 application for Vercel.
- `services/api`: FastAPI service for Render.
- PostgreSQL is used in production. SQLite is supported only for local development.

No users, artisans, jobs, reviews, applications or financial records are created automatically.

## Local development

```powershell
python -m pip install -r services/api/requirements.txt
python -m uvicorn app.main:app --reload --app-dir services/api --port 8010
npm.cmd --prefix apps/web ci
npm.cmd --prefix apps/web run dev
```

Copy the `.env.example` files and configure a strong JWT secret.

## RBAC

- `client`: create and view only their own jobs.
- `artisan`: submit one verification application and see eligible marketplace jobs.
- `estate_manager`: create and view their organisation’s jobs.
- `support`: read operational queues and metrics but cannot approve.
- `admin`: approve or reject applications and access marketplace operations.

FastAPI enforces every protected permission. Next.js middleware hides and redirects role-incompatible workspaces.

## First administrator

Production startup never seeds an admin. Create one explicitly:

```powershell
$env:MAFUNDI_ADMIN_EMAIL="admin@example.com"
$env:MAFUNDI_ADMIN_PASSWORD="use-a-long-random-password"
$env:MAFUNDI_DATABASE_URL="postgresql+psycopg://..."
python scripts/create_admin.py
```

## Deployment

### Render

Create the services from `render.yaml`. Set `MAFUNDI_CORS_ORIGINS` to a JSON array containing the Vercel domain.

### Vercel

Import the repository and use the root configuration in `vercel.json`. Set:

```text
API_URL=https://your-render-api.onrender.com
```

## Verification

```powershell
python -m pytest services/api/test_api.py -q
npm.cmd --prefix apps/web run build
./scripts/sanity-check.ps1 -WebBase http://127.0.0.1:3000 -ApiBase http://127.0.0.1:8010
```
