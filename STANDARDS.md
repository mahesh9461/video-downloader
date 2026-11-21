# 📐 STANDARDS.md — Code Quality, Architecture & Testing Standards

This document defines the engineering standards, architecture principles, and quality requirements for the **SaveIt** monorepo.

---

## 1. Monorepo Principles & Structure

1. **Independent Execution**:
   - `apps/web` can be built and tested independently using `npm -w web`.
   - `apps/api` can be run and tested independently using `pytest` within its virtual environment.
2. **Shared Scripts**:
   - Monorepo orchestration scripts reside in `./scripts/` and are invoked from root `package.json`.
3. **Consistent Tooling**:
   - Web: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Redux Toolkit 2, Jest 30, ESLint 9.
   - API: Python 3.9+, FastAPI, Pydantic v2, yt-dlp, static-ffmpeg 7.0, pytest 8.

---

## 2. Frontend Standards (`apps/web`)

### 2.1 React 19 & Next.js 16 Conventions
- **App Router**:
  - Keep client-side state in Client Components (`"use client"`).
  - Use Server Components where dynamic interactivity is not required.
- **State Management**:
  - Global application state (download queue, active download, theme, UI drawers) resides in Redux Toolkit (`src/lib/store.ts`).
  - Local state (`useState`) is reserved for ephemeral UI elements (dropdown open state, text inputs).
  - **Derived State**: Compute values directly during render. Never use `useEffect` to copy props into state or derive state that can be calculated synchronously.
- **Effects & Lifecycle**:
  - Keep effects minimal and focused on external synchronization (DOM subscriptions, event listeners, SSE streams).
  - Avoid calling `setState` synchronously within the body of an effect.

### 2.2 TypeScript Standards
- **Strict Typing**: All components, functions, hooks, and API responses must have explicit TypeScript types.
- **No Uncontrolled `any`**:
  - Use `unknown` with type guards or interfaces/types defined in `src/lib/types.ts`.
  - When catching errors: `catch (err: unknown)` and inspect with `err instanceof Error` or type assertions.
- **Unused Variables**:
  - Remove unused imports and variables.
  - Prefix unavoidable unused parameters with `_` (e.g., `_event`).

### 2.3 Styling & UI (Tailwind CSS v4 & Radix UI)
- **Theme**: Dark-first UI using zinc palette (`bg-zinc-950`, `bg-zinc-900`, `border-zinc-800`, `text-white`, `text-zinc-400`).
- **Accents**: Violet / purple gradients and highlights (`from-violet-600 to-indigo-600`, `text-violet-400`).
- **Responsiveness**: Mobile-first design (`flex flex-col sm:flex-row`, `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
- **Accessibility**: Use semantic HTML elements (`<button>`, `<main>`, `<header>`, `<nav>`) and proper ARIA attributes (`aria-label`, `role`).

---

## 3. Frontend Testing Standards (Jest & Testing Library)

All React component and hook tests **MUST** adhere to these strict requirements:

1. **Framework**: `@testing-library/react` and `@testing-library/jest-dom`.
2. **Real Redux Store**:
   - Always configure and provide a real Redux store with `configureStore`.
   - Never mock `useSelector`, `useDispatch`, or `store.dispatch`.
   - Wrap components using:
     ```tsx
     const store = configureStore({ reducer: rootReducer });
     render(
       <Provider store={store}>
         <ComponentUnderTest />
       </Provider>
     );
     ```
3. **Mandatory Test Triad**: Every test file must contain at least:
   - A **render test** confirming structure, key headings, buttons, and initial layout.
   - A **user interaction test** simulating user actions (clicks, inputs, submissions).
   - A **Redux state verification test** asserting that store state updates accurately.
4. **Pattern**: Structure tests with Arrange → Act → Assert (AAA).
5. **Queries**: Prefer accessible roles (`screen.getByRole`, `screen.findByRole`) over `getByTestId`.
6. **Mocks**:
   - Use `jest.fn()` for mock handlers.
   - Clear all mocks in `beforeEach(() => { jest.clearAllMocks(); })`.
   - Prefix mock function names with `mock...` (e.g., `mockFetch`, `mockOnSubmit`).
   - Import and define mocks **before** importing the component under test.

---

## 4. Backend Standards (`apps/api`)

### 4.1 FastAPI Architecture
- **Routers & Endpoints**: Group endpoints logically in `main.py` with descriptive tags.
- **Data Validation**: Strict Pydantic v2 schemas for all request bodies and responses in `app/schemas.py`.
- **CORS & Security**: Strict CORS policies for frontend domains; rate limiting with `slowapi`.

### 4.2 Subprocess & Media Processing
- **yt-dlp**: Run extraction in non-blocking worker threads or asynchronous subprocesses.
- **FFmpeg**:
  - Always utilize `static-ffmpeg` embedded binaries to ensure reproducible behavior across macOS and Linux.
  - Always set execution timeouts on video rendering and delogo operations.
  - Automatically prune temporary files and intermediate clips in `downloads/`.

### 4.3 Backend Testing (Pytest)
- Execute with `npm run test:api` or `pytest` within `apps/api/venv`.
- Fast, deterministic tests: mock external YouTube/TikTok requests to ensure 100% offline test execution.
- Maintain test coverage across rate-limiting, error responses, SSE streams, delogo filters, and autopilot routines.

---

## 5. Pre-Commit Quality Gate Checklist

Before submitting code, verify:
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm test` passes (all 19 Jest test suites pass).
- [ ] `npm run test:api` passes (all 120+ Pytest tests pass).
- [ ] No temporary files or secrets committed.
