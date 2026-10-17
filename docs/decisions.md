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
