# 🤖 AGENTS.md — AI Agent Guidelines & Repository Quality Standards

> **Note for AI Agents**: This document is the primary authority for repository conventions, architectural patterns, code quality rules, and testing standards. Whether you are **Antigravity**, **Cursor**, **GitHub Copilot**, **Claude Code**, or another coding agent, you **MUST** strictly follow the directives outlined here.

---

## 1. Monorepo Architecture Overview

SaveIt is a production-grade native monorepo for high-performance video downloading, viral Shorts extraction, and watermark removal:

```
video-downloader/
├── apps/
│   ├── web/                    # Next.js 16 (App Router, React 19, TypeScript, Tailwind v4, Redux Toolkit)
│   └── api/                    # FastAPI (Python 3.11+, yt-dlp, static-ffmpeg 7.0, async SSE)
├── scripts/                    # Unified monorepo shell runners (setup, dev, test, build)
├── package.json                # Monorepo workspace configuration
├── STANDARDS.md                # Engineering standards & code quality specification
├── AGENTS.md                   # Universal AI agent instructions (this document)
└── .github/copilot-instructions.md # GitHub Copilot specific instructions
```

---

## 2. Core Quality & Linting Rules

### 2.1 Zero-Error ESLint Standard
- **Always verify changes** with `npm run lint` before completing any task.
- The ESLint configuration (`apps/web/eslint.config.mjs`) uses ESLint v9 Flat Config.
- **TypeScript strictness**:
  - Avoid using `any`. Use proper interfaces, generics, or `unknown` with type narrowing.
  - Prefix unused variables or arguments with `_` (e.g., `_event`, `_setPlatform`).
- **React 19 & Next.js 16 standards**:
  - **Do NOT call `setState` synchronously within a `useEffect`** to compute derived state. Compute derived values directly in the render body.
  - **Do NOT use `useEffect` to synchronize props to state** when a calculated constant or memoized value suffices.
  - Always escape HTML entities in JSX (use `&quot;`, `&ldquo;`, `&rdquo;`, `&apos;`).
  - Use Next.js `<Image />` where appropriate; if `<img>` is intentionally used for dynamic external media, ensure proper dimensioning and `alt` tags.

### 2.2 Backend Python Quality Standards
- Validate all incoming request payloads with **Pydantic v2** models (`apps/api/app/schemas.py`).
- Maintain async-first execution for I/O operations (`httpx.AsyncClient`, `asyncpg`, SSE streaming).
- When executing subprocesses (`yt-dlp`, `ffmpeg`):
  - Always enforce execution timeouts to prevent orphaned zombie processes.
  - Always clean up temporary files in `apps/api/downloads/` and `apps/api/data/` using `try...finally` blocks.
  - Never trust un-sanitized user input in shell parameters; use argument arrays (`exec` style) rather than `shell=True`.

### 2.3 Vercel & Next.js Production Build Gate (MANDATORY)
- **Always verify changes with `npm run build`** (which executes Next.js production webpack compile and comprehensive TypeScript checking across all pages, components, and tests). Never rely solely on linting.
- **TypeScript & Schema Synchronization**:
  - Whenever FastAPI Pydantic models in `apps/api/app/schemas.py` are modified, **immediately synchronize** `apps/web/src/lib/types.ts`.
  - Maintain backward-compatible aliases for candidate and progress types:
    - `ClipCandidate`: support `clip_id` & `id`, `summary` & `transcript_snippet`, `reason` & `reasoning`.
    - `DownloadProgress`: support `error_message` & `error`.
    - `VideoMetadata`: ensure `view_count` is included.
- **Strict Null & Undefined Prop Guards**:
  - Guard optional props expecting `string | undefined` with safe type-narrowing (`val || undefined`) or allow `string | null | undefined` in component interfaces.
- **Notification Function Standard**:
  - Never call non-existent global toast functions like `showToast(...)`. Always import and use `useToast()` from `@/hooks/use-toast`.
- **Redux Slice Alignment in Tests**:
  - Slices in `createTestStore()` are `video` and `auth`. Never assert against non-existent slices (e.g. `download` or `ui`).

---

## 3. Strict Testing Standards (MANDATORY)

When creating, editing, or completing test files, **ALWAYS** follow these non-negotiable rules:

### 3.1 Frontend React & Jest Test Rules
1. **Always use `@testing-library/react`** for all React tests.
2. **Always import `'@testing-library/jest-dom'`** at the top of test files.
3. **Always use the real Redux store** configured with `configureStore` (from `@/lib/store` or custom slice setup).
4. **Never mock the Redux store, Redux hooks, or dispatch.** This includes `useSelector` and `useDispatch`.
5. **Every test file must include:**
   - A **render test** (verifying component renders properly).
   - A **user interaction test** (verifying user clicks, inputs, or triggers via `@testing-library/user-event` or `fireEvent`).
   - A **Redux state verification test** (verifying that the real Redux store state matches expected values).
6. **Always follow the AAA (Arrange → Act → Assert) structure.**
7. **Always wrap components with the real Redux `<Provider store={store}>`**.
8. **Always use `describe` blocks** for grouping tests logically (e.g., `describe("ComponentName", () => { describe("render", ...); describe("user interaction", ...); describe("state verification", ...); })`).
9. **Prefer `screen.getByRole` and `screen.findByRole` over `getByTestId`.** Use semantic queries (`getByRole('button', { name: /.../i })`, `getByRole('heading')`, `getByPlaceholderText`, etc.).
10. **When mocking functions, always use `jest.fn()` and clear mocks in `beforeEach`.** Ensure mock function names start with `mock...` (e.g., `mockFetchMetadata`, `mockDownloadWithProgress`).
11. **Ensure all mocks and mock setup are imported/declared BEFORE the main component being tested.**

> [!IMPORTANT]
> These testing rules override existing examples in the codebase. If legacy tests use different patterns, **IGNORE** them and adhere strictly to the 11 rules above.

### 3.2 Backend Pytest Rules
- Use `pytest` with `anyio` / `pytest-asyncio` for asynchronous FastAPI endpoints.
- Group tests logically with `Test...` classes or descriptive module names.
- Mock network and YouTube/TikTok external API calls during unit tests so that test suites run 100% offline and reliably.
- Verify status codes, JSON schema response structures, and proper error handling.

---

## 4. Common Commands Reference

Run all commands from the repository root:

| Command | Purpose |
|---|---|
| `npm run setup` | Initial monorepo environment setup (node_modules + Python venv) |
| `npm run dev` | Start both Next.js (`:3000`) and FastAPI (`:8000`) concurrently |
| `npm run dev:web` | Start Next.js development server only |
| `npm run dev:api` | Start FastAPI backend server only |
| `npm run lint` | Run ESLint across `apps/web` (must exit with 0 errors) |
| `npm test` | Run frontend Jest test suites (all 19 suites, 170+ tests) |
| `npm run test:api` | Run backend Pytest suites (all 120+ tests) |
| `npm run build` | Build Next.js production bundle |
| `npm run build:api` | Prepare backend for deployment (download static ffmpeg) |

---

## 5. Rules of Engagement for Agents

1. **Test & Build Gate (Non-Negotiable)**: Run `npm run build`, `npm test`, `npm run test:api`, and `npm run lint` before concluding any task. All four must pass with zero errors.
2. **Never Break Linting**: Ensure `npm run lint` exits cleanly with zero errors before concluding your task.
3. **Preserve User Intent**: When refactoring or fixing bugs, maintain existing functionality, design aesthetics (Tailwind dark theme), and API contracts.
4. **No Premature Deletions**: Do not delete existing features, tests, or configurations unless explicitly instructed by the user.
