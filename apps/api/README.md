# ⚙️ SaveIt Backend API (`apps/api`)

Fast, asynchronous video extraction, watermark removal, and viral clipping service built with **FastAPI**, **yt-dlp**, and **FFmpeg**.

---

## 🚀 Key Capabilities
- **Universal Video Extraction**: YouTube (up to 4K 60FPS) and TikTok (watermark-free) via `yt-dlp`.
- **Live Download Progress**: Real-time Server-Sent Events (SSE) streaming download speed, percentage, and ETA.
- **Smart Watermark Removal**: Delogo filter engine with pre-tuned platform presets and custom bounding-box support.
- **AI Viral Shorts Generator**: Audio dialogue scoring, curiosity hook evaluation, kinetic progress bars, and 9:16 vertical cropping.
- **24/7 Autopilot Scheduler**: Autonomous video discovery, short generation, and direct publishing to YouTube Shorts.
- **Zero Host Dependencies**: Uses `static-ffmpeg` 7.0 embedded binaries; no system-level FFmpeg installation required.

---

## 🛠️ API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status and root greeting |
| `GET` | `/health` | Health check endpoint |
| `POST` | `/api/info` | Fetch video metadata (title, formats, thumbnail, duration) |
| `GET` | `/api/download` | SSE stream for video downloading and conversion |
| `GET` | `/api/serve/{filename}` | Download the completed video or audio file |
| `GET` | `/api/watermark/presets` | Get available platform delogo presets |
| `POST` | `/api/watermark/remove` | Upload video to remove watermarks |
| `POST` | `/api/clips/analyze` | Analyze video transcript and score viral clips |
| `POST` | `/api/clips/render` | Render a 9:16 vertical short with overlay |
| `GET` | `/api/autopilot/status` | Current status of the 24/7 autopilot worker |
| `POST` | `/api/autopilot/start` | Start the autonomous clip publisher |
| `POST` | `/api/autopilot/pause` | Pause the autonomous publisher |

Interactive OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.

---

## 🧪 Testing

```bash
# Run all backend tests
npm run test:api

# Or directly with pytest
cd apps/api && ./venv/bin/pytest tests/ -v
```
All 120+ Pytest tests run fully offline with zero external network dependencies.
