"use client";

import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Role } from "@whiteboard/db";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { IndexeddbPersistence } from "y-indexeddb";
import type * as Y from "yjs";
import { Cursors } from "@/components/canvas/Cursors";
import { userColor } from "@/lib/presence";
import { useConnectionStatus } from "@/lib/yjs/hooks";
import { connectBoard } from "@/lib/yjs/provider";
import { createBoardDoc } from "@/lib/yjs/schema";
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
};

export function BoardClient(props: Props) {
  const { boardId, userId, userName } = props;
  const [session, setSession] = useState<Session | null>(null);

  // One Y.Doc + provider per board, created in an effect and destroyed on unmount.
  // In Strict Mode the effect runs twice; the first pair is fully destroyed before
  // the second is created, so there's never more than one live connection.
  useEffect(() => {
    const { doc } = createBoardDoc();
    const { provider, local, cleanup } = connectBoard(boardId, doc);
    // The connection is an external resource created here, so its handle has to be
    // stored from the effect; creating it during render would leak sockets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession({ doc, provider, local });

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
      cleanup();
      doc.destroy();
    };
  }, [boardId, userId, userName]);

  if (!session) return <BoardLayout {...props} status="connecting" />;
  return <ConnectedBoard {...props} session={session} />;
}

function ConnectedBoard({ session, ...props }: Props & { session: Session }) {
  const { status, loaded, saving } = useConnectionStatus(
    session.provider,
    session.local,
  );

  // "Back online" once we reconnect after being offline and everything has synced.
  const wasOffline = useRef(false);
  useEffect(() => {
    if (status === "offline") wasOffline.current = true;
    else if (status === "connected" && !saving && wasOffline.current) {
      wasOffline.current = false;
      toast.success("Back online – changes synced");
    }
  }, [status, saving]);

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
      />
      {status === "offline" && (
        <div className="shrink-0 border-b border-yellow-200 bg-yellow-50 px-4 py-1.5 text-center text-sm text-yellow-900">
          You&rsquo;re offline – changes are saved on this device and will sync
          when you&rsquo;re back online.
        </div>
      )}
      <main className="relative flex-1 overflow-hidden">
        {session ? (
          <>
            <Canvas
              doc={session.doc}
              userId={userId}
              readOnly={role === "VIEWER"}
              awareness={session.provider.awareness ?? undefined}
            />
            {session.provider.awareness && (
              <Cursors awareness={session.provider.awareness} />
            )}
            {role !== "VIEWER" && (
              <>
                <SelectionPanel doc={session.doc} />
                <Toolbar />
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
