import * as Y from "yjs";
import { getContent } from "./doc-schema";

/**
 * Transaction origin of a document restore. The editor's Yjs undo manager is
 * told to track it, so one Ctrl+Z reverts a restore (and only the restore).
 */
export const RESTORE_ORIGIN = "restore-version";

/**
 * Replaces the live document's content with a saved version's, *moving forward*:
 * in one transaction, delete every block of the live `content` fragment and
 * insert clones of the version's blocks. It syncs to everyone like a normal edit.
 *
 * We never overwrite `Board.state` instead. Connected (or offline) clients still
 * hold the newer content, and the CRDT would merge it right back in.
 */
export function replaceContent(doc: Y.Doc, versionState: Uint8Array) {
  const version = new Y.Doc();
  Y.applyUpdate(version, versionState);
  const source = getContent(version);
  const live = getContent(doc);

  // Blocks are XmlElements (or XmlText); the editor never creates XmlHooks.
  const blocks = source
    .toArray()
    .filter((child) => !(child instanceof Y.XmlHook))
    .map((child) => (child as Y.XmlElement | Y.XmlText).clone());

  doc.transact(() => {
    live.delete(0, live.length);
    live.insert(0, blocks);
  }, RESTORE_ORIGIN);

  version.destroy();
}

/** Saves a version of the current content; resolves to `{ error }` on failure. */
export type SaveCurrent = (
  state: Uint8Array,
  label: string,
) => Promise<{ error: string } | { ok: true }>;

export const BEFORE_RESTORE_LABEL = "Before restore";

/**
 * Restores a saved version. First saves the current content as "Before restore"
 * (a simple safety net that can itself be restored), then replaces the content.
 * If that safety save fails, nothing is changed. Returns an error message, if any.
 */
export async function restoreDocumentVersion(
  doc: Y.Doc,
  versionState: Uint8Array,
  saveCurrent: SaveCurrent,
): Promise<string | undefined> {
  const saved = await saveCurrent(
    Y.encodeStateAsUpdate(doc),
    BEFORE_RESTORE_LABEL,
  );
  if ("error" in saved) {
    return `Couldn't save the current version first: ${saved.error}`;
  }
  replaceContent(doc, versionState);
}
