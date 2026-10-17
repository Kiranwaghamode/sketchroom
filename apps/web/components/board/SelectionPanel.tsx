"use client";

import { COLORS, type Shape } from "@whiteboard/shared";
import { Trash2Icon } from "lucide-react";
import { useMemo } from "react";
import type * as Y from "yjs";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  shapeBounds,
  unionBoxes,
  worldToScreen,
  type Box,
} from "@/lib/geometry";
import { cn } from "@/lib/utils";
import { useStore, type Store } from "@/lib/yjs/hooks";
import { deleteShapes, updateShapes } from "@/lib/yjs/mutations";
import { getShapes } from "@/lib/yjs/schema";
import { useEditor, type Camera } from "@/stores/editor";

const PANEL_GAP = 12;
const TOP_SAFE_AREA = 56; // room for the panel above the selection

type SelectionInfo = { box: Box | null; color: string | null };

/** Bounding box (world) and shared color of the selected shapes. Updates on every doc change. */
function selectionStore(doc: Y.Doc, ids: string[]): Store<SelectionInfo> {
  const read = (): SelectionInfo => {
    const shapes = getShapes(doc);
    const list = ids.flatMap((id) => {
      const shape = shapes.get(id)?.toJSON() as Shape | undefined;
      return shape ? [shape] : [];
    });
    const colors = new Set(list.map((s) => s.color));
    return {
      box: unionBoxes(list.map(shapeBounds)),
      color: colors.size === 1 ? [...colors][0]! : null,
    };
  };
  let snapshot = read();
  let key = JSON.stringify(snapshot);
  // Returns true if the info changed, so unrelated edits don't re-render the panel.
  const refresh = () => {
    const next = read();
    const nextKey = JSON.stringify(next);
    if (nextKey === key) return false;
    snapshot = next;
    key = nextKey;
    return true;
  };
  return {
    subscribe(onChange) {
      const handler = () => {
        if (refresh()) onChange();
      };
      refresh();
      doc.on("update", handler);
      return () => doc.off("update", handler);
    },
    get: () => snapshot,
  };
}

/**
 * Color swatches + Delete, floating above the selection. With nothing selected and a
 * drawing tool active, shows only the swatches (above the toolbar) to pick the next color.
 */
export function SelectionPanel({ doc }: { doc: Y.Doc }) {
  const selectedIds = useEditor((s) => s.selectedIds);
  const tool = useEditor((s) => s.tool);
  const camera = useEditor((s) => s.camera);
  const color = useEditor((s) => s.color);
  const setColor = useEditor((s) => s.setColor);
  const setSelection = useEditor((s) => s.setSelection);
  const info = useStore(
    useMemo(() => selectionStore(doc, selectedIds), [doc, selectedIds]),
  );

  const box = selectedIds.length > 0 ? info.box : null;
  if (!box && tool === "select") return null;

  function pickColor(value: string) {
    setColor(value);
    if (selectedIds.length > 0) {
      updateShapes(
        doc,
        selectedIds.map((id) => ({ id, patch: { color: value } })),
      );
    }
  }

  const activeColor = box ? info.color : color;
  const swatches = COLORS.map((c) => {
    const active = activeColor === c.value;
    return (
      <Tooltip key={c.value}>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={c.name}
              aria-pressed={active}
              onClick={() => pickColor(c.value)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md hover:bg-muted",
                active && "bg-muted",
              )}
            />
          }
        >
          <span
            className="size-4 rounded-full"
            style={{
              backgroundColor: c.value,
              boxShadow: active
                ? `0 0 0 2px white, 0 0 0 3.5px ${c.value}`
                : undefined,
            }}
          />
        </TooltipTrigger>
        <TooltipContent side="top">{c.name}</TooltipContent>
      </Tooltip>
    );
  });

  if (!box) {
    return (
      <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-background p-1 shadow-md">
        {swatches}
      </div>
    );
  }

  return (
    <div
      className="absolute flex items-center gap-1 rounded-xl border bg-background p-1 shadow-md"
      style={panelPosition(box, camera)}
    >
      {swatches}
      <div className="mx-1 h-5 w-px bg-border" />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete"
              onClick={() => {
                deleteShapes(doc, selectedIds);
                setSelection([]);
              }}
            />
          }
        >
          <Trash2Icon />
        </TooltipTrigger>
        <TooltipContent side="top">
          Delete <span className="ml-1 opacity-60">Del</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function panelPosition(box: Box, camera: Camera): React.CSSProperties {
  const topLeft = worldToScreen(box, camera);
  const centerX = topLeft.x + (box.width * camera.zoom) / 2;
  // Above the selection, or below it if there's no room under the top bar.
  const above = topLeft.y - PANEL_GAP > TOP_SAFE_AREA;
  return {
    left: `clamp(150px, ${centerX}px, calc(100% - 150px))`,
    top: above
      ? topLeft.y - PANEL_GAP
      : topLeft.y + box.height * camera.zoom + PANEL_GAP,
    transform: `translate(-50%, ${above ? "-100%" : "0"})`,
  };
}
