import * as Y from "yjs";

/** Name of the Y.XmlFragment holding a document's text (PLAN2 section 0.2). */
export const DOC_FIELD = "content";

export function getContent(doc: Y.Doc) {
  return doc.getXmlFragment(DOC_FIELD);
}

/**
 * A document's Y.Doc. Tiptap's Collaboration extension binds the editor to the
 * `content` fragment; the editor is never given initial `content` of its own.
 */
export function createDocumentYDoc() {
  const doc = new Y.Doc();
  return { doc, fragment: getContent(doc) };
}
