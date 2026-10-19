"use client";

import type { Role } from "@whiteboard/db";
import { TopBar } from "@/components/board/TopBar";

type Props = {
  docId: string;
  userId: string;
  userName: string;
  title: string;
  role: Role;
};

export function DocClient({ docId, title, role }: Props) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        boardId={docId}
        kind="DOC"
        title={title}
        isOwner={role === "OWNER"}
        readOnly={role === "VIEWER"}
        status="connecting"
      />
      <main className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Editor coming soon
      </main>
    </div>
  );
}
