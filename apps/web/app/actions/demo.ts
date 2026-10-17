"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const DEMO_EMAIL = "demo@whiteboard.dev";

/** "Try the demo": signs in as the seeded demo user. The password never leaves the server. */
export async function signInAsDemo(): Promise<{ error: string }> {
  const password = process.env["DEMO_PASSWORD"];
  if (!password) return { error: "The demo isn't set up on this server" };
  try {
    // nextCookies() (in lib/auth.ts) sets the session cookie on this response.
    await auth.api.signInEmail({
      body: { email: DEMO_EMAIL, password },
      headers: await headers(),
    });
  } catch {
    return { error: "The demo account isn't available right now" };
  }
  redirect("/dashboard");
}
