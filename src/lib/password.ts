import { hash, compare } from "bcryptjs";
import { prisma } from "./prisma";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ROUNDS);
}

export async function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(plain, passwordHash);
}

export async function assertMaxUsers(max = 2): Promise<void> {
  const count = await prisma.user.count();
  if (count >= max) {
    throw new Error("This household already has the maximum number of accounts.");
  }
}
