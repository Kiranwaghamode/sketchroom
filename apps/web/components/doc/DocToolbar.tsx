"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  BoldIcon,
  Heading1Icon,
  Heading2Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Format = {
  label: string;
  /** Keys after the modifier, e.g. ["Alt", "1"] → "Ctrl+Alt+1" / "⌘⌥1". */
  keys: string[];
  icon: React.ElementType;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const FORMATS: Format[] = [
  {
    label: "Heading 1",
    keys: ["Alt", "1"],
    icon: Heading1Icon,
    isActive: (e) => e.isActive("heading", { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: "Heading 2",
    keys: ["Alt", "2"],
    icon: Heading2Icon,
    isActive: (e) => e.isActive("heading", { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Bold",
    keys: ["B"],
    icon: BoldIcon,
    isActive: (e) => e.isActive("bold"),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: "Italic",
    keys: ["I"],
    icon: ItalicIcon,
    isActive: (e) => e.isActive("italic"),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: "Bullet list",
    keys: ["Shift", "8"],
    icon: ListIcon,
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Numbered list",
    keys: ["Shift", "7"],
    icon: ListOrderedIcon,
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
];

/** Headings · marks · lists, separated by thin dividers. */
const GROUPS = [FORMATS.slice(0, 2), FORMATS.slice(2, 4), FORMATS.slice(4)];

function shortcut(keys: string[]) {
  // The toolbar only renders in the browser, so reading navigator here is safe.
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  if (!mac) return ["Ctrl", ...keys].join("+");
  const symbols: Record<string, string> = { Alt: "⌥", Shift: "⇧" };
  return "⌘" + keys.map((k) => symbols[k] ?? k).join("");
}

/** The slim formatting row under the top bar. */
export function DocToolbar({ editor }: { editor: Editor | null }) {
  // Re-renders only when an active state changes, not on every keystroke.
  const active = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor ? FORMATS.map((f) => f.isActive(editor)).join() : "",
  });
  const isActive = active?.split(",").map((v) => v === "true") ?? [];

  return (
    <div className="flex h-10 shrink-0 items-center justify-center gap-0.5 border-b bg-background px-2">
      {editor &&
        GROUPS.map((group, i) => (
          <div key={i} className="flex items-center gap-0.5">
            {i > 0 && <div className="mx-1.5 h-5 w-px bg-border" />}
            {group.map((format) => {
              const on = isActive[FORMATS.indexOf(format)] ?? false;
              const Icon = format.icon;
              return (
                <Tooltip key={format.label}>
                  <TooltipTrigger
                    render={
                      <Button
                        variant={on ? "secondary" : "ghost"}
                        size="icon-sm"
                        aria-label={format.label}
                        aria-pressed={on}
                        // Keep the text selection: don't move focus to the button.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => format.run(editor)}
                      />
                    }
                  >
                    <Icon />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {format.label}{" "}
                    <span className="ml-1 opacity-60">
                      {shortcut(format.keys)}
                    </span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
    </div>
  );
}
