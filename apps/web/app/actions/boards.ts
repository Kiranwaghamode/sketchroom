"use server";

import { prisma } from "@whiteboard/db";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const BoardIdSchema = z.string().min(1).max(64);
const TitleSchema = z
  .string()
  .trim()
  .min(1, "Title can't be empty")
  .max(80, "Title must be 80 characters or less");

export type ActionResult = { error: string } | { ok: true };

export async function createBoard() {
  const user = await requireUser();
  const board = await prisma.board.create({
    data: { ownerId: user.id },
    select: { id: true },
  });
  redirect(`/board/${board.id}`);
}

export async function renameBoard(
  boardId: string,
  title: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = BoardIdSchema.safeParse(boardId);
  const parsedTitle = TitleSchema.safeParse(title);
  if (!id.success) return { error: "Board not found" };
  if (!parsedTitle.success) {
    return { error: parsedTitle.error.issues[0]?.message ?? "Invalid title" };
  }

  // Only the owner can rename: the where clause includes ownerId.
  const { count } = await prisma.board.updateMany({
    where: { id: id.data, ownerId: user.id },
    data: { title: parsedTitle.data },
  });
  if (count === 0) return { error: "Only the owner can rename this board" };
  refresh();
  return { ok: true };
}

export async function deleteBoard(boardId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = BoardIdSchema.safeParse(boardId);
  if (!id.success) return { error: "Board not found" };

  const { count } = await prisma.board.deleteMany({
    where: { id: id.data, ownerId: user.id },
  });
  if (count === 0) return { error: "Only the owner can delete this board" };
  refresh();
  return { ok: true };
}

export async function leaveBoard(boardId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = BoardIdSchema.safeParse(boardId);
  if (!id.success) return { error: "Board not found" };

  await prisma.boardMember.deleteMany({
    where: { boardId: id.data, userId: user.id },
  });
  refresh();
  return { ok: true };
}
