# PLAN.md: Real-Time Collaborative Whiteboard (MVP)

> **For Claude Code:** This is the build plan for the project. Read the whole file before you start.
> Follow it phase by phase. Keep the **Progress Tracker** below up to date. It's the single source of truth for how much work is done.

---

## 0. How to work with this plan (read first)

### 0.1 Rules for Claude Code

1. **Work one phase at a time, in order.** Don't start a phase until the previous phase's "Done when" checks all pass.
2. **Plan first, then code.** At the start of each phase, write a short plan (files to create or change, approach) and then build it.
3. **Update the checklist as you go.**
   - When you finish a task, change its `- [ ]` to `- [x]` **in this file** right away.
   - When every task in a phase is done and its "Done when" checks pass, update the phase row in the **Progress Tracker** table: set the status to `✅ Done`, fill in the date, and update the overall percentage.
   - While working on a phase, set its status to `🔄 In progress`.
   - Update the **Current status** line every time you finish a task.
   - Add one line per finished phase to the **Progress Log** at the bottom.
4. **Stop after each phase.** Summarize what was built, how to test it by hand, and anything not done. Then wait for the user to say "continue" before starting the next phase.
5. **MVP only.** Build only what this plan lists. If something isn't in this plan, don't build it. If you think something is missing, ask the user instead of adding it. See section 3, "Out of scope".
6. **Keep it simple.** Prefer the simplest code that works. No premature abstractions, no extra libraries beyond those in section 2.
7. **Check library APIs against the installed version.** Yjs, Hocuspocus, Better Auth and Prisma APIs change between major versions. Before you use an API, check the installed package's types or docs. Don't rely on memory.
8. **Never commit secrets.** Keep all secrets in `.env` files (git-ignored), and list every variable in `.env.example`.
9. **Commit after each phase** with a message like `phase 3: real-time sync with hocuspocus`.
10. **Record decisions.** When you make a non-obvious technical choice, add a short entry to `docs/decisions.md` (what, why, and alternatives you considered).

### 0.2 Definitions

- **Board:** one whiteboard document.
- **Y.Doc:** the Yjs document that holds a board's shapes. It's the source of truth for board content.
- **Sync server:** the separate Node.js WebSocket server (Hocuspocus) that relays changes between browsers and saves boards to Postgres.
- **Room:** all connections to the same board. The room name is the board ID.

---

## Progress Tracker

**Current status:** Phase 6 done. Next: Phase 7 (Offline support).

**Overall progress:** 7 / 11 phases complete (64%)

| # | Phase | Status | Completed on |
|---|-------|--------|--------------|
| 0 | Project setup | ✅ Done | 2026-10-17 |
| 1 | Auth and dashboard | ✅ Done | 2026-10-17 |
| 2 | Canvas (single user, data in Yjs) | ✅ Done | 2026-10-17 |
| 3 | Real-time sync server | ✅ Done | 2026-10-17 |
| 4 | Save boards to Postgres | ✅ Done | 2026-10-17 |
| 5 | Permissions and share links | ✅ Done | 2026-10-17 |
| 6 | Live cursors and who's online | ✅ Done | 2026-10-17 |
| 7 | Offline support | ⬜ Not started | — |
| 8 | Undo and redo | ⬜ Not started | — |
| 9 | Version history (save and restore) | ⬜ Not started | — |
| 10 | Tests, deploy and README | ⬜ Not started | — |

Status values: `⬜ Not started` · `🔄 In progress` · `✅ Done`

---

## 1. Product summary

A simple web app where people can draw on a shared whiteboard **together, in real time**.

**What the user can do (the complete MVP feature list):**

1. Sign up and log in with email and password.
2. See a list of their boards. Create, rename and delete boards.
3. Open a board and draw: **rectangle, ellipse, text, freehand pen**. Select, move, resize, recolor and delete shapes. Pan and zoom the canvas.
4. Share a board with a link: **"Can edit"** or **"Can view"**.
5. See other people's changes **instantly**, plus their **cursors with names** and **who is online**.
6. Keep drawing **while offline**. Changes merge automatically when the connection comes back.
7. **Undo and redo** their own changes, without undoing anyone else's.
8. **Save a version** of the board and **restore** it later.

### 1.1 Design principles (very important)

The interface must be **minimal, clean and obvious**. A first-time user should understand it without any instructions.

- **Light theme only.** White canvas with a faint dot grid, neutral grays, and one accent color.
- Use **shadcn/ui default components** with default styling. No custom design system, no gradients, no fancy animations.
- **Few screens:** Login/Sign up → Dashboard → Board. That's all.
- **Board screen layout** (nothing else on screen):
  - **Top bar (thin):** ← back to dashboard · board title (click to rename) · connection dot (green: synced, yellow: connecting, gray: offline) · online user avatars · **Share** button · **History** button.
  - **One floating toolbar** at the bottom center: Select (V) · Rectangle (R) · Ellipse (O) · Text (T) · Pen (P) · then Undo · Redo.
  - When shapes are selected, show a **small floating panel** with 6 color swatches and a Delete button. Nothing more.
  - The canvas fills the rest of the screen.
