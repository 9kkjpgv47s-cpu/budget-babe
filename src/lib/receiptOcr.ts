import path from "path";
import { readFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseMoneyToCents } from "@/lib/money";

export type ParsedReceiptLine = {
  description: string;
  amountCents: number | null;
};

const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
]);

function extOf(filename: string): string {
  return path.extname(filename).toLowerCase();
}

/**
 * Pull likely line items: text ending in a currency amount.
 */
export function parseReceiptLines(raw: string): ParsedReceiptLine[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const amountTail =
    /\s+(-?[\$€£]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|-?\d+\.\d{1,2})\s*$/;
  const out: ParsedReceiptLine[] = [];

  for (const line of lines) {
    const m = line.match(amountTail);
    if (!m) continue;
    const desc = line.slice(0, m.index).trim();
    const amtStr = m[1].replace(/[\$€£\s]/g, "").replace(/,/g, "");
    const amountCents = parseMoneyToCents(amtStr);
    if (!desc || desc.length < 2) continue;
    if (desc.length > 200) continue;
    out.push({ description: desc, amountCents });
  }

  return out;
}

/**
 * Best-effort total from common receipt keywords.
 */
export function parseLikelyTotalCents(raw: string): number | null {
  const upper = raw.toUpperCase();
  const patterns = [
    /TOTAL[:\s]+[\$€£]?\s*([\d,]+\.\d{2})/i,
    /AMOUNT\s+DUE[:\s]+[\$€£]?\s*([\d,]+\.\d{2})/i,
    /BALANCE[:\s]+[\$€£]?\s*([\d,]+\.\d{2})/i,
    /GRAND\s*TOTAL[:\s]+[\$€£]?\s*([\d,]+\.\d{2})/i,
    /^[\$€£]?\s*([\d,]+\.\d{2})\s*$/m,
  ];
  for (const re of patterns) {
    const m = upper.match(re) ?? raw.match(re);
    if (m?.[1]) {
      const cents = parseMoneyToCents(m[1].replace(/,/g, ""));
      if (cents != null && cents > 0 && cents < 1_000_000_00) return cents;
    }
  }
  return null;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

async function extractImageText(
  buffer: Buffer,
  ext: string,
): Promise<{ text: string; confidence: number | null }> {
  let imageBuffer: Buffer = buffer;
  if (ext === ".tif" || ext === ".tiff") {
    const sharp = (await import("sharp")).default;
    imageBuffer = await sharp(buffer).png().toBuffer();
  }

  const Tesseract = await import("tesseract.js");
  const worker = await Tesseract.createWorker("eng", 1, {
    // Avoid worker blob issues in some Node runtimes
    workerBlobURL: false,
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });
    const result = await worker.recognize(imageBuffer);
    const text = result.data.text ?? "";
    const confidence =
      typeof result.data.confidence === "number" &&
      !Number.isNaN(result.data.confidence)
        ? Math.round(Math.min(100, Math.max(0, result.data.confidence)))
        : null;
    return { text, confidence };
  } finally {
    await worker.terminate();
  }
}

export async function processReceiptOcrFile(receiptId: string): Promise<void> {
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt) return;

  const ext = extOf(receipt.filename);
  const filePath = path.join(process.cwd(), "data", "receipts", receipt.filename);

  await prisma.receipt.update({
    where: { id: receiptId },
    data: { ocrStatus: "processing", ocrError: null },
  });

  try {
    let rawText = "";
    let confidence: number | null = null;

    if (ext === ".pdf") {
      const buf = await readFile(filePath);
      rawText = await extractPdfText(buf);
      if (!rawText.trim()) {
        await prisma.receipt.update({
          where: { id: receiptId },
          data: {
            ocrStatus: "completed",
            ocrRawText: "",
            ocrParsedLines: JSON.stringify([]),
            ocrConfidence: null,
            ocrError:
              "No embedded text found in this PDF (likely a scan). Use a photo instead for OCR.",
          },
        });
        revalidatePath("/");
        revalidatePath("/receipts");
        return;
      }
    } else if (IMAGE_EXT.has(ext)) {
      const buf = await readFile(filePath);
      const ocr = await extractImageText(buf, ext);
      rawText = ocr.text;
      confidence = ocr.confidence;
    } else {
      await prisma.receipt.update({
        where: { id: receiptId },
        data: {
          ocrStatus: "skipped",
          ocrError: `Unsupported file type (${ext || "unknown"}) for OCR.`,
        },
      });
      revalidatePath("/");
      revalidatePath("/receipts");
      return;
    }

    const parsed = parseReceiptLines(rawText);
    const likelyTotal = parseLikelyTotalCents(rawText);

    const update: Parameters<typeof prisma.receipt.update>[0]["data"] = {
      ocrStatus: "completed",
      ocrRawText: rawText.slice(0, 50_000),
      ocrParsedLines: JSON.stringify(parsed.slice(0, 200)),
      ocrConfidence: confidence,
      ocrError: null,
    };

    if (receipt.totalCents == null && likelyTotal != null) {
      update.totalCents = likelyTotal;
    }

    await prisma.receipt.update({
      where: { id: receiptId },
      data: update,
    });
    revalidatePath("/");
    revalidatePath("/receipts");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ocrStatus: "failed",
        ocrError: message.slice(0, 2000),
      },
    });
    revalidatePath("/");
    revalidatePath("/receipts");
  }
}
