"use server";

import { prisma } from "@whiteboard/db";
import { z } from "zod";
import * as Y from "yjs";
import { getItemRole } from "@/lib/access";
import { requireUser } from "@/lib/auth";

const MAX_VERSIONS = 50;
const MAX_STATE_BYTES = 4 * 1024 * 1024;

const SaveSchema = z.object({
  boardId: z.string().min(1).max(64),
  state: z.base64(),
  label: z.string().trim().max(80).optional(),
});

export type VersionListItem = {
  id: string;
  label: string | null;
  createdAt: string;
  createdByName: string;
};

async function roleFor(boardId: string) {
  const user = await requireUser();
  return { user, role: await getItemRole(user.id, boardId) };
}

/**
 * Saves the client's current (synced) board content as a version. Owner or editor only.
 * Keeps the newest 50 versions per board.
 */
export async function saveVersion(input: {
  boardId: string;
  state: string;
  label?: string;
}): Promise<{ error: string } | { ok: true }> {
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return { error: "Couldn't save this version" };
  const { boardId, state, label } = parsed.data;

  const { user, role } = await roleFor(boardId);
  if (role !== "OWNER" && role !== "EDITOR")
    return { error: "You can't save versions of this board" };

  const bytes = new Uint8Array(Buffer.from(state, "base64"));
  if (bytes.byteLength > MAX_STATE_BYTES)
    return { error: "This board is too large to save" };
  try {
    Y.applyUpdate(new Y.Doc(), bytes); // reject anything that isn't a Yjs document
  } catch {
    return { error: "Couldn't save this version" };
  }

  await prisma.boardVersion.create({
    data: { boardId, state: bytes, label: label || null, createdById: user.id },
  });

  // Keep at most MAX_VERSIONS: delete the oldest beyond that.
  const old = await prisma.boardVersion.findMany({
    where: { boardId },
    orderBy: { createdAt: "desc" },
    skip: MAX_VERSIONS,
    select: { id: true },
  });
  if (old.length > 0) {
    await prisma.boardVersion.deleteMany({
      where: { id: { in: old.map((v) => v.id) } },
    });
  }
  return { ok: true };
}

/** Versions of a board, newest first. Anyone with access can see the list. */
export async function listVersions(
  boardId: string,
): Promise<VersionListItem[]> {
  const { role } = await roleFor(boardId);
  if (!role) return [];

  const versions = await prisma.boardVersion.findMany({
    where: { boardId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, createdById: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(versions.map((v) => v.createdById))] } },
    select: { id: true, name: true },
  });
  const names = new Map(users.map((u) => [u.id, u.name]));
  return versions.map((v) => ({
    id: v.id,
    label: v.label,
    createdAt: v.createdAt.toISOString(),
    createdByName: names.get(v.createdById) ?? "Someone",
  }));
}

/** A version's content (base64), for restoring on the client. Owner or editor only. */
export async function getVersionState(
  boardId: string,
  versionId: string,
): Promise<{ error: string } | { state: string }> {
  const { role } = await roleFor(boardId);
  if (role !== "OWNER" && role !== "EDITOR")
    return { error: "You can't restore versions of this board" };

  const version = await prisma.boardVersion.findFirst({
    where: { id: versionId, boardId },
    select: { state: true },
  });
  if (!version) return { error: "This version no longer exists" };
  return { state: Buffer.from(version.state).toString("base64") };
}
