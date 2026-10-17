"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createBoardDoc } from "@/lib/yjs/schema";
import { useEditor } from "@/stores/editor";
import { SelectionPanel } from "./SelectionPanel";
import { Toolbar } from "./Toolbar";

// Konva needs the browser (canvas), so never render it on the server.
const Canvas = dynamic(() => import("@/components/canvas/Canvas"), {
  ssr: false,
});

type Props = { boardId: string; userId: string };

export function BoardClient({ boardId, userId }: Props) {
  // Phase 2: one in-memory Y.Doc per board page. Phase 3 connects it to the sync server.
  const [{ doc }] = useState(() => createBoardDoc());

  useEffect(() => {
    // Fresh editor state for each board.
    useEditor.setState({
      tool: "select",
      selectedIds: [],
      camera: { x: 0, y: 0, zoom: 1 },
    });
    if (process.env.NODE_ENV !== "production") {
      // For debugging in DevTools: doc.toJSON(), editor.getState()
      Object.assign(window, { doc, editor: useEditor });
    }
  }, [boardId, doc]);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <Canvas doc={doc} userId={userId} />
      <SelectionPanel doc={doc} />
      <Toolbar />
    </div>
  );
}
