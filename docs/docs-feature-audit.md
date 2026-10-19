# Audit: adding collaborative documents (PLAN2 Phase 0)

Written 2026-10-19, before any code changes for the documents feature. Temporary: Phase 9.7 deletes this file or moves its useful parts into `docs/decisions.md`.

## 1. Stack actually installed

| Piece | Version | Where |
|-------|---------|-------|
| Next.js (App Router, Cache Components, `proxy.ts`) | 16.4.2 | `apps/web` |
| React | 19.3.0 | `apps/web` |
| yjs | ^13.6.33 | `apps/web`, `apps/sync` |
| @hocuspocus/server + extension-database + extension-logger | 4.7.1 | `apps/sync` |
| @hocuspocus/provider | 4.7.1 | `apps/web` |
| y-indexeddb | ^9.0.12 | `apps/web` |
| Prisma (with `@prisma/adapter-pg`, Neon Postgres) | 7.10.1 | `packages/db` |
| better-auth | 1.7.10 | `apps/web` |
| zod / jose / nanoid | 4.6 / 6.2 / 6.0 | both apps |
| UI: Tailwind 4, shadcn (on `@base-ui/react`), lucide-react, sonner, zustand | | `apps/web` |
| Tests: vitest 5.0.5 (unit), Playwright 1.64 (e2e, local only) | | root + `apps/web` |
| Tiptap (to add) | latest is **3.32.0**; Collaboration needs peer `@tiptap/y-tiptap` ^3.0.7 | |

Monorepo: pnpm workspaces. `apps/web` (Next.js), `apps/sync` (Hocuspocus, Node 24, runs TS directly), `packages/db` (Prisma schema + client), `packages/shared` (zod schemas, ws-token claims).

**Sync technology check (task 0.2): confirmed Yjs + Hocuspocus.** The plan fits as written.

## 2. Where each reusable piece lives

| Piece | File | Notes for documents |
|-------|------|---------------------|
| Provider + IndexedDB setup | `apps/web/lib/yjs/provider.ts` → `connectBoard(boardId, doc)` | Works for any room id. Rename to `connectItem`. |
| Logout clears IndexedDB | same file → `clearLocalBoards()`, prefix `whiteboard-board-` | Keep the prefix for documents too (ids are unique across kinds), so one function clears both. |
| Connection status / loaded / saving | `apps/web/lib/yjs/hooks.ts` → `useConnectionStatus(provider, local)` | Reusable as is. `loaded` already means "IndexedDB **or** server loaded". |
| WebSocket token route | `apps/web/app/api/ws-token/route.ts` (`?boardId=`) | Only depends on the access check. The claim stays named `boardId` (it holds the item id). |
| Sync server auth hook | `apps/sync/src/auth.ts` | Checks origin, JWT, `claims.boardId === documentName`, and sets read-only for viewers. **No kind check, so it works for documents unchanged.** |
| Persistence hook | `apps/sync/src/persistence.ts` | Loads and stores `Board.state` by id. Kind-agnostic. `updatedAt` is updated automatically. |
| Access check | `apps/web/lib/access.ts` → `getBoardRole(userId, boardId)` | Kind-agnostic already. Rename to `getItemRole`. |
| Share links (actions) | `apps/web/app/actions/share.ts` | Kind-agnostic. |
| Share dialog | `apps/web/components/board/ShareDialog.tsx` | Board wording is hard-coded. Add a `kind` prop. |
| Join page | `apps/web/app/join/[token]/page.tsx` | Always redirects to `/board/…`. Must redirect by kind. |
| Versions (actions) | `apps/web/app/actions/versions.ts` | Kind-agnostic (stores the full Y.Doc). Wording says "board". |
| History dialog | `apps/web/components/board/HistoryDialog.tsx` | Calls the board-specific `restoreVersion` (`lib/yjs/restore.ts`) and uses board wording. Phase 8 generalizes it. |
| Top bar | `apps/web/components/board/TopBar.tsx` | Back · title/rename · status dot · View only · Saved/Saving… · Avatars · Share · History. Board wording in a few places. Add a `kind` prop. |
| Avatars | `apps/web/components/board/Avatars.tsx` + `lib/presence.ts` | Reads awareness `user: { id, name, color }`. Reusable as is. |
| User color | `lib/presence.ts` → `userColor(userId)` | Reuse for document carets. |
| Presence setup + `beforeunload` leave | inline in `components/board/BoardClient.tsx` | Same pattern for documents. |
| Offline banner + "Back online" toast | inline in `components/board/BoardClient.tsx` | Extract into a shared component and hook so documents reuse them. |
| Dashboard | `app/dashboard/page.tsx`, `components/dashboard/new-board-button.tsx`, `board-card-menu.tsx` | Becomes a mixed list, with a **New** dropdown and a `kind` prop on the card menu for wording. |
| Board/doc actions | `app/actions/boards.ts` (`createBoard`, `renameBoard`, `deleteBoard`, `leaveBoard`) | None of them filter by kind, so rename/delete/leave work for documents. Add `createDocument`. |
| Route protection | `apps/web/proxy.ts` matcher | Add `/doc/:path*`. |
| Undo (board) | `lib/yjs/undo.ts` (`Y.UndoManager` on shapes/order, `LOCAL_ORIGIN`) | Not reused for documents. Tiptap's Collaboration extension has its own Yjs undo (Phase 7). |

