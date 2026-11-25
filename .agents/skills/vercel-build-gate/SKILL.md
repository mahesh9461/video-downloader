---
name: vercel-build-gate
description: Mandatory pre-deployment checklist, TypeScript strictness verification, and build gate runner (npm run build, npm run lint, npm test, npm run test:api) to guarantee zero Vercel deployment failures and complete schema alignment.
---

# 🚀 Vercel Build Gate & TypeScript Zero-Failure Standard

This skill is the authoritative guide for ensuring that every change in the `video-downloader` monorepo (`apps/web` and `apps/api`) compiles cleanly without breaking Vercel deployments, Next.js build pipelines, or TypeScript strict mode checks.

---

## 1. Mandatory Pre-Completion Build Gate

Before marking ANY task complete or submitting code, **ALWAYS** run the unified verification chain:

```bash
npm run build && npm test && npm run test:api && npm run lint
```

| Verification Check | Command | Passing Standard |
|---|---|---|
| **Next.js Production Build** | `npm run build` | Compiles all static/dynamic routes + zero TypeScript errors |
| **Frontend Jest Tests** | `npm test` | All 24+ test suites passed (209+ tests) |
| **Backend Pytest** | `npm run test:api` | All 155+ tests passed |
| **ESLint Quality Standard** | `npm run lint` | Exits with **0 errors** |

---

## 2. Common Vercel & TypeScript Failure Patterns & Rules

### 2.1 Backend-Frontend Schema Synchronization
- Whenever a field is added to FastAPI Pydantic models in `apps/api/app/schemas.py`, **immediately synchronize** `apps/web/src/lib/types.ts`.
- Maintain backward-compatible aliases for candidate and progress types:
  - **`ClipCandidate`**:
    - `clip_id: string;` and `id?: string;`
    - `summary: string;` and `transcript_snippet?: string | null;`
    - `reason: string;` and `reasoning?: string | null;`
    - Breakdown metrics: `hook_score`, `pacing_score`, `audio_energy_score`, `visual_motion_score`, `loop_rating`, `speaker_tracking_applied`.
  - **`DownloadProgress`**:
    - `error_message: string | null;` and `error?: string | null;`
  - **`VideoMetadata`**:
    - Include `view_count?: number | null;` alongside `downloads_available?: boolean;` and `notice?: string | null;`.

### 2.2 Strict Null & Undefined Prop Guards
- If a component prop expects `string | undefined` (such as `thumbnailUrl`, `videoUrl`, `channelThumbnail`):
  - Either define the interface to accept `string | null | undefined`:
    ```typescript
    export interface ShortPreviewCardProps {
      channelThumbnail?: string | null;
      thumbnailUrl?: string | null;
      videoUrl?: string | null;
    }
    ```
  - Or safely narrow the value at call site:
    ```tsx
    channelThumbnail={activeChannel?.thumbnail_url || undefined}
    ```

### 2.3 Toast & Notification Functions
- In `apps/web/src/components/`, **never invoke undefined global functions** like `showToast(...)`.
- Always use the hook:
  ```typescript
  import { useToast } from "@/hooks/use-toast";
  const { success, error: toastError, info } = useToast();
  // Usage:
  success("Operation successful!");
  toastError("Operation failed.");
  ```

### 2.4 Redux Store State Verification in Tests
- In all React test files following Repository Rule 5 (`Redux state verification test`):
  - `createTestStore()` in `@/lib/store` registers slices: `video` and `auth`.
  - Always check:
    ```typescript
    const currentReduxState = store.getState();
    expect(currentReduxState.video).toEqual(initialReduxState.video);
    expect(currentReduxState.auth).toEqual(initialReduxState.auth);
    ```
  - Do NOT test for non-existent slices (such as `download` or `ui`).

---

## 3. Quick Troubleshooting Runbook

If `npm run build` fails:
1. Run `npm run build` to inspect the exact TypeScript error message and line number:
   ```bash
   npm run build
   ```
2. Locate the offending file, inspect both the source component and `apps/web/src/lib/types.ts`.
3. Add the missing property or apply safe type-narrowing.
4. Verify with `npm run build` until it exits with code 0.
