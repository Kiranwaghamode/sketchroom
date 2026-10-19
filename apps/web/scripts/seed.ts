// Seeds two demo users who share one board and one document:
//   demo@whiteboard.dev   (owner of "Demo board" and "Demo document", used by "Try the demo")
//   friend@whiteboard.dev (editor on both, used by the end-to-end tests)
// Both use DEMO_PASSWORD. Run with `pnpm db:seed` from the repo root. Safe to run more than once.
import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap";
import { prisma } from "@whiteboard/db";
import * as Y from "yjs";
import { auth } from "../lib/auth";
import { documentStarterKit } from "../lib/doc-extensions";
import { DOC_FIELD } from "../lib/yjs/doc-schema";

/** The demo document's content, built with the editor's own schema. */
function demoDocumentState() {
  const text = (value: string, marks?: { type: string }[]) => ({
    type: "text",
    text: value,
    ...(marks && { marks }),
  });
  const item = (value: string) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: [text(value)] }],
  });
  const json = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [text("Welcome to documents")],
      },
      {
        type: "paragraph",
        content: [
          text("Write together in real time. Everyone's cursor shows up with "),
          text("their name", [{ type: "bold" }]),
          text(", and edits merge "),
          text("character by character", [{ type: "italic" }]),
          text("."),
        ],
      },
      {
        type: "bulletList",
        content: [
          item("Share it with a “Can edit” or “Can view” link"),
          item("Keep writing offline; it syncs when you're back"),
          item("Save a version in History and restore it any time"),
        ],
      },
    ],
  };
  const doc = prosemirrorJSONToYDoc(
    getSchema([documentStarterKit]),
    json,
    DOC_FIELD,
  );
  return new Uint8Array(Y.encodeStateAsUpdate(doc));
}

async function ensureUser(email: string, name: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${email} already exists`);
    return existing;
  }
  // Use Better Auth's own sign-up so the password is hashed the way it expects.
  await auth.api.signUpEmail({ body: { name, email, password } });
  console.log(`Created ${email}`);
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

async function main() {
  const password = process.env["DEMO_PASSWORD"];
  if (!password) throw new Error("DEMO_PASSWORD is not set");

  const demo = await ensureUser("demo@whiteboard.dev", "Demo User", password);
  const friend = await ensureUser(
    "friend@whiteboard.dev",
    "Demo Friend",
    password,
  );

  let board = await prisma.board.findFirst({
    where: { ownerId: demo.id, title: "Demo board" },
  });
  if (!board) {
    board = await prisma.board.create({
      data: { ownerId: demo.id, title: "Demo board" },
    });
    console.log("Created Demo board");
  }
  await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId: board.id, userId: friend.id } },
    create: { boardId: board.id, userId: friend.id, role: "EDITOR" },
    update: { role: "EDITOR" },
  });
  console.log(`Demo board: ${board.id} (friend@whiteboard.dev can edit)`);

  let document = await prisma.board.findFirst({
    where: { ownerId: demo.id, kind: "DOC", title: "Demo document" },
  });
  if (!document) {
    document = await prisma.board.create({
      data: {
        ownerId: demo.id,
        kind: "DOC",
        title: "Demo document",
        state: demoDocumentState(),
      },
    });
    console.log("Created Demo document");
  }
  await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId: document.id, userId: friend.id } },
    create: { boardId: document.id, userId: friend.id, role: "EDITOR" },
    update: { role: "EDITOR" },
  });
  console.log(`Demo document: ${document.id} (friend@whiteboard.dev can edit)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
