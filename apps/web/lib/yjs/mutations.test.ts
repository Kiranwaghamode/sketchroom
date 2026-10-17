import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  createShape,
  deleteShapes,
  updateShape,
  updateShapes,
} from "./mutations";
import { createBoardDoc, LOCAL_ORIGIN, type NewShape } from "./schema";

const rect: NewShape = {
  type: "rect",
  x: 10,
  y: 20,
  width: 120,
  height: 80,
  color: "#1e1e1e",
  createdBy: "user-1",
};

const pen: NewShape = {
  type: "pen",
  x: 0,
  y: 0,
  points: [0, 0, 5, 5, 10, 0],
  color: "#e03131",
  createdBy: "user-1",
};

describe("createShape", () => {
  it("adds a Y.Map with one key per property, and appends the id to order", () => {
    const { doc, shapes, order } = createBoardDoc();
    const id = createShape(doc, rect);

    expect(order.toArray()).toEqual([id]);
    const map = shapes.get(id);
    expect(map).toBeInstanceOf(Y.Map);
    expect(map!.toJSON()).toEqual({ ...rect, id });
    expect(map!.get("width")).toBe(120);
  });

  it("generates unique ids and keeps drawing order", () => {
    const { doc, order } = createBoardDoc();
    const a = createShape(doc, rect);
    const b = createShape(doc, pen);
    expect(a).not.toBe(b);
    expect(order.toArray()).toEqual([a, b]);
  });

  it("uses LOCAL_ORIGIN for the transaction", () => {
    const { doc } = createBoardDoc();
    const origins: unknown[] = [];
    doc.on("afterTransaction", (tr) => origins.push(tr.origin));
    createShape(doc, rect);
    expect(origins).toEqual([LOCAL_ORIGIN]);
  });
});

describe("updateShape", () => {
  it("sets only the keys in the patch", () => {
    const { doc, shapes } = createBoardDoc();
    const id = createShape(doc, rect);
    updateShape(doc, id, { x: 99, color: "#1971c2" });
    expect(shapes.get(id)!.toJSON()).toEqual({
      ...rect,
      id,
      x: 99,
      color: "#1971c2",
    });
  });

  it("ignores unknown ids", () => {
    const { doc, shapes } = createBoardDoc();
    updateShape(doc, "missing", { x: 1 });
    expect(shapes.size).toBe(0);
  });

  it("updates several shapes in one transaction", () => {
    const { doc, shapes } = createBoardDoc();
    const a = createShape(doc, rect);
    const b = createShape(doc, pen);
    let transactions = 0;
    doc.on("afterTransaction", () => transactions++);
    updateShapes(doc, [
      { id: a, patch: { color: "#2f9e44" } },
      { id: b, patch: { color: "#2f9e44" } },
    ]);
    expect(transactions).toBe(1);
    expect(shapes.get(a)!.get("color")).toBe("#2f9e44");
    expect(shapes.get(b)!.get("color")).toBe("#2f9e44");
  });

  it("merges concurrent edits to different properties of the same shape", () => {
    const { doc: docA } = createBoardDoc();
    const id = createShape(docA, rect);
    const { doc: docB } = createBoardDoc();
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    updateShape(docA, id, { x: 500 });
    updateShape(docB, id, { color: "#9c36b5" });
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    expect(docA.toJSON()).toEqual(docB.toJSON());
    const merged = docA.getMap<Y.Map<unknown>>("shapes").get(id)!.toJSON();
    expect(merged).toMatchObject({ x: 500, color: "#9c36b5" });
  });
});

describe("deleteShapes", () => {
  it("removes the ids from shapes and order", () => {
    const { doc, shapes, order } = createBoardDoc();
    const a = createShape(doc, rect);
    const b = createShape(doc, pen);
    const c = createShape(doc, rect);
    deleteShapes(doc, [a, c]);
    expect([...shapes.keys()]).toEqual([b]);
    expect(order.toArray()).toEqual([b]);
  });

  it("does nothing for an empty list", () => {
    const { doc } = createBoardDoc();
    createShape(doc, rect);
    let transactions = 0;
    doc.on("afterTransaction", () => transactions++);
    deleteShapes(doc, []);
    expect(transactions).toBe(0);
  });
});