- Every tool button has a **tooltip with its keyboard shortcut**.
- Use **plain, friendly text:** "Can edit", "Can view", "Saved", "Offline – changes will sync when you're back online".
- Empty states: Dashboard with no boards shows "No boards yet" and a **New board** button.
- It must work well in Chrome, Edge, Firefox and Safari on a laptop. Mobile layout isn't required, but nothing should break on a tablet.

---

## 2. Tech stack (use exactly this, nothing extra)

| Area | Choice |
|------|--------|
| Monorepo | **pnpm workspaces** (no Turborepo needed) |
| Web app | **Next.js** (latest stable, App Router, TypeScript, server actions) |
| UI | **Tailwind CSS** + **shadcn/ui** + **lucide-react** icons + **sonner** toasts |
| Canvas | **react-konva** + **konva**; **perfect-freehand** for pen strokes |
| Local UI state | **zustand** (current tool, camera, selection) |
| Real-time data (CRDT) | **yjs** |
| Real-time client | **@hocuspocus/provider** (includes awareness for cursors) |
| Offline storage | **y-indexeddb** |
| Sync server | **@hocuspocus/server** + **@hocuspocus/extension-database** + **@hocuspocus/extension-logger** |
| Database | **PostgreSQL** (Neon for hosting; a local Docker Postgres is fine for dev) |
| ORM | **Prisma** |
| Auth | **better-auth** (email + password, Prisma adapter) |
| WebSocket auth tokens | **jose** (HS256 JWT) |
| Validation | **zod** |
| IDs | **nanoid** |
| Dev runner for sync server | **tsx** |
| Tests | **vitest** (unit) + **@playwright/test** (one end-to-end test with two users) |
| Hosting | Vercel (web) · Railway or Fly.io (sync server, Docker) · Neon (Postgres) |

**Don't add** other state libraries, UI kits, CSS-in-JS, Redis, tRPC, GraphQL, analytics, or monitoring SDKs.

---

## 3. Out of scope (do NOT build these)

- OAuth / social login, email verification, password reset emails
- Teams, organizations, billing, plans
- Comments, chat, reactions, notifications
- Arrows, lines, connectors, images, sticky notes, stickers, templates
- Rotation, grouping, layers panel, alignment tools, snapping
- Export to PNG/SVG/PDF, board thumbnails
- "Follow user" mode, shared selection outlines
- Dark mode, themes, custom fonts
- Version previews or diffs (only list + restore)
- Multiple sync-server instances, Redis, load balancing
- PWA / service worker
- Admin panel, analytics, Sentry

If the user later asks for any of these, add them as a new phase at the end.

---

## 4. Architecture

```
 Browser (Next.js page)                         Sync server (Node, always on)
 ┌──────────────────────────┐   WebSocket     ┌───────────────────────────────┐
 │ React + Konva canvas     │ ◄────────────► │ Hocuspocus                    │
 │ Y.Doc (board content)    │  binary Yjs     │ one Y.Doc per room (board id) │
 │ IndexedDB (offline copy) │  updates +      │ onAuthenticate → verify JWT   │
 │ zustand (tool, camera)   │  awareness      │ Database ext → Prisma         │
 └───────────┬──────────────┘                 └──────────────┬────────────────┘
             │ HTTPS (pages, server actions,                 │ load / save (debounced)
             │ GET /api/ws-token → short JWT)                │
             ▼                                               ▼
 ┌──────────────────────────┐                 ┌───────────────────────────────┐
 │ Next.js server (Vercel)  │ ───Prisma────►  │ PostgreSQL                    │
 │ auth, dashboard, sharing │                 │ users, boards (state bytes),  │
 └──────────────────────────┘                 │ members, share links, versions│
                                              └───────────────────────────────┘
```

**Key rules:**

- Board **content** lives only in the Y.Doc. Postgres stores it as one binary column (`Board.state`). **Never** store shapes as separate database rows.
- Next.js on Vercel **can't** hold WebSocket connections. That's why the sync server is a separate app.
- The sync server trusts **only** a short-lived JWT signed by Next.js with a shared secret (`WS_JWT_SECRET`).
- Cursors and online presence use Yjs **awareness**. They're **never** stored in the Y.Doc or the database.

---

## 5. Repository structure

```
whiteboard/
├── apps/
│   ├── web/                        # Next.js app (Vercel)
│   │   ├── app/
│   │   │   ├── (auth)/login/page.tsx
│   │   │   ├── (auth)/signup/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── board/[id]/page.tsx
│   │   │   ├── join/[token]/page.tsx
│   │   │   └── api/
│   │   │       ├── auth/[...all]/route.ts     # better-auth handler
│   │   │       └── ws-token/route.ts          # issues WebSocket JWT
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn components
│   │   │   ├── board/              # TopBar, Toolbar, SelectionPanel, ShareDialog, HistoryDialog, Avatars
│   │   │   └── canvas/             # Canvas, ShapeRenderer, Cursors
│   │   ├── lib/
│   │   │   ├── auth.ts             # better-auth server config
│   │   │   ├── auth-client.ts
│   │   │   ├── access.ts           # getBoardRole(userId, boardId)
│   │   │   └── yjs/
│   │   │       ├── schema.ts       # doc structure + shape types
│   │   │       ├── mutations.ts    # createShape, updateShape, deleteShapes
│   │   │       ├── hooks.ts        # useShapes, useShape
│   │   │       ├── provider.ts     # create provider + IndexedDB persistence
│   │   │       └── restore.ts      # restore-forward logic
│   │   ├── stores/editor.ts        # zustand: tool, camera, selection, color
│   │   └── middleware.ts
│   └── sync/                       # Hocuspocus server (Railway/Fly)
│       ├── src/index.ts
│       ├── src/auth.ts
│       ├── src/persistence.ts
│       ├── Dockerfile
│       └── package.json
├── packages/
│   ├── db/                         # Prisma schema + client (shared)
│   │   ├── prisma/schema.prisma
│   │   └── src/index.ts
│   └── shared/                     # shared types/constants (zod shape schema, colors)
│       └── src/index.ts
├── e2e/                            # Playwright test
├── docs/decisions.md
├── .env.example
├── pnpm-workspace.yaml
├── package.json
└── PLAN.md
```

