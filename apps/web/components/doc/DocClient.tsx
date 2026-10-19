"use client";

import type { Role } from "@whiteboard/db";
import { useEffect, useState } from "react";
import type * as Y from "yjs";
import { TopBar } from "@/components/board/TopBar";
import { createDocumentYDoc } from "@/lib/yjs/doc-schema";
import { DocEditor } from "./DocEditor";

type Props = {
  docId: string;
  userId: string;
  userName: string;
  title: string;
  role: Role;
};

export function DocClient({ docId, title, role }: Props) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);

  // One Y.Doc per document page, created in an effect and destroyed on unmount.
  // In Strict Mode the effect runs twice, and the first doc is destroyed before
  // the second is created.
  useEffect(() => {
    const { doc } = createDocumentYDoc();
    // The Y.Doc is an external resource created here, so it's stored from the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDoc(doc);
    if (process.env.NODE_ENV !== "production") {
      // For debugging in DevTools: doc.getXmlFragment("content").toString()
      Object.assign(window, { doc });
    }
    return () => doc.destroy();
  }, [docId]);

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
      {doc && <DocEditor doc={doc} />}
    </div>
  );
}
