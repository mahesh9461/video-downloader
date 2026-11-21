<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 🌐 SaveIt Web Application Agent Guidelines (`apps/web`)

## 1. Overview
The web application is built with **Next.js 16 (App Router)**, **React 19**, **TypeScript 5**, **Tailwind CSS v4**, **Redux Toolkit 2**, and **Jest 30 + React Testing Library**.

---

## 2. Strict Frontend Testing Rules (MANDATORY)

When modifying or generating test files in `apps/web/src/__tests__/`:

1. **Always use `@testing-library/react`** for all React tests.
2. **Always import `'@testing-library/jest-dom'`** at the top of every test file.
3. **Always use the real Redux store configured with `configureStore`**.
4. **Never mock the Redux store, Redux hooks, or dispatch.** This includes `useSelector` and `useDispatch`.
5. **Every test file must include:**
   - a **render test** (verifies DOM output, accessibility roles, headings, buttons)
   - a **user interaction test** (verifies click, type, selection events)
   - a **Redux state verification test** (verifies that state transitions in the real store occur as expected)
6. **Always follow the AAA (Arrange → Act → Assert) structure.**
7. **Always wrap components with the real Redux `<Provider store={store}>`**.
8. **Always use `describe` blocks** for grouping tests logically.
9. **Prefer `screen.getByRole` and `screen.findByRole` over `getByTestId`**.
10. **When mocking functions, always use `jest.fn()` and clear mocks in `beforeEach`.** Make sure function names start with `mock...`.
11. **Ensure all mocks are imported/defined before the main component being tested.**

---

## 3. Component Architecture & Conventions

### 3.1 React 19 & Next.js 16 App Router
- Use `"use client"` directive on all components that manage client interactivity, hooks, or browser events.
- **Do NOT call `setState` synchronously within a `useEffect`** to derive state. Calculate derived state synchronously in the component render body.
- When loading initial data from browser storage (`localStorage`), prefer lazy initializers in `useState(() => ...)` or hydration-safe guards.
- Always escape quotes in JSX: use `&quot;`, `&ldquo;`, `&rdquo;`, or `&apos;`.

### 3.2 Redux Store (`src/lib/store.ts`)
- Use the central Redux Toolkit slice for global application state:
  - Download state (`isDownloading`, `progress`, `activeUrl`, `activeFormat`).
  - History state (`items`, `lastUpdated`).
  - Autopilot state (`isRunning`, `currentBatch`, `logs`).
- Dispatch strongly-typed action creators.

### 3.3 Styling (Tailwind CSS v4)
- Maintain dark-mode zinc aesthetic: `bg-zinc-950`, `bg-zinc-900/60`, `border-zinc-800`, `text-white`, `text-zinc-400`.
- Use violet/purple accents: `bg-violet-600`, `text-violet-400`, `hover:border-violet-500/50`.
- All interactive elements must support keyboard focus (`focus:outline-none focus:ring-2 focus:ring-violet-500`).

---

## 4. Quality & Linting Gate
- Run `npm run lint -w web` to ensure 0 errors.
- Run `npm test -w web` to ensure all 170+ Jest tests pass.
