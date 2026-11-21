# ⚙️ SaveIt API Agent Guidelines (`apps/api`)

## 1. Overview
The backend is an asynchronous **FastAPI** service powering video extraction, audio conversion, watermark deletion, and AI-driven viral clipping.

---

## 2. Core Architecture

```
apps/api/
├── app/
│   ├── main.py              # FastAPI app, endpoints, CORS, rate limiting
│   ├── downloader.py        # yt-dlp wrapper with SSE progress stream
│   ├── autopilot.py         # 24/7 background worker for auto-generation & publishing
│   ├── watermark.py         # FFmpeg delogo filter engine & preset definitions
│   ├── clip_scorer.py       # Hook evaluation & NLP pacing analysis
│   ├── clip_renderer.py     # FFmpeg 9:16 vertical video crop & headline overlay
│   ├── cover_generator.py   # High-CTR cover generation
│   ├── youtube_publisher.py # YouTube Data API v3 client
│   ├── schemas.py           # Pydantic v2 models
│   ├── cache.py             # In-memory TTL/LRU caching
│   ├── config.py            # Static-ffmpeg paths and storage configs
│   └── supabase_client.py   # Database client for multi-tenant analytics
├── tests/                   # Pytest test suites (120+ tests)
└── requirements.txt         # Pinned backend dependencies
```

---

## 3. Backend Quality Standards

### 3.1 Pydantic v2 Validation
- All request payloads and response bodies **MUST** use explicit Pydantic models in `app/schemas.py`.
- Reject invalid URLs, negative durations, or unsupported file formats with clear `HTTPException(400, detail=...)`.

### 3.2 Subprocess Safety & Resource Management
- **Never invoke raw shell commands with string interpolation**. Always use array arguments with `subprocess.Popen` or `asyncio.create_subprocess_exec`.
- **Always specify timeouts** for media rendering and download subprocesses to prevent zombie processes.
- **Temporary File Lifecycle**: Always clean up created files in `downloads/` and `data/` using `try...finally` blocks.

### 3.3 Asynchronous Execution
- Use `sse-starlette` `EventSourceResponse` for streaming real-time progress to clients.
- Run CPU-bound extraction or transcoding tasks in threadpools or detached background tasks.

---

## 4. Pytest Execution
- Run tests via the monorepo runner: `npm run test:api` or directly:
  ```bash
  cd apps/api && ./venv/bin/pytest tests/
  ```
- All tests must pass with 0 errors. Mock network and YouTube/TikTok requests to ensure offline reproducibility.
