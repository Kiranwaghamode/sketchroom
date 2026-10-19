import { prisma } from "@whiteboard/db";
import { notFound } from "next/navigation";
import { DocClient } from "@/components/doc/DocClient";
import { getItemRole } from "@/lib/access";
import { requireUser } from "@/lib/auth";

// Same as the board page: finish the access check before streaming starts, so a
// user without access gets a real HTTP 404.
export const instant = false;

export default async function DocPage({ params }: PageProps<"/doc/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const role = await getItemRole(user.id, id);
  if (!role) notFound();

  const doc = await prisma.board.findUnique({
    where: { id },
    select: { title: true, kind: true },
  });
  // A board's id under /doc/… is a 404 (and the other way around).
  if (!doc || doc.kind !== "DOC") notFound();

  return (
    <DocClient
      docId={id}
      userId={user.id}
      userName={user.name}
      title={doc.title}
      role={role}
    />
  );
}
