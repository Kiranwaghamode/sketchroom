# Decisions

Short records of non-obvious technical choices: what, why, and the alternatives considered.

---

## 2026-10-17 – Monorepo with a separate sync server

**What:** One pnpm workspace with two apps (`apps/web` for Next.js, `apps/sync` for the Hocuspocus WebSocket server) and two shared packages (`packages/db` for the Prisma schema and client, `packages/shared` for the zod shape schema and color palette).

**Why:**

- Next.js on Vercel runs as serverless functions, which can't hold long-lived WebSocket connections. Real-time sync needs an always-on Node process that keeps one Y.Doc per room in memory, so it has to be a separate app hosted somewhere else (Railway or Fly.io).
- Both apps read and write the same Postgres tables (boards, members). A shared `@whiteboard/db` package means one Prisma schema and one generated client instead of two copies that drift apart.
- The shape schema and colors are used by the canvas and validated in tests. A shared package keeps one definition.
- pnpm workspaces are enough for two apps and two packages. Turborepo's caching and task graph aren't needed at this size.

**Alternatives considered:**

- _Two separate repositories:_ the schema and types would have to be published or copied, and every schema change would need two coordinated PRs.
- _A custom Node server for Next.js that also handles WebSockets:_ works locally but rules out Vercel, and couples the deploy and scaling of the web app to the sync server.
- _A hosted real-time service (Liveblocks, PartyKit, etc.):_ less to run, but the assignment is to build the sync layer, and it adds a vendor dependency.

---

## 2026-10-17 – Workspace packages ship TypeScript source; Prisma 7 with the pg driver adapter

**What:** `@whiteboard/db` and `@whiteboard/shared` point their `exports` at `src/index.ts` and have no build step. Prisma is pinned to the stable 7.10.1 (npm's `latest` tag was an 8.0 release candidate at setup time). Prisma 7 requires a driver adapter, so `@whiteboard/db` uses `@prisma/adapter-pg`. The generated client lives in `packages/db/src/generated` (git-ignored, regenerated on `pnpm install`).

**Why:** Next.js (Turbopack) and `tsx` both compile workspace TypeScript directly, so a build step would only add a watch process in dev. The Prisma 7 generator emits `.ts` import extensions, so all tsconfigs enable `allowImportingTsExtensions`. The production build of `apps/sync` (Phase 3 Dockerfile) will need to handle compiling these packages.

**Alternatives considered:** building each package to `dist/` with `tsc` (more moving parts in dev); Prisma 6 (no adapter needed, but older; Better Auth 1.7 supports both).

---

## 2026-10-17 – One `.env` per app instead of one at the root

**What:** `apps/web/.env`, `apps/sync/.env` and `packages/db/.env` each hold the variables that app needs. The root `.env.example` lists all of them.

**Why:** Next.js only loads `.env` from its own directory, and in production each app is deployed to a different host with its own variables anyway. The local layout mirrors production.

**Alternative considered:** a single root `.env` loaded by each app with custom code. Less duplication of `DATABASE_URL` and `WS_JWT_SECRET`, but needs extra loading code in every app.

---

## 2026-10-17 – Neon for the development database

**What:** Development uses a Neon Postgres project with the **direct** (non-pooled) connection string and `sslmode=verify-full`.

**Why:** Docker Desktop wasn't running and the local Postgres password was unknown, and Neon is the production host anyway. Prisma migrations need the direct connection (the `-pooler` host doesn't support them). `pg` already treats `sslmode=require` as `verify-full` and prints a deprecation warning, so setting `verify-full` explicitly keeps the same behavior without the warning.

**Alternatives considered:** local Docker Postgres (needs Docker running); the existing local Postgres 17 (needed a password reset).

---

## 2026-10-17 – `proxy.ts` instead of `middleware.ts`; session validated in the proxy

**What:** The auth redirects from PLAN task 1.3 live in `apps/web/proxy.ts`. The proxy calls `auth.api.getSession()`, which checks the session against the database, instead of only checking whether a session cookie exists.

