# 🎬 SaveIt — Production Video Downloader (YouTube & TikTok)

A clean, production-ready, dark-mode web application for downloading videos and extracting audio from **YouTube** (up to 4K 60FPS) and **TikTok** (100% watermark-free), built with **Next.js (App Router)** and **FastAPI** + **yt-dlp** + **FFmpeg**.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: Next.js (App Router, React 19, TypeScript), Tailwind CSS, Lucide icons, Shadcn UI primitives, Redux Toolkit for state verification.
- **Backend**: Python 3.9+ / 3.11 with FastAPI, `yt-dlp` Python SDK, `static-ffmpeg` (FFmpeg 7.0 embedded), asynchronous Server-Sent Events (SSE) streaming.
- **Task Management & Streaming**: Real-time download progress, ETA, transfer speed, and FFmpeg DASH merging stages streamed via SSE (`text/event-stream`).
- **Storage & Cleanup**: Automatic background cleanup service (files older than 10 minutes removed) and immediate delayed removal on download completion.
- **Rate Limiting**: In-memory sliding window rate limiter (max 5 downloads per minute per IP).

---

## 🚀 Quick Start

### 1. Backend (FastAPI)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run server on port 8000
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend (Next.js)
```bash
cd frontend
npm install

# Run dev server
npm run dev

# Or build and run production server
npm run build
npm start
```

### 3. Docker Compose (Full Stack)
```bash
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

---

## 🧪 Running Automated Tests

### Frontend (Jest + React Testing Library)
```bash
cd frontend
npm test
```
*15 test suites, 142 tests passed.* Strict compliance with AAA structure and Redux `<Provider>` store verification.

### Backend (Pytest)
```bash
cd backend
./venv/bin/pytest -v
```
*15 test suites passed (API endpoints, yt-dlp error mapping, rate limiting, SSE streaming, file serving, full E2E lifecycle).*

---

## 📂 Project Structure

```
video-downloader/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, CORS, rate limiter, file endpoints
│   │   ├── downloader.py        # yt-dlp wrapper, format parsing, SSE generator
│   │   ├── schemas.py           # Pydantic request/response models
│   │   └── config.py            # FFmpeg auto-detection, paths, cleanup constants
│   ├── tests/
│   │   ├── test_api.py          # API & middleware integration tests
│   │   ├── test_downloader.py   # Unit tests for formats & error mapping
│   │   └── test_live_e2e.py     # Full E2E lifecycle test
│   ├── downloads/               # Temporary downloads directory
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router (layout, page, SEO routes)
│   │   ├── components/          # UI primitives and feature components
│   │   ├── hooks/               # useDownload (SSE), useHistory (localStorage)
│   │   ├── lib/                 # api client, store, types, validators, utils
│   │   └── __tests__/           # Comprehensive test suite (142 tests)
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

