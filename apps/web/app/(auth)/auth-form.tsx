"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { signInAsDemo } from "@/app/actions/demo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = safeNext(nextParam);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [demoPending, startDemo] = useTransition();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const { error } =
      mode === "signup"
        ? await authClient.signUp.email({
            name: String(form.get("name") ?? "").trim(),
            email,
            password,
          })
        : await authClient.signIn.email({ email, password });

    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.");
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const otherHref = `${mode === "login" ? "/signup" : "/login"}${
    nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""
  }`;

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {mode === "login" ? "Log in" : "Create an account"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Welcome back. Enter your email and password."
              : "Start drawing together in seconds."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="flex flex-col gap-4">
            {mode === "signup" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={mode === "signup" ? 8 : undefined}
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">
                  At least 8 characters.
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter className="mt-6 flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending
                ? mode === "login"
                  ? "Logging in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Log in"
                  : "Sign up"}
            </Button>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "No account yet? "
                : "Already have an account? "}
              <Link
                href={otherHref}
                className="text-foreground underline underline-offset-4"
              >
                {mode === "login" ? "Sign up" : "Log in"}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
      {mode === "login" && (
        <div className="flex w-full max-w-sm flex-col items-center gap-2">
          <span className="text-xs text-muted-foreground">or</span>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={demoPending}
            onClick={() =>
              startDemo(async () => {
                setError(null);
                const result = await signInAsDemo(); // redirects on success
                setError(result.error);
              })
            }
          >
            {demoPending ? "Opening the demo…" : "Try the demo"}
          </Button>
        </div>
      )}
    </div>
  );
}