**Why:** Next.js 16 deprecated `middleware.ts` and renamed it `proxy.ts`, with the same behavior. The proxy now runs on the Node.js runtime, so it can use Prisma. A cookie-only check would redirect a user with an expired cookie from `/login` to `/dashboard`, and the dashboard would send them back to `/login`, a redirect loop.

**Alternative considered:** a cookie-only check (`getSessionCookie`), which saves one DB query per page navigation but has the loop problem above.

---

## 2026-10-17 – Pages under Cache Components

**What:** The template enables `cacheComponents`. Pages that read the session or the database wrap that work in `<Suspense>` (dashboard, auth forms). The board page sets `export const instant = false` and runs its access check before any Suspense boundary.

**Why:** With Cache Components, reading request data outside `<Suspense>` is a build error. But once a page starts streaming, the HTTP status is already `200`, so a `notFound()` inside Suspense can't send a real 404. The board page needs a real 404 for users without access, so it blocks until the check is done.

---

## 2026-10-17 – Seed script lives in the web app

**What:** `pnpm db:seed` runs `apps/web/scripts/seed.ts`, which creates the demo user through `auth.api.signUpEmail`.

**Why:** Better Auth hashes passwords in its own format. Calling its sign-up API guarantees the seeded user can log in. Seeding from `packages/db` would mean copying Better Auth's hashing into the db package.

---

## 2026-10-17 – Canvas structure (Phase 2)

**What:**

- Every shape renders as a Konva `Group` at the shape's `(x, y)`, with the actual `Rect`/`Ellipse`/`Text`/`Path` at local coordinates inside it. Moving and resizing then work identically for all types: the Transformer attaches to Groups and only `x`, `y`, `width`, `height` change.
- Pointer input is handled on the container `<div>` with pointer capture (one small gesture state machine: pan, move, marquee, create, pen). Shapes are found with `stage.getIntersection()`. Konva's own drag system isn't used, so there's one code path for all tools.
- While dragging, Konva nodes are moved directly every frame for smooth feedback. The Y.Doc is written at most every 30 ms (all moved shapes in one transaction), plus once on release.
- `mutations.ts` has an extra `updateShapes(doc, updates)` next to `updateShape`, because moving or recoloring a multi-selection must be **one** transaction (and, in Phase 8, one undo step).

**Why:** simplest structure that meets the plan's rules (one transaction per drag write, resize via Transformer, pen move-only) without per-type special cases.

---

## 2026-10-17 – Where the color picker lives when nothing is selected

**What:** The selection panel (6 swatches + Delete) floats above the selection. When nothing is selected and a drawing tool (rectangle, ellipse, text, pen) is active, the same 6 swatches (without Delete) show just above the toolbar.

**Why:** PLAN task 2.10 says "picking a color with nothing selected sets the color for the next shape", but the panel is only described as appearing for a selection. Showing the swatches while a drawing tool is active gives that feature a place without adding a new UI element. Picking a color for a selection also becomes the color for the next shape.

---

## 2026-10-17 – Hocuspocus as the sync server, separate from Next.js

**What:** `apps/sync` is a standalone Node process running Hocuspocus (`@hocuspocus/server` 4.7). Browsers connect with `@hocuspocus/provider`. The room (document) name is the board id.

**Why Hocuspocus:**

- It implements the Yjs sync protocol and awareness over WebSockets, which we would otherwise hand-write on top of `y-protocols`: the state-vector handshake, broadcasting updates to the room, and awareness timeouts.
- It has exactly the hooks the plan needs: `onAuthenticate` (Phase 5, JWT check and read-only connections), the Database extension with debounced `fetch`/`store` (Phase 4), and the Logger extension.
- It keeps one in-memory Y.Doc per room and unloads it when the last client leaves, which is the right model for a single instance.

**Why not inside Next.js:** Vercel runs Next.js as short-lived serverless functions. They can't keep a WebSocket open or hold a room's Y.Doc in memory between requests. The sync server has to be an always-on process (Railway or Fly.io), so it's a separate app that shares only the Prisma package with the web app.

