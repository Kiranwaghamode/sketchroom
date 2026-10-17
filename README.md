# Whiteboard

A minimal whiteboard where people draw **together, in real time**, even while offline.

**Live demo:** _coming soon (link added after deployment)_ · click **Try the demo** on the login page, or log in as `demo@whiteboard.dev`.

![Two windows editing the same board](docs/demo.gif)
<!-- Placeholder: record two browser windows editing the same board and save it as docs/demo.gif -->

## Features

1. Sign up and log in with email and password.
2. See your boards. Create, rename and delete them.
3. Draw rectangles, ellipses, text and freehand pen strokes. Select, move, resize, recolor and delete shapes. Pan and zoom.
4. Share a board with a link: **Can edit** or **Can view**.
5. See other people's changes instantly, with their **cursors and names** and **who is online**.
6. Keep drawing **offline**. Changes merge automatically when you're back.
7. **Undo and redo** your own changes without undoing anyone else's.
8. **Save versions** of a board and **restore** them later.

## Architecture

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

### How sync works

- **A board is a Yjs document (a CRDT).** Each shape is a `Y.Map` with one key per property, plus a `Y.Array` for the drawing order. Two people changing _different_ properties of the same shape (one moves it, one recolors it) both keep their change. Two people changing the _same_ property end up with the same single value everywhere.
- **The sync server** (Hocuspocus) keeps one in-memory document per board and relays binary updates between everyone in the room. It saves the whole document to Postgres as one `Board.state` column, after 2 s of quiet and at least every 10 s while people keep editing.
- **Permissions:** the browser gets a 5-minute JWT from `GET /api/ws-token` (only if it has access to the board). The sync server verifies it, checks it's for this board, and makes viewers **read-only on the server**, so a viewer can't change anything even with modified client code.
- **Offline:** each board is also stored in the browser (IndexedDB). On reconnect, the Yjs handshake exchanges exactly what each side is missing, so there's no custom merge code.
- **Presence** (cursors, who's online) uses Yjs _awareness_. It's never stored in the document or the database.
- **Undo** tracks only your own local changes. **Restoring a version** applies the difference as a new edit: you can't overwrite a CRDT's stored state, because connected clients would merge the newer state right back.

More detail: [`docs/decisions.md`](docs/decisions.md).

## Tech stack

pnpm workspaces · Next.js 16 (App Router, server actions) · Tailwind CSS + shadcn/ui + lucide-react + sonner · react-konva + perfect-freehand · zustand · Yjs + Hocuspocus (server, provider, database extension) · y-indexeddb · PostgreSQL (Neon) + Prisma 7 · Better Auth · jose · zod · nanoid · vitest + Playwright

```
apps/web        Next.js app (pages, auth, server actions, canvas)
apps/sync       Hocuspocus sync server (WebSockets, auth, persistence)
packages/db     Prisma schema + client, shared by both apps
packages/shared Shape schema, colors, token schema
e2e             Playwright test
```

## Run it locally

You need **Node 24+**, **pnpm 9** (`corepack enable`), and a **PostgreSQL** database: a free [Neon](https://neon.tech) project or a local Postgres.

```bash
git clone <this repo> && cd whiteboard
pnpm install
```

Create three `.env` files from [`.env.example`](.env.example):

| File               | Variables                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/.env` | `DATABASE_URL`                                                                                                                                              |
| `apps/web/.env`    | `DATABASE_URL`, `WS_JWT_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`, `NEXT_PUBLIC_SYNC_URL=ws://localhost:1234`, `DEMO_PASSWORD` |
| `apps/sync/.env`   | `DATABASE_URL`, `WS_JWT_SECRET` (same value as web), `PORT=1234`, `ALLOWED_ORIGIN=http://localhost:3000`                                                    |

Generate the secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. For Neon, use the **direct** (not `-pooler`) connection string and `sslmode=verify-full`.

```bash
pnpm db:migrate   # create the tables
pnpm db:seed      # demo@whiteboard.dev and friend@whiteboard.dev (password: DEMO_PASSWORD), sharing "Demo board"
pnpm dev          # web on http://localhost:3000, sync server on ws://localhost:1234
```

Open http://localhost:3000 and click **Try the demo**, or sign up. To see real-time editing, open the board in a second browser (or a private window) logged in as another user.

### Useful scripts

| Command                        | What it does                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                     | Web app and sync server with hot reload                                                                                                                                               |
| `pnpm test`                    | Unit tests (vitest): mutations, undo, restore, CRDT convergence                                                                                                                       |
| `pnpm test:e2e`                | Playwright: two users editing the same board, including offline. Needs `pnpm db:seed` first; starts `pnpm dev` if it isn't running. Run `pnpm exec playwright install chromium` once. |
| `pnpm typecheck` / `pnpm lint` | Type-check and lint every package (also run in CI)                                                                                                                                    |
| `pnpm db:studio`               | Browse the database                                                                                                                                                                   |

If the app keeps reloading in development, stop `pnpm dev`, delete `apps/web/.next`, and start it again.

## Deploy

- **Postgres → Neon:** run `pnpm --filter @whiteboard/db exec prisma migrate deploy` with the production `DATABASE_URL` (direct connection).
- **Sync server → Railway or Fly.io:** build `apps/sync/Dockerfile` with the **repo root** as the build context. Set `DATABASE_URL`, `WS_JWT_SECRET`, `ALLOWED_ORIGIN` (your web URL) and optionally `MAX_CONNECTIONS_PER_IP` (default 20). It must be reachable over `wss://`.
- **Web → Vercel:** root directory `apps/web`. Set `DATABASE_URL` (Neon's **pooled** connection string works best on serverless), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (your Vercel URL), `WS_JWT_SECRET` (same as the sync server), `NEXT_PUBLIC_SYNC_URL=wss://…`, and `DEMO_PASSWORD`.
- Seed the demo users in production: `pnpm db:seed` with the production `apps/web` variables.

## Key decisions

Why a separate sync server, why Hocuspocus, why there's no merge code, why restore moves forward instead of overwriting, and more: [`docs/decisions.md`](docs/decisions.md).
