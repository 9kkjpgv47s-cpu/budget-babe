import path from "path";
import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { filenameHintFromStoragePath } from "@/lib/uploads";

function contentTypeFromName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const paycheck = await prisma.paycheck.findUnique({
    where: { id },
    select: { imageFilename: true },
  });
  const ref = paycheck?.imageFilename;
  if (!ref) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (ref.startsWith("https://") || ref.startsWith("http://")) {
    return NextResponse.redirect(ref);
  }

  const filePath = path.join(process.cwd(), "data", "paystubs", path.basename(ref));
  try {
    await stat(filePath);
  } catch {
    return new NextResponse("File missing", { status: 404 });
  }
  const buf = await readFile(filePath);
  const hint = filenameHintFromStoragePath(ref);
  const type = contentTypeFromName(hint);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${hint}"`,
    },
  });
}
