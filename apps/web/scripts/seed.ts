// Seeds a demo user (demo@whiteboard.dev / DEMO_PASSWORD) with one board.
// Run with `pnpm db:seed` from the repo root. Safe to run more than once.
import { prisma } from "@whiteboard/db";
import { auth } from "../lib/auth";

const DEMO_EMAIL = "demo@whiteboard.dev";

async function main() {
  const password = process.env["DEMO_PASSWORD"];
  if (!password) throw new Error("DEMO_PASSWORD is not set");

  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    // Use Better Auth's own sign-up so the password is hashed the way it expects.
    await auth.api.signUpEmail({
      body: { name: "Demo User", email: DEMO_EMAIL, password },
    });
    user = await prisma.user.findUniqueOrThrow({
      where: { email: DEMO_EMAIL },
    });
    console.log(`Created ${DEMO_EMAIL}`);
  } else {
    console.log(`${DEMO_EMAIL} already exists`);
  }

  const boards = await prisma.board.count({ where: { ownerId: user.id } });
  if (boards === 0) {
    await prisma.board.create({
      data: { ownerId: user.id, title: "Demo board" },
    });
    console.log("Created Demo board");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