**Alternatives considered:** `y-websocket`'s server (no auth or persistence hooks, so more custom code); a hosted service (Liveblocks, PartyKit), which takes away the part of the project we want to own.

---

## 2026-10-17 – Sync server runs TypeScript directly on Node 24

**What:** The sync server's Docker image runs `node src/index.ts`, using Node 24's built-in type stripping. There is no `dist/` folder. `pnpm build` for `apps/sync` only type-checks, and `erasableSyntaxOnly` makes TypeScript reject syntax Node can't strip (enums, namespaces, parameter properties). This differs from PLAN task 3.7, which says "runs `node dist/index.js`".

**Why:** The sync server imports `@whiteboard/db` and `@whiteboard/shared`, which ship TypeScript source, and Prisma 7's generated client imports files with `.ts` extensions. Compiling all of that to `dist/` would need a bundler (not in the stack) or a multi-package `tsc` setup that rewrites import extensions. Node 24 runs all of it unchanged, which was verified locally, including a Prisma query.

**Alternatives considered:** `tsc` with project references and `rewriteRelativeImportExtensions` (more config in three packages); running `tsx` in production (an extra runtime dependency doing what Node already does).

---

## 2026-10-17 – Saving boards (Phase 4)

**What:** The Database extension loads `Board.state` in `fetch` and writes the full encoded Y.Doc in `store`, with `debounce: 2000` and `maxDebounce: 10000`. `store` uses `updateMany` with the board id instead of `update`.

**Why:**

- `updateMany` doesn't throw when the board is gone (deleted from the dashboard while someone still had it open). It reports `count: 0`, and we log it instead of crashing the save.
- The top bar's "Saving…" / "Saved" follows the provider's unsynced-changes counter. So "Saved" means the sync server has received every change, and the database write follows within the debounce window. That's what PLAN task 4.5 asks for, and it's the honest signal the client has. The client can't see the database write itself.

**Verified:** 400 writes over a 17-second simulated drag produced 2 database saves (one at the 10 s max, one 2 s after the last write). Closing the last connection triggers a save within milliseconds. Board content survives a sync-server restart.

---

## 2026-10-17 – Permissions and share links (Phase 5)

**What:**

- `GET /api/ws-token?boardId=` signs a 5-minute HS256 JWT (`jose`) with `{ sub, name, boardId, role }`. The provider's `token` option is an async function, so every reconnect fetches a fresh one.
- The sync server's `auth` extension checks the `Origin` header in `onConnect`, then verifies the JWT in `onAuthenticate`, checks `boardId === documentName`, and sets `connectionConfig.readOnly = true` for viewers. Hocuspocus 4.7 then refuses every update from that connection (verified: a viewer writing directly into its Y.Doc changed nothing for other users or in Postgres).
- The token schema (`WsTokenSchema`) lives in `packages/shared`, so both apps agree on the claims.
- `/join/[token]` upserts the membership on page load (never downgrading an editor, never touching the owner) and redirects to the board.
- Viewers can pan and zoom (any drag pans) but can't select, draw, or use editing shortcuts.

**Why `onConnect` and not `onUpgrade` for the Origin check:** In Hocuspocus 4.7, an error thrown from `onUpgrade` is rethrown inside an async `upgrade` event handler, an unhandled rejection that can crash the process. `onConnect` rejects the connection cleanly. The socket is briefly open, but no document data is sent before `onAuthenticate` succeeds.

**Note on the join page:** joining happens on a `GET`. That's acceptable here because join links are only opened directly (never rendered as `<Link>`s that Next.js would prefetch).

---

## 2026-10-17 – Dev server reload loop (troubleshooting note)

