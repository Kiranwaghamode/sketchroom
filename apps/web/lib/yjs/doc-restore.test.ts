import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  BEFORE_RESTORE_LABEL,
  replaceContent,
  restoreDocumentVersion,
  RESTORE_ORIGIN,
  type SaveCurrent,
} from "./doc-restore";
import { createDocumentYDoc, getContent } from "./doc-schema";

// Blocks are built the way the editor stores them: elements named after the
// node type, text as Y.XmlText with marks as attributes.
type Inline = string | [string, Record<string, object>];

function text(...parts: Inline[]) {
  const t = new Y.XmlText();
  let offset = 0;
  for (const part of parts) {
    const [s, marks] = typeof part === "string" ? [part, undefined] : part;
    // `{}` for plain text: without attributes, Yjs continues the previous mark.
    t.insert(offset, s, marks ?? {});
    offset += s.length;
  }
  return t;
}

function el(name: string, children: (Y.XmlElement | Y.XmlText)[], attrs = {}) {
  const e = new Y.XmlElement(name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.insert(0, children);
  return e;
}

const heading = (level: number, ...parts: Inline[]) =>
  el("heading", [text(...parts)], { level });
const paragraph = (...parts: Inline[]) => el("paragraph", [text(...parts)]);
const list = (name: "bulletList" | "orderedList", items: Inline[][]) =>
  el(
    name,
    items.map((parts) => el("listItem", [paragraph(...parts)])),
  );

function docWith(blocks: Y.XmlElement[]) {
  const { doc, fragment } = createDocumentYDoc();
  fragment.insert(0, blocks);
  return doc;
}

/** A version with headings, both list kinds, bold and italic. */
function richVersion() {
  return docWith([
    heading(1, "Project plan"),
    paragraph("Ship it ", ["this week", { bold: {} }], " and ", [
      "relax",
      { italic: {} },
    ]),
    heading(2, "Steps"),
    list("bulletList", [["Write"], ["Review"]]),
    list("orderedList", [["One"], [["Two", { bold: {} }]]]),
  ]);
}

const content = (doc: Y.Doc) => getContent(doc).toString();

function recordingSave() {
  const calls: { state: Uint8Array; label: string }[] = [];
  const save: SaveCurrent = async (state, label) => {
    calls.push({ state, label });
    return { ok: true };
  };
  return { save, calls };
}

/** Two docs that exchange every update, like two connected clients. */
function connect(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  a.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin !== "remote") Y.applyUpdate(b, u, "remote");
  });
  b.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin !== "remote") Y.applyUpdate(a, u, "remote");
  });
}

describe("replaceContent", () => {
  it("makes the live content equal the version's (headings, lists, bold, italic)", () => {
    const version = richVersion();
    const live = docWith([
      heading(1, "Something else"),
      paragraph("Lots of ", ["newer", { bold: {} }], " text"),
    ]);

    replaceContent(live, Y.encodeStateAsUpdate(version));

    expect(content(live)).toBe(content(version));
    expect(content(live)).toContain("<bold>this week</bold>");
    expect(content(live)).toContain("<italic>relax</italic>");
    expect(content(live)).toContain('<heading level="2">Steps</heading>');
  });

  it("works on an empty live doc and when restoring an empty version", () => {
    const version = richVersion();
    const empty = createDocumentYDoc().doc;
    replaceContent(empty, Y.encodeStateAsUpdate(version));
    expect(content(empty)).toBe(content(version));

    replaceContent(empty, Y.encodeStateAsUpdate(createDocumentYDoc().doc));
    expect(content(empty)).toBe("");
  });

  it("is a single transaction with RESTORE_ORIGIN", () => {
    const live = docWith([paragraph("old")]);
    const origins: unknown[] = [];
    live.on("afterTransaction", (tr: Y.Transaction) => origins.push(tr.origin));

    replaceContent(live, Y.encodeStateAsUpdate(richVersion()));
    expect(origins).toEqual([RESTORE_ORIGIN]);
  });

  it("syncs to another client, and that client's older state doesn't undo it", () => {
    const version = richVersion();
    const alice = docWith([paragraph("current text")]);
    const bob = new Y.Doc();
    connect(alice, bob);
    // Bob keeps a copy of the pre-restore state (like an offline tab).
    const bobBefore = Y.encodeStateAsUpdate(bob);

    replaceContent(alice, Y.encodeStateAsUpdate(version));
    expect(content(bob)).toBe(content(version));

    // Bob's old state arriving again (a reconnect) changes nothing.
    Y.applyUpdate(alice, bobBefore);
    Y.applyUpdate(bob, bobBefore);
    expect(content(alice)).toBe(content(version));
    expect(content(bob)).toBe(content(version));
  });

  it("can be undone in one step when the undo manager tracks RESTORE_ORIGIN", () => {
    const live = docWith([paragraph("before")]);
    const undo = new Y.UndoManager(getContent(live), {
      trackedOrigins: new Set([RESTORE_ORIGIN]),
    });
    const before = content(live);

    replaceContent(live, Y.encodeStateAsUpdate(richVersion()));
    undo.undo();
    expect(content(live)).toBe(before);
  });
});

describe("restoreDocumentVersion", () => {
  it("saves the current content as “Before restore”, then restores", async () => {
    const version = richVersion();
    const live = docWith([paragraph("work in progress")]);
    const before = content(live);
    const { save, calls } = recordingSave();

    const error = await restoreDocumentVersion(
      live,
      Y.encodeStateAsUpdate(version),
      save,
    );

    expect(error).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.label).toBe(BEFORE_RESTORE_LABEL);
    // The saved state is the content as it was before the restore…
    const saved = new Y.Doc();
    Y.applyUpdate(saved, calls[0]!.state);
    expect(content(saved)).toBe(before);
    // …and the live doc now matches the version.
    expect(content(live)).toBe(content(version));
  });

  it("the “Before restore” version can itself be restored", async () => {
    const live = docWith([paragraph("original")]);
    const { save, calls } = recordingSave();
    await restoreDocumentVersion(
      live,
      Y.encodeStateAsUpdate(richVersion()),
      save,
    );

    await restoreDocumentVersion(live, calls[0]!.state, save);
    expect(content(live)).toBe("<paragraph>original</paragraph>");
  });

  it("changes nothing if the safety save fails", async () => {
    const live = docWith([paragraph("keep me")]);
    const save = vi.fn<SaveCurrent>(async () => ({ error: "Network error" }));

    const error = await restoreDocumentVersion(
      live,
      Y.encodeStateAsUpdate(richVersion()),
      save,
    );

    expect(error).toMatch(/Network error/);
    expect(content(live)).toBe("<paragraph>keep me</paragraph>");
  });
});
