import { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";

/** Fetches a fresh 5-minute sync token. Called on every (re)connect. */
async function fetchToken(boardId: string): Promise<string> {
  const response = await fetch(
    `/api/ws-token?boardId=${encodeURIComponent(boardId)}`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error(`Couldn't get a sync token (${response.status})`);
  const { token } = (await response.json()) as { token: string };
  return token;
}

/** Connects a board's Y.Doc to the sync server. The room name is the board id. */
export function connectBoard(boardId: string, doc: Y.Doc) {
  const url = process.env["NEXT_PUBLIC_SYNC_URL"];
  if (!url) throw new Error("NEXT_PUBLIC_SYNC_URL is not set");

  const provider = new HocuspocusProvider({
    url,
    name: boardId,
    document: doc,
    token: () => fetchToken(boardId),
  });
  return {
    provider,
    cleanup: () => provider.destroy(),
  };
}