## 3. Current Prisma models (app tables)

```prisma
enum Role { OWNER EDITOR VIEWER }

model Board {
  id String @id @default(cuid())
  title String @default("Untitled board")
  ownerId String            // → User, cascade
  state Bytes?              // Y.encodeStateAsUpdate(doc)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  members BoardMember[]; shares ShareLink[]; versions BoardVersion[]
}
model BoardMember { boardId, userId, role (EDITOR|VIEWER), @@id([boardId, userId]) }
model ShareLink   { token @id, boardId, role, @@unique([boardId, role]) }
model BoardVersion{ id, boardId, state Bytes, label?, createdById, createdAt }
```

None of these tables depends on what's inside `state`. That makes the plan's preferred approach (a `kind` column on `Board`) a clean fit. See `docs/decisions.md`.

## 4. Small generalizations needed (task 0.4)

| Change | How boards stay unchanged |
|--------|---------------------------|
| `getBoardRole` → `getItemRole` (`lib/access.ts`) | Pure rename. Same query, and every caller is updated. |
| `connectBoard` → `connectItem`, `clearLocalBoards` → `clearLocalItems` (`lib/yjs/provider.ts`) | Pure rename. Same IndexedDB prefix, so existing offline copies are still found and cleared. |
| `TopBar`, `ShareDialog`, `BoardCardMenu`: new `kind` prop (default `"BOARD"`) | Used only to pick wording ("board"/"document"). Boards get the same strings as before. |
| Offline banner + "Back online" toast → `components/shared/OfflineBanner.tsx` + `useBackOnlineToast` | Moved out of `BoardClient` with the same markup and logic. |
| Board page: also require `kind === BOARD` | Existing boards default to `BOARD`. |
| Join page: redirect by `kind` | `BOARD` still goes to `/board/[id]`. |
| Dashboard: select `kind`, pick the link and icon | Boards still link to `/board/[id]`. |
| `HistoryDialog` (Phase 8): accept a `restore(doc, state)` function and `kind` | Boards pass the existing `restoreVersion`. |

Not changed: the sync server (auth and persistence are kind-agnostic), `/api/ws-token` (except the rename), share actions and version actions.

## 5. Things to keep in mind

- **Offline refresh:** `docs/decisions.md` (Phase 7) records that a full page refresh with the *browser* offline can't load the page, because there's no service worker (out of scope). Documents have the same limit. PLAN2 Phase 6's "a refresh while offline still shows my text" is verified like it was for boards: refresh while the **sync server** is unreachable, so the page loads and the content comes from IndexedDB.
- **Board undo uses `LOCAL_ORIGIN`.** Tiptap's Collaboration/y-tiptap uses its own sync-plugin origin and its own UndoManager. They don't interact.
- Tiptap v3: StarterKit turns history off with `undoRedo: false`. The placeholder lives in `@tiptap/extensions`, and carets are in `@tiptap/extension-collaboration-caret`. All of this gets checked against the installed types in Phase 2.
- The e2e test reads `window.doc`, which is exposed only in development. Documents follow the same pattern.

## 6. Baseline test results (task 0.5)

Run on 2026-10-19 on `master` @ `e7afba0`:

- `pnpm test` (vitest): **4 files, 23 tests passed.**
- `pnpm typecheck`: passes (all 4 packages).
- `pnpm lint`: passes.
- `pnpm test:e2e` (Playwright, `e2e/collab.spec.ts`): **1 passed** (38 s). The first run failed only because the demo user's "Demo board" had been renamed to "first demo", and the test looks for a board by that title. Re-running `pnpm db:seed` added a new "Demo board" (the renamed one is untouched), and the test then passed.