---

## 6. Data model

### 6.1 Prisma schema (`packages/db/prisma/schema.prisma`)

Add the tables Better Auth needs (User, Session, Account, Verification). Generate them with the Better Auth CLI or copy them from its docs for the installed version. Then add:

```prisma
enum Role {
  OWNER
  EDITOR
  VIEWER
}

model Board {
  id        String        @id @default(cuid())
  title     String        @default("Untitled board")
  ownerId   String
  owner     User          @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  state     Bytes?        // Y.encodeStateAsUpdate(doc). Board content lives ONLY here.
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  members   BoardMember[]
  shares    ShareLink[]
  versions  BoardVersion[]

  @@index([ownerId])
}

model BoardMember {
  boardId   String
  userId    String
  role      Role          // EDITOR or VIEWER (owner is Board.ownerId)
  board     Board         @relation(fields: [boardId], references: [id], onDelete: Cascade)
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime      @default(now())

  @@id([boardId, userId])
  @@index([userId])
}

model ShareLink {
  token     String        @id      // nanoid(21)
  boardId   String
  role      Role          // EDITOR or VIEWER
  board     Board         @relation(fields: [boardId], references: [id], onDelete: Cascade)
  createdAt DateTime      @default(now())

  @@unique([boardId, role]) // at most one edit link and one view link per board
}

model BoardVersion {
  id          String      @id @default(cuid())
  boardId     String
  state       Bytes       // full Y.Doc state at save time
  label       String?
  createdById String
  createdAt   DateTime    @default(now())
  board       Board       @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@index([boardId, createdAt])
}
```

### 6.2 Y.Doc structure (`apps/web/lib/yjs/schema.ts`)

```ts
const doc = new Y.Doc()
const shapes = doc.getMap<Y.Map<unknown>>('shapes') // shapeId -> shape (Y.Map)
const order  = doc.getArray<string>('order')        // drawing order (z-index), list of shapeIds
```

Each shape is a **Y.Map with one key per property**. Never store a whole shape as one plain object, or two people editing the same shape will overwrite each other.

| Key | Type | Used by |
|-----|------|---------|
| `id` | string (nanoid) | all |
| `type` | `'rect' \| 'ellipse' \| 'text' \| 'pen'` | all |
| `x`, `y` | number (world coordinates) | all |
| `width`, `height` | number | rect, ellipse, text |
| `color` | string (one of the palette colors) | all |
| `text` | string | text |
| `fontSize` | number (default 20) | text |
| `points` | number[] (flat `[x1,y1,x2,y2,…]`, relative to x/y) | pen |
| `createdBy` | string (userId) | all |

Color palette (in `packages/shared`): 6 colors: black `#1e1e1e`, red `#e03131`, blue `#1971c2`, green `#2f9e44`, yellow `#f08c00`, purple `#9c36b5`. Shapes are drawn with a stroke in the chosen color and a light fill (same color at about 15% opacity). Text uses the color directly.

**Not in the Y.Doc:** current tool, selection, camera (zoom/pan) → zustand. Cursors and user info → awareness.

---

## 7. Environment variables (`.env.example`)

```
# shared
DATABASE_URL=postgresql://...
WS_JWT_SECRET=long-random-string        # same value in web and sync

# web
BETTER_AUTH_SECRET=long-random-string
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_SYNC_URL=ws://localhost:1234

# sync
PORT=1234
ALLOWED_ORIGIN=http://localhost:3000
```

---

# PHASES

Each phase has: **Goal**, **Tasks** (checklist; tick them as you finish), and **Done when** (manual checks that must pass before the phase is complete).

---

## Phase 0: Project setup

**Goal:** an empty but working monorepo with both apps, the database, and shared packages.

