"use client";

import Collaboration from "@tiptap/extension-collaboration";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type * as Y from "yjs";
import { DOC_FIELD } from "@/lib/yjs/doc-schema";
import { DocToolbar } from "./DocToolbar";

type Props = { doc: Y.Doc };

/**
 * The writing page. Its content lives only in the Y.Doc's `content` fragment.
 * There's deliberately no `content` option, because it would insert the text
 * again on every load.
 */
export function DocEditor({ doc }: Props) {
  const editor = useEditor(
    {
      // Render on the client only, so the server HTML can't mismatch (no hydration warnings).
      immediatelyRender: false,
      autofocus: true,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2] },
          // Collaboration brings its own Yjs undo, so Tiptap's history must be off.
          undoRedo: false,
          // Not in this MVP (PLAN2 section 3).
          blockquote: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
          strike: false,
          link: false,
          underline: false,
          // Gap cursors only matter for non-text blocks, which we don't have. The
          // trailing node would add an empty paragraph on every client independently.
          gapcursor: false,
          trailingNode: false,
        }),
        Collaboration.configure({ document: doc, field: DOC_FIELD }),
        Placeholder.configure({ placeholder: "Start writing…" }),
      ],
      editorProps: {
        attributes: { class: "doc-content", "aria-label": "Document" },
      },
    },
    [doc],
  );

  return (
    <>
      <DocToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto bg-muted/60">
        <div className="mx-auto min-h-full w-full max-w-[720px] border-x bg-background px-6 pt-12 pb-32 sm:px-12">
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}
