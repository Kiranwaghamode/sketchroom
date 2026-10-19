# PLAN2.md: Add Collaborative Documents (Google Docs–style) to the Whiteboard App

> **For Claude Code:** This project is an **existing, working** real-time collaborative whiteboard. This plan adds a second feature: **collaborative documents**, where several people edit the same text document at the same time, like Google Docs.
>
> Read this whole file before you start. Follow it phase by phase. Keep the **Progress Tracker** below up to date. It's the single source of truth for how much of this feature is done.

---

## 0. How to work with this plan (read first)

### 0.1 Rules for Claude Code

1. **The whiteboard must keep working.** This is an addition, not a rewrite. Don't change existing whiteboard behavior. After every phase, check that boards still work (create, draw, sync, share, offline, undo, history).
2. **Reuse, don't duplicate.** The whiteboard already has a sync server, auth, permissions, share links, persistence, presence, offline support and version history. Documents must **reuse** these. Make small changes to existing code (for example, generalizing a function to accept a document) instead of copying it.
3. **Work one phase at a time, in order.** Don't start a phase until the previous phase's "Done when" checks all pass.
4. **Plan first, then code.** At the start of each phase, write a short plan (files to create or change, approach), then build it.
5. **Update the checklist as you go.**
   - When you finish a task, change its `- [ ]` to `- [x]` **in this file** right away.
   - While working on a phase, set its status in the **Progress Tracker** to `🔄 In progress`.
   - When every task and "Done when" check in a phase passes, set it to `✅ Done`, fill in the date, and update the overall percentage.
   - Update the **Current status** line every time you finish a task.
   - Add one line per finished phase to the **Progress Log** at the bottom.
6. **Stop after each phase.** Summarize what was built, how to test it by hand, and anything not done. Then wait for the user to say "continue" before starting the next phase.
7. **MVP only.** Build only what this plan lists. If something isn't in this plan, don't build it. If something seems missing, ask the user. See section 3, "Out of scope".
8. **Keep the design minimal.** It should look like a clean, quiet writing page, consistent with the existing app's style. No new UI libraries.
9. **Check library APIs against the installed version.** Tiptap, Yjs and Hocuspocus APIs change between major versions (see section 2.2). Before you use an API, check the installed package's types or docs. Don't rely on memory.
10. **Never commit secrets.** Commit after each phase with a message like `docs phase 3: real-time sync for documents`.
11. **Record decisions.** Add short entries to `docs/decisions.md` for non-obvious choices.
12. **If the existing project has a `PLAN.md`,** read it to learn the project's conventions, but **don't edit** its checklist. Track this feature only in this file.

### 0.2 Definitions

- **Board:** an existing whiteboard (shapes on a canvas).
- **Document (doc):** the new text document, edited together in real time.
- **Item:** either a board or a document (what the dashboard lists).
- **Y.Doc:** the Yjs document holding the content. For a document, the text lives in a `Y.XmlFragment` named `"content"`.
- **Sync server:** the existing Hocuspocus WebSocket server.

---

## Progress Tracker

**Current status:** Phase 3 done. Next: Phase 4.

**Overall progress:** 4 / 10 phases complete (40%)

| # | Phase | Status | Completed on |
|---|-------|--------|--------------|
| 0 | Audit the existing project | ✅ Done | 2026-10-19 |
| 1 | Data model and dashboard | ✅ Done | 2026-10-19 |
| 2 | Document editor (single user, data in Yjs) | ✅ Done | 2026-10-19 |
| 3 | Real-time sync | ✅ Done | 2026-10-19 |
| 4 | Live cursors and who's online | ⬜ Not started | — |
| 5 | Permissions and share links | ⬜ Not started | — |
| 6 | Offline support | ⬜ Not started | — |
| 7 | Undo and redo | ⬜ Not started | — |
| 8 | Version history (save and restore) | ⬜ Not started | — |
| 9 | Tests, README and final check | ⬜ Not started | — |

Status values: `⬜ Not started` · `🔄 In progress` · `✅ Done`

---

