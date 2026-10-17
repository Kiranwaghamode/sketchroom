"use client";

import {
  CircleIcon,
  MousePointer2Icon,
  PencilIcon,
  SquareIcon,
  TypeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export function Toolbar() {
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
    </div>
  );
}
