import * as Y from "yjs";
import { getOrder, getShapes, LOCAL_ORIGIN, type ShapeMap } from "./schema";

function sameValue(a: unknown, b: unknown): boolean {
  // Shape values are numbers, strings, or `points` arrays.
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Restores a saved version by *moving forward*: it computes the changes that turn
 * the live doc into the version and applies them as one normal local edit.
 *
 * We never overwrite `Board.state` instead. Clients that are connected (or
 * offline) still hold the newer state, and the CRDT would merge it right back in.
 * As a normal edit, the restore syncs to everyone, survives reconnects, and one
 * undo reverts the whole thing.
 */
export function restoreVersion(doc: Y.Doc, versionState: Uint8Array) {
  const version = new Y.Doc();
  Y.applyUpdate(version, versionState);
  const versionShapes = getShapes(version);
  const versionOrder = getOrder(version).toArray();

  const shapes = getShapes(doc);
  const order = getOrder(doc);

  doc.transact(() => {
    // Shapes in the live doc but not in the version: delete.
    for (const id of [...shapes.keys()]) {
      if (!versionShapes.has(id)) shapes.delete(id);
    }

    for (const [id, versionMap] of versionShapes) {
      const live = shapes.get(id);
      if (!live) {
        // In the version but not live: recreate with all properties.
        const map: ShapeMap = new Y.Map();
        for (const [key, value] of versionMap) map.set(key, value);
        shapes.set(id, map);
        continue;
      }
      // In both: set only the properties that differ.
      for (const [key, value] of versionMap) {
        if (!sameValue(live.get(key), value)) live.set(key, value);
      }
      for (const key of [...live.keys()]) {
        if (!versionMap.has(key)) live.delete(key);
      }
    }

    // Drawing order: replace it if it differs.
    const liveOrder = order.toArray();
    if (!sameValue(liveOrder, versionOrder)) {
      order.delete(0, order.length);
      order.insert(0, versionOrder);
    }
  }, LOCAL_ORIGIN);

  version.destroy();
}
