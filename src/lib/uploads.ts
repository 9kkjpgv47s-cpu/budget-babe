import { mkdir, unlink, writeFile, readFile } from "fs/promises";
import path from "path";

/** Stored file reference: private blob HTTPS URL, or local basename under `data/<folder>/`. */

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

function isRemoteStoragePath(storagePath: string): boolean {
  return storagePath.startsWith("https://") || storagePath.startsWith("http://");
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.length) chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return Buffer.from(merged);
}

async function readRemoteBinary(storagePath: string): Promise<Buffer> {
  const token = blobToken();
  if (token) {
    const { get } = await import("@vercel/blob");
    const result = await get(storagePath, { access: "private", token });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error("Stored file not found in blob storage.");
    }
    return streamToBuffer(result.stream);
  }
  const res = await fetch(storagePath, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`File fetch failed (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
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
      access: "private",
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
      access: "private",
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
  if (isRemoteStoragePath(storagePath)) {
    return readRemoteBinary(storagePath);
  }
  const fp = path.join(process.cwd(), "data", "receipts", path.basename(storagePath));
  return readFile(fp);
}

export async function readPaystubBinary(storagePath: string): Promise<Buffer> {
  if (isRemoteStoragePath(storagePath)) {
    return readRemoteBinary(storagePath);
  }
  const fp = path.join(process.cwd(), "data", "paystubs", path.basename(storagePath));
  return readFile(fp);
}

export async function deleteReceiptStored(storagePath: string): Promise<void> {
  if (isRemoteStoragePath(storagePath)) {
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
  if (isRemoteStoragePath(storagePath)) {
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