**Tasks**
- [x] 0.1 Create the pnpm workspace (`pnpm-workspace.yaml` with `apps/*` and `packages/*`). Add a root `package.json` with scripts: `dev` (runs web and sync in parallel with `pnpm -r --parallel dev`), `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:studio`.
- [x] 0.2 Create `apps/web` with `create-next-app` (TypeScript, App Router, Tailwind, ESLint, `src/` not needed). Initialize **shadcn/ui** and add these components: button, input, label, card, dialog, dropdown-menu, tooltip, avatar, sonner, alert-dialog.
- [x] 0.3 Create `apps/sync`: a Node + TypeScript package. Add a `dev` script using `tsx watch src/index.ts`. For now, `src/index.ts` just logs "sync server starting".
- [x] 0.4 Create `packages/db` with Prisma. Write the schema from section 6.1 (including the Better Auth tables). Export a singleton `PrismaClient` from `src/index.ts`. Both apps import it as `@whiteboard/db`.
- [x] 0.5 Create `packages/shared` and export: the zod `ShapeSchema` (matching the table in 6.2), the `COLORS` palette, and the `ShapeType` type.
- [x] 0.6 Set up Postgres (Neon or local Docker), add `.env` files, and run the first migration.
- [x] 0.7 Strict TypeScript in all packages, ESLint, Prettier. Add `.env.example` (section 7) and `.gitignore`.
- [x] 0.8 Create `docs/decisions.md` with a first entry: "Why a monorepo with a separate sync server".
- [x] 0.9 Add a GitHub Actions workflow that runs `pnpm install`, `pnpm typecheck` and `pnpm lint` on every push.

**Done when**
- [x] `pnpm dev` starts Next.js on :3000 and the sync server process without errors.
- [x] `pnpm db:studio` shows all tables.
- [x] `pnpm typecheck` and `pnpm lint` pass.

---

## Phase 1: Auth and dashboard

**Goal:** users can sign up, log in, and manage a list of their boards. Keep this phase small and simple.

**Tasks**
- [x] 1.1 Configure **better-auth** with the Prisma adapter and **email + password only**. Add the route handler at `app/api/auth/[...all]/route.ts`, plus `lib/auth.ts` and `lib/auth-client.ts`.
- [x] 1.2 **Sign up page** (`/signup`): name, email, password. **Log in page** (`/login`): email, password. Each is a single centered card. Show errors inline. After success, go to `/dashboard`.
- [x] 1.3 `middleware.ts`: redirect logged-out users from `/dashboard`, `/board/*` and `/join/*` to `/login?next=...`. Redirect logged-in users from `/login` and `/signup` to `/dashboard`. `/` redirects to `/dashboard`.
- [x] 1.4 `lib/access.ts`: `getBoardRole(userId, boardId)` returns `'OWNER' | 'EDITOR' | 'VIEWER' | null`. It checks `Board.ownerId` first, then `BoardMember`.
- [x] 1.5 **Dashboard** (`/dashboard`):
  - Header: app name on the left, user menu (name, Log out) on the right.
  - **New board** button: creates a board with the server action `createBoard()` and navigates to it.
  - Grid of board cards: title, "Edited <relative time>", and a role badge if the user isn't the owner ("Can edit" / "Can view").
  - Each card owned by the user has a `⋯` menu: **Rename** (dialog with an input) and **Delete** (confirm dialog). Non-owners get **Leave board**, which removes their membership.
  - Show boards the user owns **and** boards shared with them, sorted by `updatedAt` descending.
  - Empty state: "No boards yet" + **New board** button.
- [x] 1.6 Server actions `createBoard`, `renameBoard`, `deleteBoard`, `leaveBoard`. Validate inputs with zod (title 1–80 chars). Check permissions on the server: only the owner can rename or delete.
- [x] 1.7 `/board/[id]` page (server component): check access with `getBoardRole`. If there's no access, show `notFound()`. For now it just renders the board title and "Canvas coming soon".
- [x] 1.8 Seed script: a demo user (`demo@whiteboard.dev` / password from `.env`) with one board.

**Done when**
- [x] I can sign up, log out and log in again.
- [x] I can create, rename and delete a board from the dashboard.
- [x] A second user gets a 404 on my board's URL.
- [x] Logged-out users are redirected to the login page.

---

## Phase 2: Canvas (single user, data in Yjs)

**Goal:** a complete single-player whiteboard where **all shape data already lives in a Y.Doc**, so adding multiplayer in Phase 3 needs only a few lines.

**Tasks**
- [x] 2.1 `lib/yjs/schema.ts`: `createBoardDoc()` returns `{ doc, shapes, order }` (section 6.2).
- [x] 2.2 `lib/yjs/mutations.ts`. Every function wraps its changes in `doc.transact(fn, LOCAL_ORIGIN)`:
  - `createShape(doc, partialShape)` → generates an id with nanoid, creates a Y.Map with one key per property, adds it to `shapes`, pushes the id to `order`. Returns the id.
  - `updateShape(doc, id, patch)` → sets only the keys in `patch`.
  - `deleteShapes(doc, ids)` → removes the ids from `shapes` and `order`.
  - `bringToFront` isn't needed. Don't build it.
- [x] 2.3 `lib/yjs/hooks.ts`:
  - `useShapeIds(doc)` → reads the `order` array, re-renders when it changes (use `useSyncExternalStore`).
  - `useShape(doc, id)` → returns a plain object snapshot of one shape and re-renders only when **that** shape's Y.Map changes (observe that Y.Map).
  - Cache the snapshots so `useSyncExternalStore` gets the same object reference when nothing has changed.
