"use client";

import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Role } from "@whiteboard/db";
import { useEffect, useState } from "react";
import type { IndexeddbPersistence } from "y-indexeddb";
import type * as Y from "yjs";
import { TopBar } from "@/components/board/TopBar";
import { userColor } from "@/lib/presence";
import { createDocumentYDoc } from "@/lib/yjs/doc-schema";
import { useConnectionStatus } from "@/lib/yjs/hooks";
import { connectItem } from "@/lib/yjs/provider";
import { DocEditor } from "./DocEditor";

type Props = {
  docId: string;
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

export function DocClient(props: Props) {
  const { docId, userId, userName } = props;
  const [session, setSession] = useState<Session | null>(null);

  // One Y.Doc + provider per document, created in an effect and destroyed on
  // unmount. In Strict Mode the effect runs twice, and the first pair is fully
  // destroyed before the second is created (same as BoardClient).
  useEffect(() => {
    const { doc } = createDocumentYDoc();
    const { provider, local, cleanup } = connectItem(docId, doc);
    // The connection is an external resource created here, so its handle has to be
    // stored from the effect; creating it during render would leak sockets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession({ doc, provider, local });

    // Presence: who I am (avatars, and my caret label on other screens). The
    // caret extension sets the same value once the editor exists.
    const awareness = provider.awareness;
    awareness?.setLocalStateField("user", {
      id: userId,
      name: userName,
      color: userColor(userId),
    });
    // Leave presence right away when the tab closes, instead of waiting for the timeout.
    const leave = () => awareness?.setLocalState(null);
    window.addEventListener("beforeunload", leave);
    if (process.env.NODE_ENV !== "production") {
      // For debugging in DevTools: doc.getXmlFragment("content").toString()
      Object.assign(window, { doc, provider });
    }
    return () => {
      window.removeEventListener("beforeunload", leave);
      cleanup();
      doc.destroy();
    };
  }, [docId, userId, userName]);

  if (!session) return <DocLayout {...props} status="connecting" />;
  return <ConnectedDoc {...props} session={session} />;
}

function ConnectedDoc({ session, ...props }: Props & { session: Session }) {
  const { status, loaded, saving } = useConnectionStatus(
    session.provider,
    session.local,
  );
  return (
    <DocLayout
      {...props}
      status={status}
      saving={saving}
      session={loaded ? session : undefined}
    />
  );
}

function DocLayout({
  docId,
  userId,
  userName,
  title,
  role,
  status,
  saving,
  session,
}: Props & {
  status: React.ComponentProps<typeof TopBar>["status"];
  saving?: boolean;
  /** Set once the content has loaded (from the server or this device). */
  session?: Session;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        boardId={docId}
        kind="DOC"
        title={title}
        isOwner={role === "OWNER"}
        readOnly={role === "VIEWER"}
        status={status}
        saving={session ? saving : undefined}
        awareness={session?.provider.awareness ?? undefined}
      />
      {/* The editor is created only after the Y.Doc has its content. */}
      {session ? (
        <DocEditor
          doc={session.doc}
          provider={session.provider}
          user={{ id: userId, name: userName, color: userColor(userId) }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading document…
        </div>
      )}
    </div>
  );
}
