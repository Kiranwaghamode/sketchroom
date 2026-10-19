import { HocuspocusProvider } from "@hocuspocus/provider";
import { clearDocument, IndexeddbPersistence } from "y-indexeddb";
import type * as Y from "yjs";

/**
 * Prefix for this app's IndexedDB databases (one per board or document), so logout
 * can find them. Documents use the same prefix: item ids are unique across kinds.
 */
const LOCAL_DB_PREFIX = "whiteboard-board-";

/** Fetches a fresh 5-minute sync token. Called on every (re)connect. */
async function fetchToken(itemId: string): Promise<string> {
  const response = await fetch(
    `/api/ws-token?boardId=${encodeURIComponent(itemId)}`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error(`Couldn't get a sync token (${response.status})`);
  const { token } = (await response.json()) as { token: string };
  return token;
}

/**
 * Connects an item's Y.Doc (a board or a document) to the sync server (room
 * name = item id) and keeps a copy in IndexedDB, so it opens instantly and
 * editing works offline.
 * Nothing special is needed to merge offline edits: on reconnect, the Yjs sync
 * handshake exchanges whatever each side is missing.
 */
export function connectItem(itemId: string, doc: Y.Doc) {
  const url = process.env["NEXT_PUBLIC_SYNC_URL"];
  if (!url) throw new Error("NEXT_PUBLIC_SYNC_URL is not set");

  const local = new IndexeddbPersistence(LOCAL_DB_PREFIX + itemId, doc);
  const provider = new HocuspocusProvider({
    url,
    name: itemId,
    document: doc,
    token: () => fetchToken(itemId),
  });

  // A WebSocket can stay "open" for a while after the network drops. Use the
  // browser's own signal to go offline immediately and reconnect right away.
  const onOffline = () => provider.disconnect();
  const onOnline = () => void provider.connect();
  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);

  return {
    provider,
    local,
    cleanup: () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      provider.destroy();
      void local.destroy();
    },
  };
}

/** Deletes every board and document copy this browser keeps offline. Called on logout. */
export async function clearLocalItems() {
  const databases = await indexedDB.databases?.();
  await Promise.all(
    (databases ?? [])
      .map((db) => db.name)
      .filter((name): name is string => !!name?.startsWith(LOCAL_DB_PREFIX))
      .map((name) => clearDocument(name)),
  );
}