- [x] 2.4 `stores/editor.ts` (zustand): `tool` (`select | rect | ellipse | text | pen`), `color`, `selectedIds`, `camera { x, y, zoom }`, and the actions for them. **This state is never put into the Y.Doc.**
- [x] 2.5 `components/canvas/Canvas.tsx`: a full-screen Konva `Stage` that resizes with the window. Light dot-grid background (can be CSS on the container, moved with the camera).
  - **Zoom:** Ctrl/⌘ + mouse wheel, or pinch on a trackpad. Zoom toward the pointer, limited to 10%–400%.
  - **Pan:** plain mouse wheel / trackpad scroll, or hold **Space** and drag.
  - Helper `screenToWorld(point)` / `worldToScreen(point)`. All stored coordinates are **world coordinates**.
- [x] 2.6 `ShapeRenderer`: renders each id from `useShapeIds` with a `ShapeNode` component that uses `useShape`. Rect → `Rect`, ellipse → `Ellipse`, text → `Text`, pen → a `Path` built with **perfect-freehand** from `points`.
- [x] 2.7 **Drawing tools:**
  - Rect / Ellipse: press, drag and release creates the shape (show a preview while dragging; create it in the Y.Doc on release). A plain click creates a default 120×80 shape. After creating, switch back to **Select** and select the new shape.
  - Text: click to place a text box and immediately show an HTML `textarea` over the canvas to type into. On blur or Escape, save the text with `updateShape`. Delete the shape if the text is empty. Double-click an existing text shape to edit it.
  - Pen: collect points while the pointer is down (local preview), and create one `pen` shape on release. The pen tool stays active after drawing.
- [x] 2.8 **Select tool:**
  - Click a shape to select it. Shift+click adds or removes it from the selection. Drag on empty canvas draws a selection box.
  - Drag selected shapes to move them. While dragging, **throttle** Y.Doc writes to at most one every 30 ms, and write `x` and `y` in **one** transaction. Always write the final position on release.
  - Use a Konva `Transformer` for **resize only** (turn rotation off). Write `width`/`height`/`x`/`y` on transform end. Pen shapes: move only, no resize.
  - Click on empty canvas or press Escape to clear the selection.
- [x] 2.9 `Toolbar` (bottom center, floating, shadcn buttons with lucide icons and tooltips): Select (V), Rectangle (R), Ellipse (O), Text (T), Pen (P). Undo and redo buttons are added in Phase 8.
- [x] 2.10 `SelectionPanel`: appears above the selection when shapes are selected. It has 6 color swatches (applies `color` to all selected shapes in one transaction) and a Delete button. Picking a color with nothing selected sets the color for the next shape.
- [x] 2.11 Keyboard shortcuts: V/R/O/T/P for tools, Delete/Backspace to delete the selection, Escape to deselect, Ctrl/⌘+A to select all. Ignore shortcuts while typing in an input or textarea.
- [x] 2.12 Unit tests (vitest) for `mutations.ts`: create, update and delete change the doc as expected.

**Done when**
- [x] I can draw rectangles, ellipses, text and pen strokes.
- [x] I can select, move, resize, recolor and delete shapes.
- [x] Pan and zoom are smooth, and drawing still lands exactly under the cursor at any zoom level.
- [x] Logging `doc.toJSON()` shows all shapes. Nothing about tool, selection or camera is in it.

---

## Phase 3: Real-time sync server

**Goal:** two browser windows on the same board see each other's changes instantly.

**Tasks**
- [x] 3.1 `apps/sync/src/index.ts`: create a **Hocuspocus** server on `PORT` (default 1234) with the Logger extension. No auth or persistence yet. Those come in Phases 4 and 5.
- [x] 3.2 `lib/yjs/provider.ts`: `connectBoard(boardId, doc)` creates a `HocuspocusProvider` with `{ url: NEXT_PUBLIC_SYNC_URL, name: boardId, document: doc }` and returns it with a cleanup function.
- [x] 3.3 The board page (client component `BoardClient`) creates **one** Y.Doc + provider per board in a `useEffect`/`useMemo`, and destroys both on unmount. Watch out for React Strict Mode running effects twice.
- [x] 3.4 Connection status: track the provider's status and `synced` events in a small hook `useConnectionStatus()`. Show it as a colored dot in the top bar with a tooltip ("Connected", "Connecting…", "Offline").
- [x] 3.5 Until the first sync finishes, show a light "Loading board…" in place of the canvas. (Phase 7 changes this to load from IndexedDB first.)
- [x] 3.6 Build the board **TopBar** now: back arrow → dashboard, board title (click to rename for owners), status dot, and placeholders for avatars, Share and History.
- [x] 3.7 Write `apps/sync/Dockerfile` (Node LTS, pnpm, builds `packages/db` and `apps/sync`, runs `node dist/index.js`).
- [x] 3.8 Add a note to `docs/decisions.md`: why Hocuspocus, and why it isn't part of Next.js.

**Done when**
- [x] With two windows on the same board, every create, move, resize, recolor, text edit and delete appears in the other window in well under a second.
- [x] Two people dragging different shapes at the same time both work. Two people recoloring the same shape both end up with the same color.
- [x] The status dot is green when connected, and changes when the sync server is stopped.

---

## Phase 4: Save boards to Postgres

**Goal:** boards are kept after everyone leaves and after the sync server restarts.

