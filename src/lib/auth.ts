import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionData, SessionUser } from "./session";
import { getSessionOptions } from "./session";

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session.user) redirect("/login");
  return session.user;
}
