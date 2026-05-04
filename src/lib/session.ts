import type { SessionOptions } from "iron-session";
import { getSessionPassword } from "./env";

export function getSessionOptions(): SessionOptions {
  return {
    cookieName: "household_budget",
    password: getSessionPassword(),
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    },
  };
}

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
};

export type SessionData = {
  user?: SessionUser;
};
