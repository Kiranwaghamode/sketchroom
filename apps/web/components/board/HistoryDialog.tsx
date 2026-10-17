"use client";

import { HistoryIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as Y from "yjs";
import {
  getVersionState,
  listVersions,
  saveVersion,
  type VersionListItem,
} from "@/app/actions/versions";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { base64ToBytes, bytesToBase64 } from "@/lib/base64";
import { timeAgo } from "@/lib/time";
import { restoreVersion } from "@/lib/yjs/restore";
import { beginGesture, endGesture } from "@/lib/yjs/undo";

type Props = {
  boardId: string;
  doc: Y.Doc;
  /** Owners and editors can save and restore. Viewers only see the list. */
  canEdit: boolean;
  /** Saving needs the current server state, so only when fully synced. */
  synced: boolean;
  undoManager?: Y.UndoManager;
};

export function HistoryDialog({
  boardId,
  doc,
  canEdit,
  synced,
  undoManager,
}: Props) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionListItem[] | null>(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState<VersionListItem | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setVersions(await listVersions(boardId));
  }

  async function save() {
    setSaving(true);
    const result = await saveVersion({
      boardId,
      state: bytesToBase64(Y.encodeStateAsUpdate(doc)),
      label: label.trim() || undefined,
    });
    setSaving(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setLabel("");
    toast.success("Version saved");
    await load();
  }

  async function restore(version: VersionListItem) {
    setBusy(true);
    const result = await getVersionState(boardId, version.id);
    setBusy(false);
    setRestoring(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    // Its own undo step: one undo reverts the whole restore, and nothing else.
    beginGesture(undoManager);
    restoreVersion(doc, base64ToBytes(result.state));
    endGesture(undoManager);
    setOpen(false);
    toast.success("Version restored");
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true);
          setVersions(null);
          void load();
        }}
      >
        <HistoryIcon />
        History
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Version history</DialogTitle>
            <DialogDescription>
              {canEdit
                ? "Save the board as it is now, or go back to an earlier version."
                : "Versions saved by the people who can edit this board."}
            </DialogDescription>
          </DialogHeader>

          {canEdit && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Version name (optional)"
                maxLength={80}
                aria-label="Version name"
              />
              <Button type="submit" disabled={saving || !synced}>
                {saving ? "Saving…" : "Save version"}
              </Button>
            </form>
          )}
          {canEdit && !synced && (
            <p className="text-xs text-muted-foreground">
              You can save a version once the board is connected and synced.
            </p>
          )}

          <div className="max-h-80 overflow-y-auto">
            {versions === null ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : versions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No versions saved yet
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {versions.map((version) => (
                  <li
                    key={version.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {version.label ?? "Untitled version"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {version.createdByName} ·{" "}
                        {timeAgo(new Date(version.createdAt))}
                      </p>
                    </div>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRestoring(version)}
                      >
                        Restore
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={restoring !== null}
        onOpenChange={(o) => !o && setRestoring(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone on the board will see it. You can undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => restoring && void restore(restoring)}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
