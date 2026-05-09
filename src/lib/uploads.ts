import { mkdir, unlink, writeFile, readFile } from "fs/promises";
import path from "path";

/** Stored file reference: public blob HTTPS URL, or local basename under `data/<folder>/`. */

export function filenameHintFromStoragePath(storagePath: string): string {
  if (storagePath.startsWith("https://") || storagePath.startsWith("http://")) {
    try {
      const seg = new URL(storagePath).pathname.split("/").filter(Boolean).pop();
      return seg || "upload.bin";
    } catch {
      return "upload.bin";
    }
  }
  return path.basename(storagePath);
}

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

export function uploadsUseVercelBlob(): boolean {
  return Boolean(blobToken());
}

export async function saveReceiptUpload(params: {
  buffer: Buffer;
  basename: string;
}): Promise<string> {
  const token = blobToken();
  if (token) {
    const { put } = await import("@vercel/blob");
    const safe = params.basename.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80);
    const key = `receipts/${Date.now()}-${safe || "upload"}`;
    const blob = await put(key, params.buffer, {
      access: "public",
      token,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const uploadDir = path.join(process.cwd(), "data", "receipts");
  await mkdir(uploadDir, { recursive: true });
  const ext = path.extname(params.basename) || ".bin";
  const safeBase = path
    .basename(params.basename, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 40);
  const filename = `${Date.now()}-${safeBase || "receipt"}${ext}`;
  await writeFile(path.join(uploadDir, filename), params.buffer);
  return filename;
}

export async function savePaystubUpload(params: {
  buffer: Buffer;
  basename: string;
}): Promise<string> {
  const token = blobToken();
  if (token) {
    const { put } = await import("@vercel/blob");
    const safe = params.basename.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80);
    const key = `paystubs/${Date.now()}-${safe || "paystub"}`;
    const blob = await put(key, params.buffer, {
      access: "public",
      token,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const uploadDir = path.join(process.cwd(), "data", "paystubs");
  await mkdir(uploadDir, { recursive: true });
  const ext = path.extname(params.basename) || ".bin";
  const safeBase = path
    .basename(params.basename, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 40);
  const filename = `${Date.now()}-${safeBase || "paystub"}${ext}`;
  await writeFile(path.join(uploadDir, filename), params.buffer);
  return filename;
}

export async function readReceiptBinary(storagePath: string): Promise<Buffer> {
  if (storagePath.startsWith("https://") || storagePath.startsWith("http://")) {
    const res = await fetch(storagePath, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Receipt file fetch failed (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  const fp = path.join(process.cwd(), "data", "receipts", path.basename(storagePath));
  return readFile(fp);
}

export async function readPaystubBinary(storagePath: string): Promise<Buffer> {
  if (storagePath.startsWith("https://") || storagePath.startsWith("http://")) {
    const res = await fetch(storagePath, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Pay stub file fetch failed (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  const fp = path.join(process.cwd(), "data", "paystubs", path.basename(storagePath));
  return readFile(fp);
}

export async function deleteReceiptStored(storagePath: string): Promise<void> {
  if (storagePath.startsWith("https://") || storagePath.startsWith("http://")) {
    const token = blobToken();
    if (token) {
      const { del } = await import("@vercel/blob");
      await del(storagePath, { token }).catch(() => {});
    }
    return;
  }
  await unlink(
    path.join(process.cwd(), "data", "receipts", path.basename(storagePath)),
  ).catch(() => {});
}

export async function deletePaystubStored(storagePath: string): Promise<void> {
  if (storagePath.startsWith("https://") || storagePath.startsWith("http://")) {
    const token = blobToken();
    if (token) {
      const { del } = await import("@vercel/blob");
      await del(storagePath, { token }).catch(() => {});
    }
    return;
  }
  await unlink(
    path.join(process.cwd(), "data", "paystubs", path.basename(storagePath)),
  ).catch(() => {});
}
