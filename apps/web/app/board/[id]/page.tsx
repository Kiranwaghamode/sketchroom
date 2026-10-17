import { notFound } from "next/navigation";
import { BoardClient } from "@/components/board/BoardClient";
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

  return <BoardClient boardId={id} userId={user.id} />;
}
