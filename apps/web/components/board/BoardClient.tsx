"use client";

import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Role } from "@whiteboard/db";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { IndexeddbPersistence } from "y-indexeddb";
import type * as Y from "yjs";
import { Cursors } from "@/components/canvas/Cursors";
import { OfflineBanner, useBackOnlineToast } from "@/components/shared/offline";
import { userColor } from "@/lib/presence";
import { useConnectionStatus } from "@/lib/yjs/hooks";
import { connectItem } from "@/lib/yjs/provider";
import { createBoardDoc } from "@/lib/yjs/schema";
import { createUndoManager } from "@/lib/yjs/undo";
import { useEditor } from "@/stores/editor";
import { SelectionPanel } from "./SelectionPanel";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";

// Konva needs the browser (canvas), so never render it on the server.
const Canvas = dynamic(() => import("@/components/canvas/Canvas"), {
  ssr: false,
});

type Props = {
  boardId: string;
  userId: string;
  userName: string;
  title: string;
  role: Role;
};

type Session = {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  local: IndexeddbPersistence;
  /** Only for owners and editors. */
  undoManager?: Y.UndoManager;
};

export function BoardClient(props: Props) {
  const { boardId, userId, userName, role } = props;
  const [session, setSession] = useState<Session | null>(null);

  // One Y.Doc + provider per board, created in an effect and destroyed on unmount.
  // In Strict Mode the effect runs twice; the first pair is fully destroyed before
  // the second is created, so there's never more than one live connection.
  useEffect(() => {
    const { doc } = createBoardDoc();
    const { provider, local, cleanup } = connectItem(boardId, doc);
    // One undo manager per board session; viewers can't edit, so they get none.
    const undoManager = role === "VIEWER" ? undefined : createUndoManager(doc);
    // The connection is an external resource created here, so its handle has to be
    // stored from the effect; creating it during render would leak sockets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession({ doc, provider, local, undoManager });

    // Presence: who I am (for avatars and my cursor label on other screens).
    const awareness = provider.awareness;
    awareness?.setLocalStateField("user", {
      id: userId,
      name: userName,
      color: userColor(userId),
    });
    // Leave presence right away when the tab closes, instead of waiting for the timeout.
    const leave = () => awareness?.setLocalState(null);
    window.addEventListener("beforeunload", leave);
    useEditor.setState({
      tool: "select",
      selectedIds: [],
      camera: { x: 0, y: 0, zoom: 1 },
    });
    if (process.env.NODE_ENV !== "production") {
      // For debugging in DevTools: doc.toJSON(), editor.getState()
      Object.assign(window, { doc, provider, editor: useEditor });
    }
    return () => {
      window.removeEventListener("beforeunload", leave);
      undoManager?.destroy();
      cleanup();
      doc.destroy();
    };
  }, [boardId, userId, userName, role]);

  if (!session) return <BoardLayout {...props} status="connecting" />;
  return <ConnectedBoard {...props} session={session} />;
}

function ConnectedBoard({ session, ...props }: Props & { session: Session }) {
  const { status, loaded, saving } = useConnectionStatus(
    session.provider,
    session.local,
  );

  useBackOnlineToast(status, saving);

  return (
    <BoardLayout
      {...props}
      status={status}
      saving={saving}
      session={loaded ? session : undefined}
    />
  );
}

function BoardLayout({
  boardId,
  userId,
  title,
  role,
  status,
  saving,
  session,
}: Props & {
  status: React.ComponentProps<typeof TopBar>["status"];
  saving?: boolean;
  session?: Session;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        boardId={boardId}
        title={title}
        isOwner={role === "OWNER"}
        readOnly={role === "VIEWER"}
        status={status}
        saving={session ? saving : undefined}
        awareness={session?.provider.awareness ?? undefined}
        history={
          session && { doc: session.doc, undoManager: session.undoManager }
        }
      />
      {status === "offline" && <OfflineBanner />}
      <main className="relative flex-1 overflow-hidden">
        {session ? (
          <>
            <Canvas
              doc={session.doc}
              userId={userId}
              readOnly={role === "VIEWER"}
              awareness={session.provider.awareness ?? undefined}
              undoManager={session.undoManager}
            />
            {session.provider.awareness && (
              <Cursors awareness={session.provider.awareness} />
            )}
            {role !== "VIEWER" && (
              <>
                <SelectionPanel doc={session.doc} />
                {session.undoManager && (
                  <Toolbar undoManager={session.undoManager} />
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading board…
          </div>
        )}
      </main>
    </div>
  );
}
