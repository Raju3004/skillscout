# SkillScout

AI recruitment intelligence — scores and ranks candidates from real GitHub
activity (not resume keywords), predicts offer-acceptance probability, and
explains every ranking. Recruiters can also upload resumes for the same role
and see a Resume Match score next to the Code-Verified score.

## Stack

- **Backend:** FastAPI + SQLAlchemy + JWT auth (`/backend`)
- **Frontend:** React + Vite + Tailwind v4 (`/frontend`)
- **DB:** SQLite locally by default; swap `DATABASE_URL` for Neon Postgres in production
- **Deploy:** Vercel (frontend) + Render (backend)

## Local development

### Backend

```bash
cd backend
python -m venv venv
./venv/Scripts/activate   # Windows
pip install -r requirements.txt
cp .env.example .env      # then fill in JWT_SECRET / GITHUB_TOKEN
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://127.0.0.1:8000`, so no CORS
config is needed locally.

## Deployment

- **Database:** create a Neon Postgres project, copy the connection string
  into `DATABASE_URL` (backend env). No schema migration needed — tables are
  created automatically on startup.
- **Backend (Render):** connect this repo, Render will read `render.yaml`
  from the repo root. Set `DATABASE_URL`, `GITHUB_TOKEN`, and `CORS_ORIGINS`
  (your Vercel URL) in the Render dashboard.
- **Frontend (Vercel):** import this repo, set the project root to
  `frontend`, and set `VITE_API_URL` to `https://<your-render-app>.onrender.com/api`.

## Status

See section 7 of the SRS for the full backlog. Build proceeds in strict
priority order; each numbered step is committed once fully working.
## lalalalala
