"use client";

import type { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
import type * as Y from "yjs";
import { documentStarterKit } from "@/lib/doc-extensions";
import type { PresenceUser } from "@/lib/presence";
import { RESTORE_ORIGIN } from "@/lib/yjs/doc-restore";
import { DOC_FIELD } from "@/lib/yjs/doc-schema";
import { DocToolbar } from "./DocToolbar";

type Props = {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  /** Me, as shown to others: same name and color as on boards. */
  user: PresenceUser;
  /**
   * Viewers can read but not type. The sync server's read-only connection is the
   * real protection; this only makes the page behave accordingly.
   */
  readOnly: boolean;
  /** Receives the editor once it exists (for focusing it after a restore). */
  onReady?: (editor: Editor) => void;
};

/**
 * The writing page. Its content lives only in the Y.Doc's `content` fragment.
 * There's deliberately no `content` option, because it would insert the text
 * again on every load.
 */
export function DocEditor({ doc, provider, user, readOnly, onReady }: Props) {
  const editor = useEditor(
    {
      // Render on the client only, so the server HTML can't mismatch (no hydration warnings).
      immediatelyRender: false,
      editable: !readOnly,
      autofocus: !readOnly,
      extensions: [
        documentStarterKit,
        Collaboration.configure({ document: doc, field: DOC_FIELD }),
        // Other people's carets and selections travel through awareness (never
        // the Y.Doc). It also publishes `user`, which the Avatars component reads.
        CollaborationCaret.configure({
          provider,
          user,
          selectionRender: (u) => ({
            class: "collaboration-carets__selection",
            // About 20% opacity of the user's color (#rrggbb + alpha 33).
            style: `background-color: ${u.color}33`,
          }),
        }),
        Placeholder.configure({ placeholder: "Start writing…" }),
      ],
      editorProps: {
        attributes: { class: "doc-content", "aria-label": "Document" },
      },
      onCreate: ({ editor }) => {
        // Restoring a version is a transaction with RESTORE_ORIGIN. Tracking it
        // in this editor's Yjs undo manager makes one Ctrl+Z revert the restore.
        yUndoPluginKey
          .getState(editor.state)
          ?.undoManager.addTrackedOrigin(RESTORE_ORIGIN);
        onReady?.(editor);
      },
    },
    // `user` is a new object on each render, so depend on its fields.
    [doc, provider, user.id, user.name, user.color, readOnly],
  );

  return (
    <>
      {!readOnly && <DocToolbar editor={editor} />}
      <div className="flex-1 overflow-y-auto bg-muted/60">
        <div className="mx-auto min-h-full w-full max-w-[720px] border-x bg-background px-6 pt-12 pb-32 sm:px-12">
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}
