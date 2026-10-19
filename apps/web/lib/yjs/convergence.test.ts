import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createShape, deleteShapes, updateShape } from "./mutations";
import { createBoardDoc, getOrder, type NewShape } from "./schema";
import { random, shuffle } from "./test-utils";

const COLORS = ["#1e1e1e", "#e03131", "#1971c2", "#2f9e44"] as const;

function randomEdit(doc: Y.Doc, rand: () => number) {
  const ids = getOrder(doc).toArray();
  const pick = () => ids[Math.floor(rand() * ids.length)]!;
  const r = rand();
  if (ids.length === 0 || r < 0.35) {
    const shape: NewShape = {
      type: rand() < 0.5 ? "rect" : "ellipse",
      x: Math.round(rand() * 1000),
      y: Math.round(rand() * 1000),
      width: 50 + Math.round(rand() * 100),
      height: 50 + Math.round(rand() * 100),
      color: COLORS[Math.floor(rand() * COLORS.length)]!,
      createdBy: "test",
    };
    createShape(doc, shape);
  } else if (r < 0.85) {
    updateShape(doc, pick(), {
      x: Math.round(rand() * 1000),
      color: COLORS[Math.floor(rand() * COLORS.length)],
    });
  } else {
    deleteShapes(doc, [pick()]);
  }
}

describe("convergence", () => {
  it.each([1, 7, 42, 1234, 99999])(
    "two docs with random concurrent edits end up identical (seed %i)",
    (seed) => {
      const rand = random(seed);
      const a = createBoardDoc().doc;
      const b = createBoardDoc().doc;
      const fromA: Uint8Array[] = [];
      const fromB: Uint8Array[] = [];
      a.on("update", (u: Uint8Array) => fromA.push(u));
      b.on("update", (u: Uint8Array) => fromB.push(u));

      // Rounds of concurrent edits; in between, deliver some updates out of order,
      // with duplicates, and hold the rest back.
      for (let round = 0; round < 10; round++) {
        for (let i = 0; i < 15; i++) randomEdit(rand() < 0.5 ? a : b, rand);
        const toB = shuffle(
          fromA.splice(0, Math.floor(rand() * fromA.length)),
          rand,
        );
        const toA = shuffle(
          fromB.splice(0, Math.floor(rand() * fromB.length)),
          rand,
        );
        for (const u of [...toB, ...toB.slice(0, 2)])
          Y.applyUpdate(b, u, "remote");
        for (const u of [...toA, ...toA.slice(0, 2)])
          Y.applyUpdate(a, u, "remote");
      }

      // Finally deliver everything that's left (in random order, with duplicates).
      for (const u of shuffle([...fromA, ...fromA], rand))
        Y.applyUpdate(b, u, "remote");
      for (const u of shuffle([...fromB, ...fromB], rand))
        Y.applyUpdate(a, u, "remote");

      expect(a.toJSON()).toEqual(b.toJSON());
    },
  );
});
