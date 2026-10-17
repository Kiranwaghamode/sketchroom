import { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";

/** Connects a board's Y.Doc to the sync server. The room name is the board id. */
export function connectBoard(boardId: string, doc: Y.Doc) {
  const url = process.env["NEXT_PUBLIC_SYNC_URL"];
  if (!url) throw new Error("NEXT_PUBLIC_SYNC_URL is not set");

  const provider = new HocuspocusProvider({
    url,
    name: boardId,
    document: doc,
  });
  return {
    provider,
    cleanup: () => provider.destroy(),
  };
}
