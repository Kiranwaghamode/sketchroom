import { prisma } from "@whiteboard/db";
import { FileTextIcon, PenToolIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BoardCardMenu } from "@/components/dashboard/board-card-menu";
import { NewItemButton } from "@/components/dashboard/new-item-button";
import { UserMenu } from "@/components/dashboard/user-menu";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/time";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={<p className="p-8 text-sm text-muted-foreground">Loading…</p>}
    >
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const boards = await prisma.board.findMany({
    where: {
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      kind: true,
      updatedAt: true,
      ownerId: true,
      members: { where: { userId: user.id }, select: { role: true } },
    },
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <span className="font-semibold">Whiteboard</span>
        <UserMenu name={user.name} email={user.email} />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
        {boards.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-muted-foreground">Nothing here yet</p>
            <NewItemButton />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">
                Your boards and documents
              </h1>
              <NewItemButton />
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((board) => {
                const isOwner = board.ownerId === user.id;
                const role = board.members[0]?.role;
                const isDoc = board.kind === "DOC";
                const Icon = isDoc ? FileTextIcon : PenToolIcon;
                return (
                  <li key={board.id} className="relative">
                    <Link
                      href={`/${isDoc ? "doc" : "board"}/${board.id}`}
                      className="block rounded-xl"
                    >
                      <Card className="transition-colors hover:bg-muted/50">
                        <CardHeader className="pr-12">
                          <CardTitle className="flex items-center gap-2">
                            <Icon
                              aria-label={isDoc ? "Document" : "Board"}
                              className="size-4 shrink-0 text-muted-foreground"
                            />
                            <span className="truncate">{board.title}</span>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            Edited {timeAgo(board.updatedAt)}
                            {!isOwner && role && (
                              <span className="rounded-full border px-2 py-0.5 text-xs">
                                {role === "EDITOR" ? "Can edit" : "Can view"}
                              </span>
                            )}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </Link>
                    <div className="absolute top-3 right-3">
                      <BoardCardMenu
                        boardId={board.id}
                        kind={board.kind}
                        title={board.title}
                        isOwner={isOwner}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
