"use client";

import { PlusIcon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { createBoard } from "@/app/actions/boards";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <PlusIcon />
      {pending ? "Creating…" : "New board"}
    </Button>
  );
}

export function NewBoardButton() {
  return (
    <form action={createBoard}>
      <SubmitButton />
    </form>
  );
}
