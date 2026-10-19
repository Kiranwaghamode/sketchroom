"use client";

import {
  LogOutIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteBoard, leaveBoard, renameBoard } from "@/app/actions/boards";
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
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Kind = "BOARD" | "DOC";
/** "board" or "document", for menu and dialog wording. */
const noun = (kind: Kind) => (kind === "DOC" ? "document" : "board");

type Props = { boardId: string; kind?: Kind; title: string; isOwner: boolean };

export function BoardCardMenu({
  boardId,
  kind = "BOARD",
  title,
  isOwner,
}: Props) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function onLeave() {
    const result = await leaveBoard(boardId);
    if ("error" in result) toast.error(result.error);
    else toast.success(`You left the ${noun(kind)}`);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={kind === "DOC" ? "Document options" : "Board options"}
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {isOwner ? (
            <>
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <PencilIcon />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={onLeave}>
              <LogOutIcon />
              Leave {noun(kind)}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isOwner && (
        <>
          <RenameDialog
            boardId={boardId}
            kind={kind}
            title={title}
            open={renameOpen}
            onOpenChange={setRenameOpen}
          />
          <DeleteDialog
            boardId={boardId}
            kind={kind}
            title={title}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
          />
        </>
      )}
    </>
  );
}

type DialogProps = {
  boardId: string;
  kind: Kind;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function RenameDialog({
  boardId,
  kind,
  title,
  open,
  onOpenChange,
}: DialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const value = String(new FormData(event.currentTarget).get("title") ?? "");
    const result = await renameBoard(boardId, value);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Rename {noun(kind)}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`title-${boardId}`}>Title</Label>
            <Input
              id={`title-${boardId}`}
              name="title"
              defaultValue={title}
              maxLength={80}
              required
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  boardId,
  kind,
  title,
  open,
  onOpenChange,
}: DialogProps) {
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    const result = await deleteBoard(boardId);
    setPending(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    onOpenChange(false);
    toast.success(kind === "DOC" ? "Document deleted" : "Board deleted");
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {noun(kind)}?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{title}&rdquo; will be deleted for everyone it&rsquo;s shared
            with. This can&rsquo;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onDelete}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
