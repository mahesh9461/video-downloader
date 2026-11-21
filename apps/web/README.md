# 🎬 SaveIt Web Application (`apps/web`)

Modern, high-performance web interface for the SaveIt video downloader, viral shorts engine, and watermark remover.

---

## 🛠️ Tech Stack
- **Framework:** Next.js 16 (App Router)
- **UI Runtime:** React 19
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4 + Radix UI primitives
- **Icons:** Lucide React
- **State Management:** Redux Toolkit 2 + React-Redux 9
- **Testing:** Jest 30 + React Testing Library + jest-dom
- **Linting:** ESLint 9 (Flat Config)

---

## 📂 Source Structure

```
apps/web/src/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Global Root Layout (Fonts, Metadata)
│   ├── page.tsx              # Main Dashboard (Tabs for Downloader, Watermark, Viral Clips, Autopilot)
│   └── api/                  # Route handlers (Proxy & OAuth callback)
├── components/               # React components
│   ├── ui/                   # Reusable primitive UI elements (Button, Card, Input, Progress, etc.)
│   ├── header.tsx            # Navigation & status bar
│   ├── url-input.tsx         # Smart URL input with platform detection
│   ├── video-preview.tsx     # Rich video metadata preview
│   ├── download-options.tsx  # Format selector (4K, 1080p, MP3)
│   ├── progress-bar.tsx      # Real-time SSE download progress
│   ├── watermark-remover.tsx # TikTok/logo removal interface
│   ├── viral-clips.tsx       # AI viral shorts analyzer & renderer
│   ├── autopilot-dashboard.tsx # 24/7 autonomous shorts batch publisher
│   └── history-drawer.tsx    # Download history with replay
├── hooks/                    # Custom React hooks
│   ├── use-download.ts       # SSE download controller
│   └── use-history.ts        # Persisted download history
├── lib/                      # Utilities & core logic
│   ├── api.ts                # Backend API client
│   ├── store.ts              # Redux Toolkit store & slices
│   ├── types.ts              # TypeScript interfaces & types
│   ├── validators.ts         # URL detection & validation
│   └── utils.ts              # Formatting helpers
└── __tests__/                # 19 Jest test suites (170+ tests)
```

---

## 🧪 Testing Guidelines

Run tests with:
```bash
npm test -w web
```

All test files follow the repository's strict standard:
- Import `@testing-library/jest-dom` and use `@testing-library/react`.
- Real Redux store configured via `configureStore`.
- Strict AAA (Arrange → Act → Assert) pattern.
- Every test suite contains: render test, user interaction test, and Redux state verification test.

---

## 🎨 Linting & Code Quality

Run ESLint with:
```bash
npm run lint -w web
```

Configured with ESLint 9 Flat Config (`eslint.config.mjs`) ensuring zero warnings/errors on builds.
