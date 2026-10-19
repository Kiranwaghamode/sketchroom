import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createDocumentYDoc } from "./doc-schema";

/** Builds `<tag>text</tag>` the way the editor stores a block (marks as text attributes). */
function block(tag: string, text: string, marks?: Record<string, object>) {
  const element = new Y.XmlElement(tag);
  const content = new Y.XmlText();
  element.insert(0, [content]);
  return { element, fill: () => content.insert(0, text, marks) };
}

describe("createDocumentYDoc", () => {
  it("stores the text in the `content` fragment", () => {
    const { doc, fragment } = createDocumentYDoc();
    expect(fragment).toBe(doc.getXmlFragment("content"));
    expect(fragment.length).toBe(0);
  });

  it("keeps inserted blocks, text and formatting", () => {
    const { doc, fragment } = createDocumentYDoc();
    const heading = block("heading", "Title");
    const paragraph = block("paragraph", "Hello", { bold: {} });
    doc.transact(() => {
      fragment.insert(0, [heading.element, paragraph.element]);
      heading.element.setAttribute("level", "1");
      heading.fill();
      paragraph.fill();
    });

    expect(fragment.toString()).toBe(
      '<heading level="1">Title</heading><paragraph><bold>Hello</bold></paragraph>',
    );
    expect(fragment.toJSON()).toBe(fragment.toString());
  });

  it("survives encoding and decoding (what the server stores)", () => {
    const { doc, fragment } = createDocumentYDoc();
    const paragraph = block("paragraph", "Saved text", { italic: {} });
    fragment.insert(0, [paragraph.element]);
    paragraph.fill();

    const copy = createDocumentYDoc();
    Y.applyUpdate(copy.doc, Y.encodeStateAsUpdate(doc));
    expect(copy.fragment.toString()).toBe(fragment.toString());
  });
});
