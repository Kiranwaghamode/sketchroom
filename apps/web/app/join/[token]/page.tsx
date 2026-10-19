import { prisma } from "@whiteboard/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

// Runs before any streaming so the redirect is a real HTTP redirect.
export const instant = false;

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const user = await requireUser(); // proxy.ts already sends logged-out users to /login?next=…

  const link =
    token.length <= 64
      ? await prisma.shareLink.findUnique({
          where: { token },
          select: {
            boardId: true,
            role: true,
            board: { select: { ownerId: true, kind: true } },
          },
        })
      : null;

  if (!link) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-muted-foreground">
          This link is invalid or was reset.
        </p>
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          Go to dashboard
        </Button>
      </main>
    );
  }

  // The owner stays owner. Others become members with the link's role, but an
  // existing editor is never downgraded to viewer by opening a view link.
  if (link.board.ownerId !== user.id) {
    await prisma.boardMember.upsert({
      where: { boardId_userId: { boardId: link.boardId, userId: user.id } },
      create: { boardId: link.boardId, userId: user.id, role: link.role },
      update: link.role === "EDITOR" ? { role: "EDITOR" } : {},
    });
  }

  redirect(
    link.board.kind === "DOC"
      ? `/doc/${link.boardId}`
      : `/board/${link.boardId}`,
  );
}
