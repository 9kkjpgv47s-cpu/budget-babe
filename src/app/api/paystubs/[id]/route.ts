import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  filenameHintFromStoragePath,
  readPaystubBinary,
  uploadsUseVercelBlob,
} from "@/lib/uploads";

function contentTypeFromName(name: string): string {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
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

  const hint = filenameHintFromStoragePath(ref);
  const type = contentTypeFromName(hint);

  if (ref.startsWith("https://") || ref.startsWith("http://")) {
    if (uploadsUseVercelBlob()) {
      try {
        const buf = await readPaystubBinary(ref);
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

  try {
    const buf = await readPaystubBinary(ref);
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