## 1. Feature summary

**What the user can do (the complete feature list for this MVP):**

1. From the dashboard, create a **new document** next to new boards. Rename, delete or leave documents just like boards.
2. Open a document and write with **basic formatting**: Heading 1, Heading 2, paragraph, **bold**, *italic*, bullet list, numbered list.
3. Edit **at the same time** as other people. Everyone sees each other's typing instantly, and no text is ever lost or overwritten.
4. See **other people's cursors and selections** in the text, labeled with their names, and **who is online**.
5. Share a document with an **"Can edit"** or **"Can view"** link. Viewers can read but not type, and the server enforces this.
6. Keep writing **while offline**. Changes merge automatically on reconnect.
7. **Undo and redo** only their own changes.
8. **Save a version** and **restore** it later.

### 1.1 Design principles (very important)

Keep it **minimal, calm and obvious**, and visually consistent with the existing whiteboard UI (same top bar style, same shadcn/ui components, same colors).

- **Document page layout:**
  - **Top bar:** reuse the board top bar. It has ← back to dashboard · document title (click to rename) · connection dot · "Saved"/"Saving…" · online avatars · **Share** · **History**.
  - **Formatting toolbar:** one slim row, sticky under the top bar: `H1` `H2` `B` `I` · bullet list · numbered list · Undo · Redo. Each button has a tooltip with its shortcut and shows when it's active (for example, Bold is highlighted when the cursor is in bold text).
  - **Writing area:** a white page, centered, **max width about 720px**, comfortable line height (around 1.7), generous padding. Placeholder on an empty doc: "Start writing…".
  - Nothing else on screen: no sidebars, no word count, no outline.
- **Markdown-style shortcuts** work as you type (StarterKit includes them): `# ` → H1, `## ` → H2, `- ` → bullet list, `1. ` → numbered list, `**bold**`, `*italic*`.
- **Dashboard:** the **New board** button becomes a **New** dropdown with "Board" and "Document". Each card shows a small icon (lucide `PenTool` for boards, `FileText` for documents). No filters or tabs. One mixed list sorted by last edited.
- Plain, friendly text everywhere ("Can edit", "Can view", "You're offline – changes will sync when you're back online").

---

## 2. Tech stack

### 2.1 Reuse (already in the project)

Next.js (App Router) · TypeScript · Tailwind + shadcn/ui · lucide-react · sonner · zustand · **yjs** · **@hocuspocus/provider** · **@hocuspocus/server** + database extension · **y-indexeddb** · Prisma + PostgreSQL · better-auth · jose · zod · nanoid · vitest · Playwright.

### 2.2 Add (only these)

| Package | Purpose |
|---------|---------|
| `@tiptap/react` | The editor component and React hooks |
| `@tiptap/pm` | ProseMirror dependencies required by Tiptap |
| `@tiptap/starter-kit` | Headings, bold, italic, lists, paragraphs and markdown shortcuts. Turn off what isn't needed (see Phase 2) |
| `@tiptap/extension-collaboration` | Connects the editor to a Yjs `Y.XmlFragment` (character-level merging and collaborative undo) |
| Tiptap collaboration caret extension | Shows other users' cursors and selections with names. **Tiptap v3:** `@tiptap/extension-collaboration-caret`. **Tiptap v2:** `@tiptap/extension-collaboration-cursor` |
| `@tiptap/extension-placeholder` (or the placeholder from `@tiptap/extensions` in v3) | "Start writing…" placeholder |

**Install all Tiptap packages at the same major version.** Also install any peer dependencies the Collaboration extension asks for in that version (for example a y-prosemirror / y-tiptap binding). Check its docs.

**Don't add** other editors (Lexical, Slate, Quill), other CRDT libraries, UI kits or state libraries.

### 2.3 Version-specific notes (check before using)

