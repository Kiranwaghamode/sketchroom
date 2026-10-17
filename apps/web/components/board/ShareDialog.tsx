"use client";

import { CopyIcon, Share2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getOrCreateShareLink, resetShareLinks } from "@/app/actions/share";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ROWS = [
  { role: "EDITOR", label: "Anyone with the link can edit" },
  { role: "VIEWER", label: "Anyone with the link can view" },
] as const;

export function ShareDialog({
  boardId,
  isOwner,
}: {
  boardId: string;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOwner) {
    return (
      <Tooltip>
        {/* A disabled button gets no hover events, so the span is the trigger. */}
        <TooltipTrigger render={<span tabIndex={0} />}>
          <Button variant="outline" size="sm" disabled>
            <Share2Icon />
            Share
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Only the owner can share</TooltipContent>
      </Tooltip>
    );
  }

  async function copyLink(role: (typeof ROWS)[number]["role"]) {
    const result = await getOrCreateShareLink(boardId, role);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    const url = `${window.location.origin}${result.path}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      // Clipboard can be blocked (permissions, insecure context): show the link instead.
      toast(`Couldn't copy automatically. Here's the link: ${url}`, {
        duration: 15000,
      });
    }
  }

  async function reset() {
    setBusy(true);
    const result = await resetShareLinks(boardId);
    setBusy(false);
    setConfirmReset(false);
    if ("error" in result) toast.error(result.error);
    else toast.success("Links reset. Old links no longer work.");
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2Icon />
        Share
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share board</DialogTitle>
            <DialogDescription>
              People who open a link need to log in, then the board appears on
              their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {ROWS.map(({ role, label }) => (
              <div
                key={role}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <span className="text-sm">{label}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyLink(role)}
                >
                  <CopyIcon />
                  Copy link
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmReset(true)}
            >
              Reset links
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset share links?</AlertDialogTitle>
            <AlertDialogDescription>
              Both links will stop working. People who already joined keep their
              access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={reset}
              disabled={busy}
            >
              Reset links
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
