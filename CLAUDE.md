# CLAUDE.md — Instructions for Claude Code & Anthropic Agents

## Project Overview
SaveIt is a production-ready video downloader and viral short creator native monorepo:
- **Frontend (`apps/web`)**: Next.js 16 (App Router, React 19), TypeScript, Tailwind CSS v4, Redux Toolkit, Lucide icons, Jest.
- **Backend (`apps/api`)**: Python 3.11+, FastAPI, `yt-dlp`, `static-ffmpeg` (FFmpeg 7.0), Server-Sent Events (SSE), Pytest.

---

## Essential Commands

```bash
# Setup
npm run setup          # Install npm deps & setup Python venv

# Development
npm run dev            # Run Next.js (:3000) & FastAPI (:8000) concurrently
npm run dev:web        # Run Next.js frontend only
npm run dev:api        # Run FastAPI backend only

# Quality & Testing
npm run lint           # Run ESLint (apps/web) — MUST have 0 errors
npm test               # Run all frontend Jest test suites
npm run test:web       # Same as npm test
npm run test:api       # Run all backend Pytest suites
npm run build          # Build Next.js production bundle
```

---

## Non-Negotiable Test Rules (Frontend)
1. Always use `@testing-library/react` and import `'@testing-library/jest-dom'`.
2. Always use the real Redux store configured with `configureStore`.
3. Never mock the Redux store, Redux hooks (`useSelector`, `useDispatch`), or `dispatch`.
4. Every test file must include:
   - a render test
   - a user interaction test
   - a Redux state verification test
5. Always follow AAA (Arrange → Act → Assert) pattern.
6. Always wrap components with `<Provider store={store}>`.
7. Prefer `screen.getByRole` / `screen.findByRole` over `getByTestId`.
8. When mocking functions, use `jest.fn()` with names starting with `mock...` and clear in `beforeEach`.
9. Ensure mocks are defined before importing the component under test.

---

## Code Quality Rules
- Zero ESLint errors allowed (`npm run lint`).
- In React 19 / Next.js 16, do NOT call `setState` synchronously within a `useEffect` for derived values.
- In JSX, escape double quotes using `&quot;` or `&ldquo;` / `&rdquo;`.
- Validate all backend API inputs using Pydantic schemas. Clean up generated media files in `downloads/`.
