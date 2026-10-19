import { prisma } from "@whiteboard/db";
import { notFound } from "next/navigation";
import { BoardClient } from "@/components/board/BoardClient";
import { getItemRole } from "@/lib/access";
import { requireUser } from "@/lib/auth";

// The access check must finish before streaming starts, so a user without
// access gets a real HTTP 404 (not a 200 with a not-found page streamed in).
export const instant = false;

export default async function BoardPage({ params }: PageProps<"/board/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const role = await getItemRole(user.id, id);
  if (!role) notFound();

  const board = await prisma.board.findUnique({
    where: { id },
    select: { title: true, kind: true },
  });
  // A document's id under /board/… is a 404 (and the other way around).
  if (!board || board.kind !== "BOARD") notFound();

  return (
    <BoardClient
      boardId={id}
      userId={user.id}
      userName={user.name}
      title={board.title}
      role={role}
    />
  );
}