**Tasks**
- [x] 4.1 `apps/sync/src/persistence.ts`: configure `@hocuspocus/extension-database`:
  - `fetch({ documentName })` → `prisma.board.findUnique({ where: { id: documentName }, select: { state: true } })` → return `state` (or `null` for a new board).
  - `store({ documentName, state })` → `prisma.board.update({ where: { id }, data: { state } })`. Use the full state the extension provides (equivalent to `Y.encodeStateAsUpdate(doc)`).
- [x] 4.2 Configure the server's `debounce: 2000` and `maxDebounce: 10000`, so it saves after 2 seconds of quiet and at least every 10 seconds while edits continue. Hocuspocus also saves when the last client disconnects. Confirm that this happens.
- [x] 4.3 Ignore unknown board IDs. If the board doesn't exist in Postgres, reject the connection (handled with auth in Phase 5; for now just log it).
- [x] 4.4 `Board.updatedAt` should change when the content is saved, so the dashboard's "Edited …" stays correct.
- [x] 4.5 Show a small "Saved" / "Saving…" text next to the status dot. A simple approach: "Saving…" while the provider has unsynced changes, "Saved" once it reports everything is synced.

**Done when**
- [x] Draw something, close every tab, restart the sync server, reopen the board: everything is still there.
- [x] The logs show the database is **not** written on every mouse move (the debounce works).

---

## Phase 5: Permissions and share links

**Goal:** only allowed users can connect to a board, viewers can't change it even with modified client code, and owners can share with a link.