After installing packages while `next dev` was stopped, the restarted dev server put every open page into a reload loop (a recompile and full reload every ~2.5 s, with the board never finishing loading). The fix was deleting `apps/web/.next` (Turbopack's persistent dev cache) and restarting. If the app ever keeps reloading in development, do that first.

---

## 2026-10-17 – Live cursors and presence (Phase 6)

**What:**

- Awareness carries `user: { id, name, color }` and `cursor: { x, y } | null` (world coordinates). The color is picked from a fixed list by a hash of the user id, so it's stable across sessions.
- Cursor updates are throttled to one per 50 ms with a trailing send, so the last position always goes out.
- `Cursors` renders one element per remote cursor. React only re-renders when cursors appear or disappear. Movement is done in a single `requestAnimationFrame` loop that eases each cursor toward its target in **world** space, then converts to screen space with this window's camera. That's why cursors stay aligned when two windows have different zoom and pan.
- Avatars show one circle per _user_ (several tabs of the same user count once), you first.
- `beforeunload` clears local awareness so closing a tab removes you right away. Hocuspocus's awareness timeout handles crashed clients.

**Verified:** a remote cursor lands exactly on its world point at 100% and at 250% zoom with a different pan, glides between positions, and disappears with its avatar about 70 ms after the other client leaves. Nothing presence-related appears in `doc.toJSON()` or in `Board.state`.

---

## 2026-10-17 – Offline support: no custom merge code (Phase 7)

**What:** `connectBoard` attaches `y-indexeddb` (one database per board, named `whiteboard-board-<id>`) to the same Y.Doc as the sync provider. The board shows as soon as _either_ IndexedDB or the server has loaded. On logout, every database with that prefix is deleted.

**Why there's no merge code:** Every edit is a Yjs update. Offline edits are applied to the local Y.Doc and saved to IndexedDB like any other. When the socket reconnects, Hocuspocus runs the normal Yjs sync handshake: each side sends its state vector, and the other replies with exactly the updates it's missing. The CRDT merges them the same way on every peer, regardless of order or duplicates. Different properties of the same shape both survive (one person's move and another's resize). Only the _same_ property edited in two places has a single winner, and it's the same winner everywhere.

**Verified:** Carol (offline) added a shape, moved shape S and recolored it red, while Alice (online) added a shape, moved S vertically and recolored it green. After the sync server was stopped and Carol's page reloaded, the board loaded from IndexedDB with her edits. After reconnecting, Carol's board and the saved server state were identical: both new shapes, Carol's `x`, Alice's `y`, and one color.

**Two details:**

- The provider also listens to the browser's `offline`/`online` events and disconnects/reconnects immediately. An open WebSocket can otherwise linger for a while after the network drops.
- A full page _refresh_ with the browser itself offline (DevTools → Offline) can't load the page at all without a service worker, which is out of scope (no PWA). What works is refreshing while the **sync server** is unreachable: the page loads from the web server and the board loads from IndexedDB.

---

## 2026-10-17 – Undo and redo (Phase 8)

**What:** One `Y.UndoManager` per board session (owners and editors only), scoped to `shapes` and `order`, tracking only `LOCAL_ORIGIN` with a 500 ms capture window. `beginGesture`/`endGesture` (in `lib/yjs/undo.ts`) bracket every drag and resize. They call `stopCapturing()` and lift the capture timeout for the duration of the gesture.

**Why the gesture helpers:** PLAN task 8.3 suggests relying on the 500 ms window to merge a drag's throttled writes. But a drag only writes while the pointer moves, so a user who pauses for more than half a second mid-drag would get _two_ undo steps. Lifting the timeout until the gesture ends guarantees one step for the whole drag, however long it takes. `stopCapturing()` at both ends keeps it from merging with the edit before or after.

**Why it never undoes other people:** Remote updates are applied with the provider as their origin, not `LOCAL_ORIGIN`, so the manager never records them. Undo and redo run as ordinary transactions and sync to everyone like any other edit.

**Verified:** a real mouse drag undoes in one step and redoes; recoloring three shapes undoes in one step; when Alice adds a shape and recolors Carol's new rectangle, Carol's undo removes only her rectangle, Alice's shape stays, and both boards end up identical. Covered by `lib/yjs/undo.test.ts` (5 tests).
