import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({ where: { id } });
  if (!receipt) {
    return new NextResponse("Not found", { status: 404 });
  }
  const filePath = path.join(process.cwd(), "data", "receipts", receipt.filename);
  try {
    await stat(filePath);
  } catch {
    return new NextResponse("File missing", { status: 404 });
  }
  const buf = await readFile(filePath);
  const ext = path.extname(receipt.filename).toLowerCase();
  const type =
    ext === ".pdf"
      ? "application/pdf"
      : ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
  return new NextResponse(buf, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${receipt.filename}"`,
    },
  });
}
