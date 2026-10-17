import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  createShape,
  deleteShapes,
  updateShape,
  updateShapes,
} from "./mutations";
import { createBoardDoc, getShapes, type NewShape } from "./schema";
import { beginGesture, createUndoManager, endGesture } from "./undo";

const rect: NewShape = {
  type: "rect",
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  color: "#1e1e1e",
  createdBy: "alice",
};

/** Two docs connected like two browsers: every update is sent to the other side. */
function connectedPair() {
  const alice = createBoardDoc().doc;
  const bob = createBoardDoc().doc;
  alice.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin !== "remote") Y.applyUpdate(bob, u, "remote");
  });
  bob.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin !== "remote") Y.applyUpdate(alice, u, "remote");
  });
  return { alice, bob };
}

describe("undo manager", () => {
  it("undoes only my own changes, never someone else's", () => {
    const { alice, bob } = connectedPair();
    const aliceUndo = createUndoManager(alice);
    const mine = createShape(alice, rect);
    aliceUndo.stopCapturing();
    const theirs = createShape(bob, { ...rect, createdBy: "bob" });
    updateShape(bob, mine, { color: "#e03131" }); // Bob edits my shape too

    aliceUndo.undo(); // undoes my create only
    expect(getShapes(alice).has(theirs)).toBe(true);
    expect(getShapes(alice).has(mine)).toBe(false);
    expect(alice.toJSON()).toEqual(bob.toJSON()); // undo syncs like a normal edit
  });

  it("makes a whole drag one step, even with pauses longer than the capture timeout", () => {
    const { doc } = createBoardDoc();
    const undo = createUndoManager(doc);
    const id = createShape(doc, rect);

    beginGesture(undo);
    for (let i = 1; i <= 20; i++)
      updateShapes(doc, [{ id, patch: { x: i * 10 } }]);
    undo.lastChange = 1; // simulate a long pause in the middle of the drag
    for (let i = 21; i <= 40; i++)
      updateShapes(doc, [{ id, patch: { x: i * 10 } }]);
    endGesture(undo);

    undo.undo();
    expect(getShapes(doc).get(id)!.get("x")).toBe(0);
    undo.undo();
    expect(getShapes(doc).has(id)).toBe(false);
  });

  it("starts a new step after a gesture ends", () => {
    const { doc } = createBoardDoc();
    const undo = createUndoManager(doc);
    const id = createShape(doc, rect);
    beginGesture(undo);
    updateShape(doc, id, { x: 50 });
    endGesture(undo);
    updateShape(doc, id, { color: "#2f9e44" }); // immediately after the drag

    undo.undo();
    expect(getShapes(doc).get(id)!.toJSON()).toMatchObject({
      x: 50,
      color: "#1e1e1e",
    });
  });

  it("treats recoloring several shapes as one step, and redo restores it", () => {
    const { doc } = createBoardDoc();
    const undo = createUndoManager(doc);
    const ids = [
      createShape(doc, rect),
      createShape(doc, rect),
      createShape(doc, rect),
    ];
    undo.stopCapturing();
    updateShapes(
      doc,
      ids.map((id) => ({ id, patch: { color: "#9c36b5" } })),
    );

    undo.undo();
    expect(ids.map((id) => getShapes(doc).get(id)!.get("color"))).toEqual(
      Array(3).fill("#1e1e1e"),
    );
    undo.redo();
    expect(ids.map((id) => getShapes(doc).get(id)!.get("color"))).toEqual(
      Array(3).fill("#9c36b5"),
    );
  });

  it("brings back deleted shapes in their place", () => {
    const { doc, order } = createBoardDoc();
    const undo = createUndoManager(doc);
    const [a, b, c] = [
      createShape(doc, rect),
      createShape(doc, rect),
      createShape(doc, rect),
    ];
    undo.stopCapturing();
    deleteShapes(doc, [b!]);
    undo.undo();
    expect(order.toArray()).toEqual([a, b, c]);
  });
});
