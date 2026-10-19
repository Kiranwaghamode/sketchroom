import StarterKit from "@tiptap/starter-kit";

/**
 * The document schema: StarterKit with only what this MVP allows. Shared by the
 * editor and the seed script, so seeded documents match what the editor writes.
 */
export const documentStarterKit = StarterKit.configure({
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
});
