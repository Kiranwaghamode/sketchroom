"use server";

import { prisma } from "@whiteboard/db";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getBoardRole } from "@/lib/access";
import { requireUser } from "@/lib/auth";

const BoardIdSchema = z.string().min(1).max(64);
const LinkRoleSchema = z.enum(["EDITOR", "VIEWER"]);

type LinkResult = { error: string } | { path: string };

async function requireOwner(boardId: string) {
  const user = await requireUser();
  const id = BoardIdSchema.safeParse(boardId);
  if (!id.success || (await getBoardRole(user.id, id.data)) !== "OWNER")
    return null;
  return id.data;
}

/** Returns the board's edit or view link, creating it the first time. Owner only. */
export async function getOrCreateShareLink(
  boardId: string,
  role: string,
): Promise<LinkResult> {
  const id = await requireOwner(boardId);
  const parsedRole = LinkRoleSchema.safeParse(role);
  if (!id || !parsedRole.success)
    return { error: "Only the owner can share this board" };

  const link = await prisma.shareLink.upsert({
    where: { boardId_role: { boardId: id, role: parsedRole.data } },
    create: { token: nanoid(21), boardId: id, role: parsedRole.data },
    update: {},
    select: { token: true },
  });
  return { path: `/join/${link.token}` };
}

/** Deletes both links so old ones stop working. People who already joined keep access. */
export async function resetShareLinks(
  boardId: string,
): Promise<{ error: string } | { ok: true }> {
  const id = await requireOwner(boardId);
  if (!id) return { error: "Only the owner can reset links" };
  await prisma.shareLink.deleteMany({ where: { boardId: id } });
  return { ok: true };
}
