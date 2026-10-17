import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createShape, deleteShapes, updateShape } from "./mutations";
import { restoreVersion } from "./restore";
import { createBoardDoc, getShapes, type NewShape } from "./schema";
import { createUndoManager } from "./undo";

const rect: NewShape = {
  type: "rect",
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  color: "#1e1e1e",
  createdBy: "u1",
};
const pen: NewShape = {
  type: "pen",
  x: 10,
  y: 10,
  points: [0, 0, 5, 5],
  color: "#e03131",
  createdBy: "u1",
};

/** A board with a saved version, then lots of changes after it. */
function setup() {
  const { doc } = createBoardDoc();
  const kept = createShape(doc, rect);
  const changed = createShape(doc, pen);
  const deletedLater = createShape(doc, { ...rect, x: 300 });
  const version = Y.encodeStateAsUpdate(doc);
  const versionJson = JSON.stringify(doc.toJSON());

  // After the save: edit, delete, add, reorder.
  updateShape(doc, changed, {
    x: 999,
    color: "#2f9e44",
    points: [0, 0, 50, 50, 90, 10],
  });
  deleteShapes(doc, [deletedLater]);
  const added = createShape(doc, { ...rect, color: "#9c36b5" });
  return {
    doc,
    version,
    versionJson,
    ids: { kept, changed, deletedLater, added },
  };
}

describe("restoreVersion", () => {
  it("makes the live doc equal to the version (deleted, added and changed shapes)", () => {
    const { doc, version, versionJson, ids } = setup();
    expect(JSON.stringify(doc.toJSON())).not.toBe(versionJson);

    restoreVersion(doc, version);

    expect(JSON.stringify(doc.toJSON())).toBe(versionJson);
    expect(getShapes(doc).has(ids.added)).toBe(false); // added after the save → removed
    expect(getShapes(doc).has(ids.deletedLater)).toBe(true); // deleted after → back
    expect(getShapes(doc).get(ids.changed)!.get("points")).toEqual([
      0, 0, 5, 5,
    ]);
  });

  it("is reverted by a single undo", () => {
    const { doc, version } = setup();
    const undo = createUndoManager(doc);
    const before = JSON.stringify(doc.toJSON());

    restoreVersion(doc, version);
    undo.undo();

    expect(JSON.stringify(doc.toJSON())).toBe(before);
  });

  it("syncs to another client like a normal edit", () => {
    const { doc, version, versionJson } = setup();
    const other = createBoardDoc().doc;
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));

    restoreVersion(doc, version);
    Y.applyUpdate(
      other,
      Y.encodeStateAsUpdate(doc, Y.encodeStateVector(other)),
    );

    expect(JSON.stringify(other.toJSON())).toBe(versionJson);
  });

  it("is not undone when the other client syncs its older state back", () => {
    const { doc, version, versionJson } = setup();
    const other = createBoardDoc().doc;
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc)); // other has the pre-restore state

    restoreVersion(doc, version);
    // Both sides exchange everything they have.
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other));
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));

    expect(JSON.stringify(doc.toJSON())).toBe(versionJson);
    expect(JSON.stringify(other.toJSON())).toBe(versionJson);
  });
});