**Tasks**
- [x] 5.1 `app/api/ws-token/route.ts` (GET `?boardId=`): check the session, then `getBoardRole`. If there's no access, return 403. Otherwise sign a JWT with **jose** (HS256, `WS_JWT_SECRET`) containing `{ sub: userId, name, boardId, role }`, expiring in **5 minutes**. Return `{ token }`.
- [x] 5.2 Provider: pass `token` as an **async function** that fetches `/api/ws-token`, so it gets a fresh token on every reconnect.
- [x] 5.3 `apps/sync/src/auth.ts`, the `onAuthenticate` hook:
  - Verify the JWT signature and expiry. If invalid, throw (the connection is rejected).
  - Check `payload.boardId === documentName`. If it doesn't match, reject.
  - If `role === 'VIEWER'`, set the connection to **read-only** (`connection.readOnly = true` in current Hocuspocus. Check the installed version's API).
  - Return `{ user: { id, name, role } }` as the connection context.
- [x] 5.4 Check the `Origin` header against `ALLOWED_ORIGIN` on the sync server.
- [x] 5.5 **Share dialog** (Share button in the top bar, owners only):
  - Two rows: **"Anyone with the link can edit"** and **"Anyone with the link can view"**, each with a **Copy link** button.
  - Server action `getOrCreateShareLink(boardId, role)` creates the link the first time (token = `nanoid(21)`), then returns it. Link format: `/join/<token>`.
  - A **Reset links** button deletes both links so old links stop working (confirm dialog).
  - Show a toast "Link copied" after copying.
  - Non-owners see the Share button disabled, with the tooltip "Only the owner can share".
- [x] 5.6 `/join/[token]` page: logged-out users go to login first and come back here. If the token is invalid, show "This link is invalid or was reset". If valid, upsert a `BoardMember` with the link's role (never downgrade an existing EDITOR to VIEWER; the owner stays owner), then redirect to the board.
- [x] 5.7 **Viewer UI:** hide the toolbar and selection panel, disable dragging and shortcuts, and show a small "View only" badge in the top bar. (The server is the real protection. The UI just reflects it.)

**Done when**
- [x] Opening a socket with no token or a fake one is rejected (check in the sync server logs).
- [x] A viewer can't change the board. Even a change made manually in DevTools (`doc.getMap('shapes').set(...)`) doesn't reach other users or the database.
- [x] An edit link opened in a private window (as another user) gives edit access. A view link gives view-only access.
- [x] After **Reset links**, the old links show the invalid-link message.

---

## Phase 6: Live cursors and who's online

**Goal:** you can see who's on the board and where their cursor is.

**Tasks**
- [x] 6.1 When the board loads, set the local awareness state: `provider.awareness.setLocalStateField('user', { id, name, color })`. Pick `color` from a fixed list based on a hash of the user id, so it's stable for each user.
- [x] 6.2 On pointer move over the canvas, set `awareness.setLocalStateField('cursor', { x, y })` in **world coordinates**, throttled to about 50 ms. On pointer leave, set `cursor` to `null`.
- [x] 6.3 `components/canvas/Cursors.tsx`: listen to awareness `change`. For every other client with a cursor, draw an arrow in their color with a name label. Convert world → screen with the current camera. Move each cursor smoothly toward its latest position with `requestAnimationFrame` (simple lerp).
- [x] 6.4 `components/board/Avatars.tsx` in the top bar: one circle per unique online user (initials + their color, tooltip with the name), at most 5, then "+N". Include yourself, marked "(you)" in the tooltip.
- [x] 6.5 Make sure a closed tab disappears quickly. Set the awareness state to null on `beforeunload`. Awareness timeout handles crashed clients.

**Done when**
- [x] With two windows open, each shows the other's cursor with a name, moving smoothly.
- [x] Cursors line up correctly when the two windows have different zoom and pan.
- [x] Closing a tab removes its avatar and cursor within a few seconds.
- [x] Nothing about cursors appears in `doc.toJSON()` or in the database.

---

## Phase 7: Offline support

**Goal:** editing keeps working without internet, and changes merge automatically on reconnect.

**Tasks**
- [ ] 7.1 In `connectBoard`, also create `new IndexeddbPersistence(boardId, doc)` from **y-indexeddb**, and destroy it on cleanup.
- [ ] 7.2 Loading: show the canvas as soon as **either** IndexedDB has loaded **or** the provider has synced, whichever comes first. A board you've opened before should appear instantly.
- [ ] 7.3 When offline, show a slim yellow banner under the top bar: "You're offline – changes are saved on this device and will sync when you're back online." Hide it automatically on reconnect and show the toast "Back online – changes synced".
- [ ] 7.4 When the user logs out, clear the IndexedDB databases for their boards (`clearData()`), so the next user on the same computer doesn't see them.
- [ ] 7.5 Add a short section to `docs/decisions.md` explaining why there's no special merge code (the CRDT plus the sync handshake handle it).

**Done when**
- [ ] DevTools → Network → Offline: I can keep drawing, and a page refresh while offline still shows my offline changes.
- [ ] Two windows both edit while one is offline. After reconnecting, both show the same final board, and no change was lost (except the same property of the same shape edited in both places, where one value wins in both windows).
- [ ] The offline banner shows and hides correctly.

---

## Phase 8: Undo and redo

**Goal:** Ctrl/⌘+Z undoes **only your own** changes.

**Tasks**
- [ ] 8.1 Create one `Y.UndoManager([shapes, order], { trackedOrigins: new Set([LOCAL_ORIGIN]), captureTimeout: 500 })` per board session.
- [ ] 8.2 Make sure **every** local edit goes through `mutations.ts` with `LOCAL_ORIGIN`. Remote updates and restores must not have this origin.
- [ ] 8.3 A whole drag or resize must undo in **one** step. Call `undoManager.stopCapturing()` at the start of each new drag, and make the throttled drag writes merge within `captureTimeout`.
- [ ] 8.4 Add Undo and Redo buttons to the toolbar (disabled when there's nothing to undo or redo, using the manager's stack events) and shortcuts: Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl/⌘+Y.
- [ ] 8.5 After undo or redo, clear selected ids that no longer exist.
- [ ] 8.6 Viewers: no undo manager, no buttons.

**Done when**
- [ ] When Alice presses undo, it never removes or changes Bob's shapes.
- [ ] One drag = one undo step. One color change on 3 selected shapes = one undo step.
- [ ] Undo and redo sync to the other window like normal edits.

---

## Phase 9: Version history (save and restore)

**Goal:** save a version of the board and restore it safely, even while other people are connected.

**Tasks**
- [ ] 9.1 Server action `saveVersion(boardId, label?)` (owner or editor only). It needs the **current** content. The simplest correct approach: the client sends `Y.encodeStateAsUpdate(doc)` (base64) from its synced doc, and the server checks access and stores it in `BoardVersion`. Only allow it when the provider is synced. Keep at most 50 versions per board and delete the oldest beyond that.
- [ ] 9.2 **History dialog** (History button in the top bar):
  - A **Save version** button with an optional name input.
  - A list of versions: name (or "Untitled version"), who saved it, and relative time.
  - Each item has a **Restore** button (owner and editors only). Clicking it opens a confirm dialog: "Restore this version? Everyone on the board will see it. You can undo this."
- [ ] 9.3 `lib/yjs/restore.ts`, **restore by moving forward. Never overwrite `Board.state`.**
  1. Fetch the version's state and load it into a **temporary** `Y.Doc` with `Y.applyUpdate`.
  2. Compare it with the live doc:
     - shape ids in live but not in the version → delete them,
     - shape ids in the version but not in live → create them with all properties,
     - ids in both → for each property whose value differs, set the version's value,
     - set `order` to the version's order.
  3. Apply **all** of this in **one** `doc.transact(fn, LOCAL_ORIGIN)`, so it syncs as a normal edit and **one undo** reverts the whole restore.
- [ ] 9.4 Toast after a restore: "Version restored".
- [ ] 9.5 vitest tests for `restore.ts`: after restoring, the live doc's `toJSON()` equals the version's `toJSON()`. Cover deleted, added and changed shapes. Also test that one undo brings back the pre-restore state.
- [ ] 9.6 Note in `docs/decisions.md`: why overwriting the database doesn't work with a CRDT (connected clients would merge the newer state back in).

**Done when**
- [ ] Save a version, change a lot of things, restore: the board looks exactly like the saved version.
- [ ] Restoring while another window is open updates that window too, and the restore doesn't get undone by the other window's sync.
- [ ] Undo right after a restore brings back the previous state.

---

## Phase 10: Tests, deploy and README

**Goal:** the MVP is tested, deployed and easy for anyone to try.

**Tasks**
- [ ] 10.1 **Convergence test (vitest):** create two Y.Docs, make random edits on both (create, update, delete), exchange updates in random order (including duplicates), and check that `toJSON()` is equal. Run it with a few different random seeds.
- [ ] 10.2 **Playwright end-to-end test** (`e2e/collab.spec.ts`): two browser contexts log in as two seeded users on the same board.
  - User A draws a rectangle → user B sees it.
  - User B changes its color → user A sees the new color.
  - `contextA.setOffline(true)`, A draws a shape, then `setOffline(false)` → B sees it.
- [ ] 10.3 CI: add `pnpm test` (vitest) to the GitHub Actions workflow. Playwright can run in CI against a Postgres service container, or as a documented local command. Pick the simpler option and document it.
- [ ] 10.4 Basic protection on the sync server: a maximum message size and a limit on connections per IP (simple in-memory counter). Log rejected connections.
- [ ] 10.5 **Deploy:**
  - Postgres → **Neon**. Run `prisma migrate deploy`.
  - Sync server → **Railway or Fly.io** using the Dockerfile. Set `DATABASE_URL`, `WS_JWT_SECRET`, `ALLOWED_ORIGIN`. It must be reachable via `wss://`.
  - Web → **Vercel**. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `WS_JWT_SECRET`, `NEXT_PUBLIC_SYNC_URL=wss://...`.
  - Seed the demo user and a demo board in production.
- [ ] 10.6 Add a "Try the demo" button on the login page that signs in as the demo user.
- [ ] 10.7 **README.md:**
  - One-line pitch, live demo link, demo login.
  - GIF: two windows editing together (a placeholder is fine; the user will record it).
  - Feature list (section 1 only).
  - Architecture diagram (section 4) and a short "How sync works" explanation.
  - Tech stack.
  - Local setup: clone → `pnpm install` → `.env` → `pnpm db:migrate` → `pnpm dev`.
  - Key decisions (link to `docs/decisions.md`).

**Done when**
- [ ] `pnpm test` passes locally and in CI. The Playwright test passes locally.
- [ ] The production URL works: sign up, create a board, share a link, two people edit together, offline works.
- [ ] The README lets a new developer run the project locally in under 10 minutes.

---

## Final MVP acceptance checklist

Check these at the very end, on the deployed app:

- [ ] Sign up / log in / log out works.
- [ ] Dashboard: create, rename, delete, leave boards.
- [ ] Draw rectangle, ellipse, text and pen. Select, move, resize, recolor and delete.
- [ ] Pan and zoom work.
- [ ] Two users see each other's edits in real time.
- [ ] Live cursors with names, and online avatars.
- [ ] Edit and view share links work, and viewers can't edit (enforced by the server).
- [ ] Offline editing works and merges on reconnect.
- [ ] Undo and redo affect only your own changes.
- [ ] Save and restore versions works with multiple users connected.
- [ ] The UI is minimal: top bar, one toolbar, a selection panel, two dialogs (Share, History). Nothing else.

---

## Progress Log

> Claude Code: add one line here each time a phase is completed.
> Format: `YYYY-MM-DD – Phase N complete – short summary – notes or known issues`

- 2026-10-17 – Phase 0 complete – pnpm monorepo (web: Next.js 16 + shadcn, sync: tsx stub, db: Prisma 7 + Better Auth tables, shared: zod shapes), Neon dev DB migrated, CI for typecheck + lint – shared packages ship TS source; sync production build is handled in Phase 3.
- 2026-10-17 – Phase 1 complete – better-auth email/password, login + signup, proxy.ts redirects, dashboard (create/rename/delete/leave, role badges, empty state), board page with access check (real 404), seed script – Next 16 uses proxy.ts instead of middleware.ts; demo password is in apps/web/.env (DEMO_PASSWORD).
- 2026-10-17 – Phase 2 complete – Y.Doc schema, mutations (+ updateShapes batch), hooks, zustand editor store, Konva canvas (zoom/pan, rect/ellipse/text/pen, select/marquee/move/resize), toolbar, selection panel, shortcuts, 9 vitest tests – board content is in memory only until Phase 3; Safari pinch handled via gesture events but not tested in Safari.
- 2026-10-17 – Phase 3 complete – Hocuspocus 4.7 sync server + Logger, connectBoard provider, Strict-Mode-safe BoardClient, connection status dot, loading state, TopBar (rename, status, Share/History placeholders), Dockerfile – edits arrive in ~4 ms; Docker image build not tested (Docker Desktop not running); image runs `node src/index.ts` (Node 24 type stripping) instead of dist/index.js, see decisions.md.
- 2026-10-17 – Phase 4 complete – Database extension (fetch/store Board.state), debounce 2 s / max 10 s, save on last disconnect, unknown boards logged, Saved/Saving… label – 400 drag writes → 2 DB saves; connections to unknown boards are only logged until Phase 5 rejects them.
- 2026-10-17 – Phase 5 complete – /api/ws-token (jose, 5 min), async provider token, sync auth extension (origin, JWT, board match, read-only viewers), share dialog + reset, /join/[token], viewer UI – verified a viewer's forged writes never reach others or Postgres; "private window" check done with a second user session via curl.
- 2026-10-17 – Phase 6 complete – awareness user + throttled world-space cursor, Cursors overlay with rAF lerp, Avatars (max 5, +N, "(you)"), beforeunload cleanup – the second "window" was a second authenticated connection in the same page (two signed-in users in one Chrome profile isn't possible); cursor animation verified with a timer-based rAF because the automated Chrome window wasn't painting.
