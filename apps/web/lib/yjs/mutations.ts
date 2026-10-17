import { nanoid } from "nanoid";
import * as Y from "yjs";
import {
  getOrder,
  getShapes,
  LOCAL_ORIGIN,
  type NewShape,
  type ShapeMap,
  type ShapePatch,
} from "./schema";

/** Creates a shape and adds it on top of the drawing order. Returns its id. */
export function createShape(doc: Y.Doc, shape: NewShape): string {
  const id = nanoid();
  doc.transact(() => {
    const map: ShapeMap = new Y.Map();
    for (const [key, value] of Object.entries({ ...shape, id })) {
      map.set(key, value);
    }
    getShapes(doc).set(id, map);
    getOrder(doc).push([id]);
  }, LOCAL_ORIGIN);
  return id;
}

/** Sets only the keys in `patch`. Unknown ids are ignored. */
export function updateShape(doc: Y.Doc, id: string, patch: ShapePatch) {
  updateShapes(doc, [{ id, patch }]);
}

/** Updates several shapes in one transaction (e.g. moving or recoloring a selection). */
export function updateShapes(
  doc: Y.Doc,
  updates: { id: string; patch: ShapePatch }[],
) {
  const shapes = getShapes(doc);
  doc.transact(() => {
    for (const { id, patch } of updates) {
      const map = shapes.get(id);
      if (!map) continue;
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined && map.get(key) !== value) map.set(key, value);
      }
    }
  }, LOCAL_ORIGIN);
}

/** Removes shapes from both `shapes` and `order`. */
export function deleteShapes(doc: Y.Doc, ids: Iterable<string>) {
  const remove = new Set(ids);
  if (remove.size === 0) return;
  const shapes = getShapes(doc);
  const order = getOrder(doc);
  doc.transact(() => {
    for (const id of remove) shapes.delete(id);
    // Walk backwards so deleting doesn't shift the indexes still to visit.
    for (let i = order.length - 1; i >= 0; i--) {
      if (remove.has(order.get(i))) order.delete(i, 1);
    }
  }, LOCAL_ORIGIN);
}
