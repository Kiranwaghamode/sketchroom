import { prisma } from "@whiteboard/db";
import { notFound } from "next/navigation";
import { getBoardRole } from "@/lib/access";
import { requireUser } from "@/lib/auth";

// The access check must finish before streaming starts, so a user without
// access gets a real HTTP 404 (not a 200 with a not-found page streamed in).
export const instant = false;

export default async function BoardPage({ params }: PageProps<"/board/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const role = await getBoardRole(user.id, id);
  if (!role) notFound();

  const board = await prisma.board.findUnique({
    where: { id },
    select: { title: true },
  });
  if (!board) notFound();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2">
      <h1 className="text-xl font-semibold">{board.title}</h1>
      <p className="text-sm text-muted-foreground">Canvas coming soon</p>
    </main>
  );
}
