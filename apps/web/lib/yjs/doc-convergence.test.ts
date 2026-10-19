import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createDocumentYDoc, getContent } from "./doc-schema";
import { random, shuffle } from "./test-utils";

const WORDS = [
  "alpha",
  "bravo",
  "charlie",
  "delta",
  "echo",
  " ",
  "\n",
  "é",
  "😀",
];

function paragraph(text: string) {
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  return p;
}

/**
 * Moves a position off the middle of a surrogate pair (an emoji is two UTF-16
 * units). The editor never puts the cursor there; splitting one makes Yjs
 * replace the halves with U+FFFD, which isn't a convergence problem.
 */
function boundary(text: string, pos: number) {
  const code = text.charCodeAt(pos - 1);
  return code >= 0xd800 && code <= 0xdbff ? pos - 1 : pos;
}

/** The Y.XmlText of the i-th paragraph (every block here is a paragraph). */
function textOf(doc: Y.Doc, index: number) {
  const block = getContent(doc).get(index) as Y.XmlElement;
  return block.get(0) as Y.XmlText;
}

/**
 * One random edit, the kinds the editor makes: type text at a random spot,
 * delete a range, bold/italic a range, add a paragraph, or remove one.
 */
function randomEdit(doc: Y.Doc, rand: () => number) {
  const fragment = getContent(doc);
  const pick = (n: number) => Math.floor(rand() * n);
  const r = rand();

  if (fragment.length === 0 || r < 0.1) {
    fragment.insert(pick(fragment.length + 1), [
      paragraph(WORDS[pick(WORDS.length)]!),
    ]);
    return;
  }
  if (r < 0.15 && fragment.length > 1) {
    fragment.delete(pick(fragment.length), 1);
    return;
  }

  const text = textOf(doc, pick(fragment.length));
  const plain = text.toString().replace(/<[^>]*>/g, "");
  const length = text.length;
  // A random range [start, end) that doesn't cut an emoji in half.
  const range = (maxLength: number) => {
    const start = boundary(plain, pick(length));
    let end = boundary(plain, start + 1 + pick(maxLength));
    if (end <= start) end = Math.min(length, start + 2);
    return [start, Math.min(end, length)] as const;
  };

  if (r < 0.6 || length === 0) {
    text.insert(boundary(plain, pick(length + 1)), WORDS[pick(WORDS.length)]!);
  } else if (r < 0.85) {
    const [start, end] = range(5);
    text.delete(start, end - start);
  } else {
    const [start, end] = range(length);
    const mark = rand() < 0.5 ? "bold" : "italic";
    text.format(start, end - start, { [mark]: rand() < 0.8 ? {} : null });
  }
}

describe("document convergence", () => {
  it.each([1, 7, 42, 1234, 99999])(
    "two docs with random concurrent text edits end up identical (seed %i)",
    (seed) => {
      const rand = random(seed);
      // Both start from the same synced document, like two people opening it.
      const a = createDocumentYDoc().doc;
      getContent(a).insert(0, [
        paragraph("The quick brown fox"),
        paragraph("jumps over the lazy dog"),
      ]);
      const b = createDocumentYDoc().doc;
      Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

      const fromA: Uint8Array[] = [];
      const fromB: Uint8Array[] = [];
      a.on("update", (u: Uint8Array, origin: unknown) => {
        if (origin !== "remote") fromA.push(u);
      });
      b.on("update", (u: Uint8Array, origin: unknown) => {
        if (origin !== "remote") fromB.push(u);
      });

      // Rounds of concurrent edits; in between, deliver some updates out of
      // order, with duplicates, and hold the rest back.
      for (let round = 0; round < 15; round++) {
        for (let i = 0; i < 20; i++) randomEdit(rand() < 0.5 ? a : b, rand);
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

      const text = getContent(a).toString();
      expect(getContent(b).toString()).toBe(text);
      expect(text.length).toBeGreaterThan(0);
    },
  );
});
