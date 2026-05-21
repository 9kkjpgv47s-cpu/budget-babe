import path from "path";
import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  filenameHintFromStoragePath,
  readReceiptBinary,
  uploadsUseVercelBlob,
} from "@/lib/uploads";

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
  const receipt = await prisma.receipt.findUnique({ where: { id } });
  if (!receipt) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ref = receipt.filename;
  const hint = filenameHintFromStoragePath(ref);
  const type = contentTypeFromName(hint);

  if (ref.startsWith("https://") || ref.startsWith("http://")) {
    if (uploadsUseVercelBlob()) {
      try {
        const buf = await readReceiptBinary(ref);
        return new NextResponse(new Uint8Array(buf), {
          headers: {
            "Content-Type": type,
            "Content-Disposition": `inline; filename="${hint}"`,
            "Cache-Control": "private, no-store",
          },
        });
      } catch {
        return new NextResponse("File missing", { status: 404 });
      }
    }
    return NextResponse.redirect(ref);
  }

  const filePath = path.join(process.cwd(), "data", "receipts", path.basename(ref));
  try {
    await stat(filePath);
  } catch {
    return new NextResponse("File missing", { status: 404 });
  }
  const buf = await readFile(filePath);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${hint}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
