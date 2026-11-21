# 🎬 SaveIt — Production Video Downloader (Monorepo)

A clean, production-ready, dark-mode web application for downloading videos and extracting audio from **YouTube** (up to 4K 60FPS) and **TikTok** (100% watermark-free), built as a **Native Monorepo** with **Next.js 16 (App Router)** and **FastAPI** + **yt-dlp** + **FFmpeg**.

---

## 🛠️ Monorepo Architecture

- **`apps/web`**: Next.js 16 (App Router, React 19, TypeScript), Tailwind CSS v4, Lucide icons, Radix UI primitives.
- **`apps/api`**: Python 3.9+ / 3.11 / 3.14 with FastAPI, `yt-dlp` SDK, `static-ffmpeg` (FFmpeg 7.0 embedded), asynchronous Server-Sent Events (SSE).
- **No Docker Required**: Runs natively on macOS/Linux with zero VM overhead, instant hot-reloading, and low memory usage.

---

## 🚀 Quick Start (One Command)

### 1. First-time Setup
Run the setup script from the project root to install web dependencies and create the Python virtual environment:

```bash
npm run setup
```

### 2. Start Both Web & API
Run both the Next.js frontend (`http://localhost:3000`) and the FastAPI backend (`http://localhost:8000`) concurrently with a single command:

```bash
npm run dev
```

- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive API Docs (Swagger):** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🧪 Running Automated Tests & Code Quality

```bash
# Check code quality and linting across the monorepo (0 errors required)
npm run lint

# Run all tests (frontend Jest test suites)
npm test

# Run frontend Jest tests only (19 suites, 170+ tests)
npm run test:web

# Run backend Pytest suites only (120+ tests)
npm run test:api
```

---

## 📖 Standards & Agent Instructions

This repository enforces strict engineering and automated testing standards:
- **[AGENTS.md](file:///Users/mahesh/Desktop/Test/video-downloader/AGENTS.md)**: Universal instructions for AI agents (Antigravity, Cursor, Copilot, Claude).
- **[STANDARDS.md](file:///Users/mahesh/Desktop/Test/video-downloader/STANDARDS.md)**: Engineering standards, architecture principles, and pre-commit checklist.
- **[.github/copilot-instructions.md](file:///Users/mahesh/Desktop/Test/video-downloader/.github/copilot-instructions.md)**: Dedicated instructions for GitHub Copilot.
- **[CLAUDE.md](file:///Users/mahesh/Desktop/Test/video-downloader/CLAUDE.md)**: Reference guide for Claude Code.
- **[.cursorrules](file:///Users/mahesh/Desktop/Test/video-downloader/.cursorrules)**: Rules for Cursor IDE.

---

## 📂 Monorepo Structure

```
video-downloader/
├── package.json               # Root monorepo workspace scripts
├── scripts/
│   ├── setup.sh               # Auto-setup for python venv & node_modules
│   ├── dev.sh                 # Concurrent dev server runner
│   ├── dev-api.sh             # Dedicated backend runner
│   └── test-api.sh            # Dedicated Pytest runner
├── apps/
│   ├── web/                   # Next.js 16 Frontend
│   │   ├── src/
│   │   │   ├── app/           # App Router (pages & proxy)
│   │   │   ├── components/    # UI & download components
│   │   │   ├── hooks/         # useDownload & useHistory
│   │   │   ├── lib/           # API client & validators
│   │   │   └── __tests__/     # 15 Jest test suites (145 tests)
│   │   └── package.json
│   └── api/                   # FastAPI Backend
│       ├── app/
│       │   ├── main.py        # Endpoints, CORS, rate limiting
│       │   ├── downloader.py  # yt-dlp wrapper, SSE stream
│       │   ├── schemas.py     # Pydantic models
│       │   └── config.py      # FFmpeg & storage config
│       ├── tests/             # Pytest test suites
│       ├── downloads/         # Auto-pruned temp storage
│       └── requirements.txt
└── README.md
```
