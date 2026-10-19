"use client";

import {
  ChevronDownIcon,
  FileTextIcon,
  PenToolIcon,
  PlusIcon,
} from "lucide-react";
import { useTransition } from "react";
import { createBoard, createDocument } from "@/app/actions/boards";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** "New" → Board / Document. Each action creates the item and redirects to it. */
export function NewItemButton() {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button disabled={pending} />}>
        <PlusIcon />
        {pending ? "Creating…" : "New"}
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => startTransition(() => createBoard())}>
          <PenToolIcon />
          Board
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => startTransition(() => createDocument())}
        >
          <FileTextIcon />
          Document
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
