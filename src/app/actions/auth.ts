"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashPassword, verifyPassword, assertMaxUsers } from "@/lib/password";
import type { FormActionState } from "@/lib/formActionState";

export async function registerCore(formData: FormData): Promise<FormActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || !password) {
    return { error: "Name, email, and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  try {
    await assertMaxUsers(2);
  } catch {
    return { error: "This household already has two accounts." };
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }
  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { name, email, passwordHash },
  });
  redirect("/login?registered=1");
}

export async function registerAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return registerCore(formData);
}

export async function loginCore(formData: FormData): Promise<FormActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  const session = await getSession();
  session.user = {
    userId: user.id,
    email: user.email,
    name: user.name,
  };
  await session.save();
  redirect("/");
}

export async function loginAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  return loginCore(formData);
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
