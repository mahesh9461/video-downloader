# Copilot Instructions for SaveIt Monorepo

In this repository, ALWAYS follow these rules when generating Jest test files, writing components, or completing code:

## 1. Jest & React Testing Rules (MANDATORY)

1. **Always use `@testing-library/react`** for all React tests.
2. **Always import `'@testing-library/jest-dom'`** at the top of test files.
3. **Always use the real Redux store configured with `configureStore`**.
4. **Never mock the Redux store, Redux hooks, or dispatch.** This includes `useSelector` and `useDispatch`.
5. **Every test file must include:**
   - a **render test**
   - a **user interaction test**
   - a **Redux state verification test**
6. **Always follow the AAA (Arrange → Act → Assert) structure.**
7. **Always wrap components with the real Redux `<Provider store={store}>`**.
8. **Always use `describe` blocks** for grouping tests.
9. **Prefer `screen.getByRole` and `screen.findByRole` over `getByTestId`**.
10. **When mocking functions, always use `jest.fn()` and clear mocks in `beforeEach`.** Make sure function names start with `mock...`.
11. **Ensure all mocks are imported/defined before the main component being tested.**

These rules override existing examples in the codebase. If existing tests use different patterns, IGNORE them and follow the rules above.

---

## 2. React 19 & Next.js 16 Standards
- **Vercel & Next.js Production Build Gate**: Always verify changes with `npm run build` to ensure 0 TypeScript compilation errors.
- **TypeScript & Schema Synchronization**: Keep `apps/api/app/schemas.py` and `apps/web/src/lib/types.ts` strictly synchronized. Maintain backward-compatible aliases for `ClipCandidate` (`id`/`clip_id`, `reasoning`/`reason`), `DownloadProgress` (`error`/`error_message`), and `VideoMetadata` (`view_count`).
- **ESLint Compliance**: Ensure all code passes `npm run lint` with 0 errors.
- **No setState in Effects**: Do not call `setState` synchronously within a `useEffect` to compute derived state. Compute derived values directly in the render body.
- **Escape Quotes in JSX**: Always escape quotes (`&quot;`, `&ldquo;`, `&rdquo;`, `&apos;`).
- **Tailwind CSS v4**: Use the zinc dark theme (`bg-zinc-950`, `bg-zinc-900`, `border-zinc-800`, `text-white`).

---

## 3. Python FastAPI Standards
- Validate all payloads with **Pydantic v2** models (`apps/api/app/schemas.py`).
- Maintain async-first execution for I/O endpoints.
- Subprocesses (`yt-dlp`, `ffmpeg`) must always specify timeouts and clean up intermediate media files in `downloads/`.
- Backend tests run with `npm run test:api` (Pytest).
