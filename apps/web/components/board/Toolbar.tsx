"use client";

import {
  CircleIcon,
  MousePointer2Icon,
  PencilIcon,
  Redo2Icon,
  SquareIcon,
  TypeIcon,
  Undo2Icon,
} from "lucide-react";
import type * as Y from "yjs";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUndoState } from "@/lib/yjs/undo";
import { useEditor, type Tool } from "@/stores/editor";

const TOOLS: {
  tool: Tool;
  label: string;
  shortcut: string;
  icon: React.ElementType;
}[] = [
  { tool: "select", label: "Select", shortcut: "V", icon: MousePointer2Icon },
  { tool: "rect", label: "Rectangle", shortcut: "R", icon: SquareIcon },
  { tool: "ellipse", label: "Ellipse", shortcut: "O", icon: CircleIcon },
  { tool: "text", label: "Text", shortcut: "T", icon: TypeIcon },
  { tool: "pen", label: "Pen", shortcut: "P", icon: PencilIcon },
];

export function Toolbar({ undoManager }: { undoManager: Y.UndoManager }) {
  const current = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const setSelection = useEditor((s) => s.setSelection);

  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-background p-1 shadow-md">
      {TOOLS.map(({ tool, label, shortcut, icon: Icon }) => (
        <Tooltip key={tool}>
          <TooltipTrigger
            render={
              <Button
                variant={current === tool ? "secondary" : "ghost"}
                size="icon"
                aria-label={label}
                aria-pressed={current === tool}
                onClick={() => {
                  setTool(tool);
                  if (tool !== "select") setSelection([]);
                }}
              />
            }
          >
            <Icon />
          </TooltipTrigger>
          <TooltipContent side="top">
            {label} <span className="ml-1 opacity-60">{shortcut}</span>
          </TooltipContent>
        </Tooltip>
      ))}
      <div className="mx-1 h-6 w-px bg-border" />
      <UndoRedo undoManager={undoManager} />
    </div>
  );
}

function UndoRedo({ undoManager }: { undoManager: Y.UndoManager }) {
  const { canUndo, canRedo } = useUndoState(undoManager);
  // The toolbar only renders in the browser, so reading navigator here is safe.
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
  const buttons = [
    {
      label: "Undo",
      shortcut: `${mod}Z`,
      icon: Undo2Icon,
      enabled: canUndo,
      run: () => undoManager.undo(),
    },
    {
      label: "Redo",
      shortcut: `${mod}Shift+Z`,
      icon: Redo2Icon,
      enabled: canRedo,
      run: () => undoManager.redo(),
    },
  ];
  return buttons.map(({ label, shortcut, icon: Icon, enabled, run }) => (
    <Tooltip key={label}>
      {/* A disabled button gets no hover events, so the span is the trigger. */}
      <TooltipTrigger render={<span tabIndex={-1} />}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={!enabled}
          onClick={run}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {label} <span className="ml-1 opacity-60">{shortcut}</span>
      </TooltipContent>
    </Tooltip>
  ));
}
