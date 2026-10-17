// Seeds two demo users who share one board:
//   demo@whiteboard.dev   (owner of "Demo board", used by "Try the demo")
//   friend@whiteboard.dev (editor on "Demo board", used by the end-to-end test)
// Both use DEMO_PASSWORD. Run with `pnpm db:seed` from the repo root. Safe to run more than once.
import { prisma } from "@whiteboard/db";
import { auth } from "../lib/auth";

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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
