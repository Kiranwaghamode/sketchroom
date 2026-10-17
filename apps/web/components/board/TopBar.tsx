"use client";

import { ArrowLeftIcon, HistoryIcon, Share2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { renameBoard } from "@/app/actions/boards";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ConnectionStatus } from "@/lib/yjs/hooks";
import { cn } from "@/lib/utils";

const STATUS: Record<ConnectionStatus, { label: string; className: string }> = {
  connected: { label: "Connected", className: "bg-green-500" },
  connecting: { label: "Connecting…", className: "bg-yellow-400" },
  offline: { label: "Offline", className: "bg-gray-400" },
};

type Props = {
  boardId: string;
  title: string;
  isOwner: boolean;
  status: ConnectionStatus;
  /** Undefined until the board has loaded. */
  saving?: boolean;
};

export function TopBar({
  boardId,
  title: initialTitle,
  isOwner,
  status,
  saving,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [editing, setEditing] = useState(false);

  async function save(value: string) {
    setEditing(false);
    const next = value.trim();
    if (!next || next === title) return;
    const previous = title;
    setTitle(next);
    const result = await renameBoard(boardId, next);
    if ("error" in result) {
      setTitle(previous);
      toast.error(result.error);
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to dashboard"
              nativeButton={false}
              render={<Link href="/dashboard" />}
            />
          }
        >
          <ArrowLeftIcon />
        </TooltipTrigger>
        <TooltipContent side="bottom">Back to dashboard</TooltipContent>
      </Tooltip>

      {editing ? (
        <input
          autoFocus
          defaultValue={title}
          maxLength={80}
          aria-label="Board title"
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => save(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-8 w-64 rounded-md border px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      ) : isOwner ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="h-8 max-w-64 truncate rounded-md px-2 text-sm font-medium hover:bg-muted"
              />
            }
          >
            {title}
          </TooltipTrigger>
          <TooltipContent side="bottom">Rename</TooltipContent>
        </Tooltip>
      ) : (
        <span className="max-w-64 truncate px-2 text-sm font-medium">
          {title}
        </span>
      )}

      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className="flex size-6 items-center justify-center"
              tabIndex={0}
            />
          }
        >
          <span
            aria-label={STATUS[status].label}
            className={cn("size-2.5 rounded-full", STATUS[status].className)}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">{STATUS[status].label}</TooltipContent>
      </Tooltip>
      {status === "connected" && saving !== undefined && (
        <span className="text-xs text-muted-foreground">
          {saving ? "Saving…" : "Saved"}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Online user avatars: Phase 6 */}
        {/* Share: Phase 5 */}
        <Button variant="outline" size="sm" disabled>
          <Share2Icon />
          Share
        </Button>
        {/* History: Phase 9 */}
        <Button variant="ghost" size="sm" disabled>
          <HistoryIcon />
          History
        </Button>
      </div>
    </header>
  );
}