- **Turning off Tiptap's own history:** the Collaboration extension provides its own Yjs-based undo. Tiptap's built-in history **must be turned off** in StarterKit. In Tiptap v2 that's `StarterKit.configure({ history: false })`. In v3 it's `StarterKit.configure({ undoRedo: false })`. Check the installed version.
- **Next.js / SSR:** create the editor with `immediatelyRender: false` (or the installed version's equivalent) to avoid hydration errors. The editor page is a client component.
- **Never pass `content` to `useEditor`** for collaborative docs. The content always comes from the Y.Doc. Passing initial content duplicates text on every load.

---

## 3. Out of scope (do NOT build these)

- Comments, suggestions/track changes, mentions, reactions
- Tables, images, embeds, code blocks, blockquotes, horizontal rules, checklists, links
- Underline, strikethrough, text color, highlight, fonts, font sizes, alignment
- Page layout (pages, margins, headers/footers), print view
- Export to PDF, Word or Markdown, and import
- Word count, outline/table of contents, search and replace
- Version previews or diffs (only list + restore, like boards)
- AI writing features
- Embedding documents inside boards, or boards inside documents
- Folders, tags, favorites, dashboard filters
- Real-time collaborative editing of the **title** (the title is a normal database field, renamed like boards)

If the user later asks for any of these, add them as a new phase at the end.

---

## 4. Architecture (what changes)

```
 Browser                                          Sync server (EXISTING, mostly unchanged)
 ┌──────────────────────────────┐   WebSocket   ┌──────────────────────────────────┐
 │ /board/[id] → Konva canvas   │ ◄───────────► │ Hocuspocus                        │
 │ /doc/[id]   → Tiptap editor  │   Yjs updates │ room name = item id               │
 │   Y.Doc → Y.XmlFragment      │   + awareness │ onAuthenticate → same JWT check  │
 │   ("content")                │               │ Database ext → same Prisma load/  │
 │ IndexedDB offline copy       │               │ store of the item's `state` bytes │
 └──────────────┬───────────────┘               └───────────────┬──────────────────┘
                │ pages, server actions, /api/ws-token          │
                ▼                                               ▼
 ┌──────────────────────────────┐               ┌──────────────────────────────────┐
 │ Next.js (EXISTING)           │ ──Prisma───►  │ PostgreSQL (EXISTING tables +     │
 │ + doc routes and actions     │               │ a `kind` column: BOARD | DOC)     │
 └──────────────────────────────┘               └──────────────────────────────────┘
```

**Key ideas:**

- A document is **the same kind of thing** as a board for sync, auth, sharing, persistence and versions. Only the **content type** and **page** differ.
- The text lives in `doc.getXmlFragment('content')`. Tiptap's Collaboration extension binds the editor to it. Every keystroke becomes a small Yjs update, merged **character by character**, so simultaneous typing in the same paragraph never conflicts.
- Cursors and selections travel through **awareness**. They're never saved.

---

## PHASES

Each phase has a **Goal**, **Tasks** (tick them as you finish), and **Done when** checks that must pass before the phase is complete.

---

## Phase 0: Audit the existing project

**Goal:** understand the existing code before changing anything, and confirm the plan fits it.

**Tasks**
- [x] 0.1 Read the codebase and write `docs/docs-feature-audit.md`, listing:
  - the stack and versions actually installed (Next.js, yjs, Hocuspocus, Prisma, better-auth),
  - where each reusable piece lives: provider/connection setup, IndexedDB setup, WebSocket token route, sync server auth hook, persistence hook, access check (`getBoardRole` or equivalent), share links, join page, version save/restore, top bar, avatars, offline banner, connection status,
  - the current Prisma models for boards, members, share links and versions.
- [x] 0.2 **Confirm the sync technology.** If the whiteboard does **not** use Yjs + Hocuspocus, **stop**. Explain to the user what it uses instead and propose how to adapt this plan, then wait for their answer.
- [x] 0.3 Choose the data model approach (see Phase 1.1) based on the existing schema, and record the decision in `docs/decisions.md`.
- [x] 0.4 List the existing functions and components that need small generalizations to support documents (for example, `getBoardRole` → `getItemRole`, `connectBoard` → `connectItem`) and how you'll change them without breaking boards.
- [x] 0.5 Run the existing tests and note the results, so later regressions are easy to spot.

**Done when**
- [x] `docs/docs-feature-audit.md` exists and the user has seen the summary.
- [x] Existing tests pass (or existing failures are written down).

---

## Phase 1: Data model and dashboard

**Goal:** documents exist in the database and can be created, listed, renamed, deleted and opened (empty page for now).

**Tasks**
- [x] 1.1 **Data model.** Preferred approach (use it unless the audit showed a clear reason not to):
  - Add an enum `ItemKind { BOARD DOC }` and a column `kind ItemKind @default(BOARD)` to the existing `Board` model, so members, share links, versions and the binary `state` column are **reused unchanged**.
  - Existing rows automatically become `BOARD`.
  - Write a migration and check that it doesn't change or lose existing data.
  - Note in `docs/decisions.md` that the table is still called `Board` for compatibility, even though it now holds documents too. **Don't rename the table** in this MVP.
  - If the existing schema makes this impossible, choose the approach that reuses the most existing code, and explain why in the decisions file.
- [x] 1.2 Generalize the access check so it works for both kinds (for example, `getItemRole(userId, itemId)`). Boards behave exactly as before.
- [x] 1.3 Server action `createDocument()` creates an item with `kind: DOC`, title "Untitled document", owned by the current user, then redirects to `/doc/[id]`.
- [x] 1.4 The existing rename, delete and leave actions must work for documents too. Reuse them and check that they don't assume `kind: BOARD`.
- [x] 1.5 **Dashboard:**
  - Replace **New board** with a **New** dropdown: "Board" and "Document".
  - Cards show a `PenTool` icon (board) or a `FileText` icon (document) next to the title.
  - Clicking a card opens `/board/[id]` or `/doc/[id]` depending on `kind`.
  - Empty state text: "Nothing here yet" + the **New** dropdown.
- [x] 1.6 Route guards:
  - `/doc/[id]`: server component that checks access and that `kind === DOC`, otherwise `notFound()`.
  - `/board/[id]`: add a check that `kind === BOARD`, otherwise `notFound()`.
  - Add `/doc/*` to the middleware's protected routes.
- [x] 1.7 The `/doc/[id]` page renders the reused top bar with the title and a placeholder "Editor coming soon".

**Done when**
- [x] I can create, rename, delete and open documents from the dashboard.
- [x] Opening a document's id under `/board/...` (or the other way around) shows a 404.
- [x] Existing boards still appear, open and work exactly as before.

---

## Phase 2: Document editor (single user, data in Yjs)

**Goal:** a clean, working text editor for one person, where the content **already lives in a Y.Doc**, so adding real-time sync in Phase 3 takes only a few lines.

**Tasks**
- [x] 2.1 Install the Tiptap packages from section 2.2 (same major version).
- [x] 2.2 `lib/yjs/doc-schema.ts`: `createDocumentYDoc()` returns `{ doc, fragment: doc.getXmlFragment('content') }`.
- [x] 2.3 `components/doc/DocEditor.tsx` (client component), using `useEditor` with:
  - `StarterKit` configured to keep **only**: document, paragraph, text, heading (levels 1 and 2 only), bold, italic, bulletList, orderedList, listItem, hardBreak. **Turn off:** history/undoRedo (required, see 2.3 of section 2), blockquote, codeBlock, code, horizontalRule, strike, and anything else not listed. Check the option names in the installed version.
  - `Collaboration.configure({ document: doc, field: 'content' })` (or `fragment`, depending on the version).
  - Placeholder: "Start writing…".
  - `immediatelyRender: false`. **No `content` option.**
- [x] 2.4 Styling (Tailwind, in a `.doc-content` class): centered column, max width about 720px, padding 48px top, base font size 16–17px, line height about 1.7, clear H1/H2 sizes, normal list indentation, visible placeholder in gray. White page on a very light gray background. Focus the editor when the page opens.
- [x] 2.5 `components/doc/DocToolbar.tsx`: slim sticky row under the top bar with buttons `H1`, `H2`, **B**, *I*, bullet list, numbered list. Each button:
  - runs the matching editor command (`toggleHeading({ level: 1 })`, `toggleBold()`, and so on),
  - shows as active when `editor.isActive(...)` is true,
  - has a tooltip with its shortcut (Ctrl/⌘+B, Ctrl/⌘+I, Ctrl/⌘+Alt+1, Ctrl/⌘+Alt+2, Ctrl/⌘+Shift+8, Ctrl/⌘+Shift+7).
  Undo and Redo buttons are added in Phase 7.
- [x] 2.6 Check that markdown shortcuts work: `# `, `## `, `- `, `1. `, `**text**`, `*text*`.
- [x] 2.7 Unit test (vitest): creating the Y.Doc and inserting text into the fragment gives the expected `toJSON()` / text.

**Done when**
- [x] I can write and format text with every toolbar button and shortcut.
- [x] Logging `doc.getXmlFragment('content').toString()` shows my text and formatting.
- [x] No hydration warnings in the browser console.

---

## Phase 3: Real-time sync

**Goal:** two windows on the same document see each other's typing instantly, with no lost or duplicated text.

**Tasks**
- [x] 3.1 Generalize the existing connection helper (for example, `connectBoard` → `connectItem(itemId, doc)`) so it works for documents. Boards must still use it unchanged. The room name stays the **item id**.
- [x] 3.2 Create the Y.Doc and provider **once** per document page in a client component (`DocClient`) and destroy both on unmount. Handle React Strict Mode running effects twice, the same way the board page does.
- [x] 3.3 Create the editor only **after** the Y.Doc exists. Show a light "Loading document…" until the first sync (Phase 6 changes this to show IndexedDB content first).
- [x] 3.4 **Sync server:** check that the existing persistence (fetch/store of `state`) and auth work for documents without changes. If the auth hook checks that the item is a board, update it to allow both kinds.
- [x] 3.5 `/api/ws-token`: make sure it issues tokens for documents too (using the generalized access check).
- [x] 3.6 Reuse the connection dot and "Saved"/"Saving…" indicator in the document top bar.
- [x] 3.7 Make sure `Board.updatedAt` (the item's `updatedAt`) changes when document content is saved, so the dashboard's "Edited …" stays correct.

**Done when**
- [x] Two windows typing **in the same paragraph at the same time** both see the same final text, and no characters are lost.
- [x] Formatting changes (bold, headings, lists) sync both ways.
- [x] Close every tab, restart the sync server, and reopen the document: the content is still there.
- [x] Opening the document never duplicates its content.
- [x] Boards still sync as before.

---

## Phase 4: Live cursors and who's online

**Goal:** see where other people are typing, and who is in the document.

**Tasks**
- [ ] 4.1 Add the collaboration caret extension (section 2.2) with `provider` and `user: { name, color }`. Use the **same** name and color logic the whiteboard uses for awareness, so a user has the same color everywhere.
- [ ] 4.2 Style the carets minimally: a 2px colored line, a small name label above it in the user's color with white text, and a light (about 20% opacity) background on selected text.
- [ ] 4.3 Reuse the **Avatars** component in the top bar for documents (it reads the same awareness `user` field).
- [ ] 4.4 Make sure leaving the page clears this user's awareness state (same as boards).

**Done when**
- [ ] With two windows open, each shows the other's caret with their name, moving as they type.
- [ ] Selecting text in one window highlights it in the other in that user's color.
- [ ] Closing a tab removes its caret and avatar within a few seconds.
- [ ] Nothing about cursors is stored in the Y.Doc or the database.

---

## Phase 5: Permissions and share links

**Goal:** sharing works for documents exactly as for boards, and viewers can't edit.

**Tasks**
- [ ] 5.1 Reuse the **Share** dialog for documents (wording: "Anyone with the link can edit / view this document").
- [ ] 5.2 The `/join/[token]` page must redirect to `/doc/[id]` or `/board/[id]` depending on `kind`.
- [ ] 5.3 **Viewer mode in the editor:** `editor.setEditable(false)`, hide the formatting toolbar, show the existing "View only" badge. The server read-only connection (existing auth hook) is the real protection.
- [ ] 5.4 Viewers still see other people's carets and the online avatars.

**Done when**
- [ ] An edit link opened by another user in a private window allows typing. A view link allows reading only.
- [ ] A viewer's change made manually in DevTools doesn't reach other users or the database.
- [ ] **Reset links** works for documents.
- [ ] Board sharing still works as before.

---

## Phase 6: Offline support

**Goal:** writing keeps working without internet, and changes merge on reconnect.

**Tasks**
- [ ] 6.1 Make sure the generalized connection helper also sets up **y-indexeddb** for documents (it should come from the board setup automatically).
- [ ] 6.2 Show the editor as soon as **either** IndexedDB has loaded **or** the provider has synced, whichever comes first.
- [ ] 6.3 Reuse the offline banner and the "Back online" toast.
- [ ] 6.4 Make sure logging out also clears IndexedDB data for documents.

**Done when**
- [ ] With DevTools set to Offline, I can keep typing, and a refresh while offline still shows my text.
- [ ] Two windows edit the same paragraph while one is offline. After reconnecting, both show the same text containing **both** people's words.
- [ ] A document I've opened before appears instantly.

---

## Phase 7: Undo and redo

**Goal:** Ctrl/⌘+Z undoes **only your own** typing and formatting.

**Tasks**
- [ ] 7.1 Confirm Tiptap's built-in history is **off** (Phase 2.3) and the Collaboration extension's Yjs undo is active.
- [ ] 7.2 Add **Undo** and **Redo** buttons to the right end of the formatting toolbar, using the Collaboration extension's `undo()` / `redo()` commands. Disable them when there's nothing to undo or redo (`editor.can().undo()` / `can().redo()`).
- [ ] 7.3 Shortcuts: Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl/⌘+Y. These come from the extension, so check them.
- [ ] 7.4 Viewers: no undo or redo buttons.

**Done when**
- [ ] Alice and Bob type in the same paragraph. Alice's undo removes only Alice's words.
- [ ] Undo and redo sync to the other window like normal edits.
- [ ] Undo works naturally (word or phrase chunks, not one letter at a time).

---

## Phase 8: Version history (save and restore)

**Goal:** save versions of a document and restore one safely, even while others are editing.

**Tasks**
- [ ] 8.1 Reuse the existing **save version** server action and the **History** dialog for documents (list, names, who saved, relative time, Restore button with confirm dialog). The stored state is the full Y.Doc, the same as for boards.
- [ ] 8.2 `lib/yjs/doc-restore.ts`, **restore by moving forward. Never overwrite the stored `state` directly.**
  1. **Before restoring, save the current content automatically** as a version named "Before restore" (simple safety net).
  2. Load the chosen version's state into a **temporary** `Y.Doc` with `Y.applyUpdate`, and get its `content` fragment.
  3. In **one** `doc.transact(...)` on the live doc: delete all children of the live `content` fragment, then insert **clones** of the temporary fragment's children (`child.clone()`) in order.
  4. It syncs to everyone like a normal edit.
  5. Optional (only if simple in the installed version): register the restore's transaction origin with the editor's Yjs UndoManager (`addTrackedOrigin`) so one undo reverts the restore. If it's not simple, skip it. The "Before restore" version is enough for the MVP.
- [ ] 8.3 After restoring, show the toast "Version restored" and keep the editor focused.
- [ ] 8.4 vitest tests for `doc-restore.ts`: after a restore, the live fragment's `toString()` equals the version's. Cover a version with headings, lists, bold and italic. Check that a "Before restore" version was created.
- [ ] 8.5 Note in `docs/decisions.md`: why restoring replaces the fragment content in one transaction instead of overwriting the database (connected clients would merge newer content back in).

**Done when**
- [ ] Save a version, change a lot, restore: the document looks exactly like the saved version.
- [ ] Restoring while another window is open updates that window too, and the restore isn't undone by the other window's sync.
- [ ] The "Before restore" version appears in the list and can itself be restored.
- [ ] Board version history still works.

---

## Phase 9: Tests, README and final check

**Goal:** the feature is tested, documented and works in production alongside boards.

**Tasks**
- [ ] 9.1 **Convergence test (vitest):** two Y.Docs, each inserting and deleting text at random positions in a `Y.XmlFragment` (or `Y.Text` inside it). Exchange updates in random order (including duplicates) and check that both docs end up with the same `toString()`. Run with a few random seeds.
- [ ] 9.2 **Playwright end-to-end test** (`e2e/docs-collab.spec.ts`) with two browser contexts, two seeded users, one shared document:
  - User A types "Hello" → user B sees "Hello".
  - Both type at the same time in the same paragraph → both see the same final text containing both inputs.
  - User B makes a word bold → user A sees it bold.
  - `contextA.setOffline(true)`, A types a sentence, `setOffline(false)` → B sees it.
  - A viewer (view link) can't type.
- [ ] 9.3 Run the **whole** test suite (boards + documents) locally and in CI.
- [ ] 9.4 Seed a demo document for the demo user, with a heading, a short paragraph and a list.
- [ ] 9.5 Deploy (same services as before; no new infrastructure). Check that both boards and documents work in production.
- [ ] 9.6 **README:** add "Collaborative documents" to the feature list, a short "How document sync works" section (Tiptap → Yjs XmlFragment → Hocuspocus → Postgres; character-level merging; carets via awareness), and the new packages to the tech stack. Leave a placeholder for a GIF of two people typing together.
- [ ] 9.7 Delete `docs/docs-feature-audit.md` or move its useful parts into `docs/decisions.md`.

**Done when**
- [ ] All unit and end-to-end tests pass locally. CI is green.
- [ ] In production: create a document, share an edit link, two people type together with visible carets, offline works, undo works, and restore works.
- [ ] Boards still work fully in production.

---

## Final acceptance checklist

Check these at the very end, on the deployed app:

- [ ] Dashboard: **New → Board / Document**. Both show the right icon and open the right page.
- [ ] Write with H1, H2, bold, italic, bullet and numbered lists, using buttons, shortcuts and markdown shortcuts.
- [ ] Two or more users edit the same document at the same time, and no text is lost or duplicated.
- [ ] Live carets with names, selection highlights, and online avatars.
- [ ] Edit and view links work, and viewers can't type (enforced by the server).
- [ ] Offline writing works and merges on reconnect.
- [ ] Undo and redo affect only your own changes.
- [ ] Save and restore versions works with multiple users connected.
- [ ] The UI is minimal: top bar, one slim formatting toolbar, centered page, Share and History dialogs. Nothing else.
- [ ] **All whiteboard features still work exactly as before.**

---

## Progress Log

> Claude Code: add one line here each time a phase is completed.
> Format: `YYYY-MM-DD – Phase N complete – short summary – notes or known issues`

- 2026-10-19 – Phase 0 complete – audit in docs/docs-feature-audit.md; Yjs + Hocuspocus confirmed; `kind` column chosen – baseline: 23 unit tests + 1 e2e pass (after re-seeding "Demo board")
- 2026-10-19 – Phase 1 complete – ItemKind/kind column + migration, getItemRole, createDocument, New dropdown with icons, /doc/[id] placeholder, cross-kind 404s, join redirects by kind – leave for documents verified in Phase 5 (needs a shared doc)
- 2026-10-19 – Phase 2 complete – Tiptap 3.32 editor bound to Y.XmlFragment "content", slim toolbar with active states and shortcut tooltips, markdown shortcuts verified, doc-schema tests – the existing dev-only Next "instant" validation message on /login and /dashboard is unrelated
- 2026-10-19 – Phase 3 complete – connectItem/clearLocalItems, DocClient with provider + IndexedDB, status dot and Saved/Saving…, sync server unchanged – verified simultaneous typing, formatting sync, no duplication on reload, persistence across a sync-server restart
