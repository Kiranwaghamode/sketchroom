import { prisma } from "@whiteboard/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  // Lets server actions set auth cookies. Must be the last plugin.
  plugins: [nextCookies()],
});

/** The current session, or null when logged out. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** The current user. Redirects to /login when logged out. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}
