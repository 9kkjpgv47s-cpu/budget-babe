const MAX_PDF_OCR_PAGES = 5;
const MIN_EMBEDDED_CHARS = 140;

/**
 * True when the PDF already has enough selectable text (skip slow raster OCR).
 */
export function pdfHasRichEmbeddedText(text: string): boolean {
  const t = text.trim();
  if (t.length < MIN_EMBEDDED_CHARS) return false;
  const lines = t.split(/\r?\n/).filter((l) => l.trim().length > 3);
  return lines.length >= 4;
}

/**
 * Rasterize the first N pages and OCR each as PNG. Requires native `canvas`
 * (node-canvas) for pdf.js rendering in Node.
 */
export async function extractPdfTextViaRasterOcr(
  buffer: Buffer,
): Promise<{ text: string; confidence: number | null }> {
  /**
   * Keep pdfjs/pdf-parse out of module-eval time so routes that merely import
   * paystub/receipt helpers (e.g. dashboard actions) do not require DOM globals.
   */
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const shot = await parser.getScreenshot({
      first: MAX_PDF_OCR_PAGES,
      desiredWidth: 1700,
      imageBuffer: true,
      imageDataUrl: false,
    });

    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng", 1, {
      workerBlobURL: false,
    });

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      });

      const parts: string[] = [];
      let confSum = 0;
      let confN = 0;

      for (const page of shot.pages) {
        if (!page.data?.length) continue;
        const png = Buffer.from(page.data);
        const result = await worker.recognize(png);
        const block = (result.data.text ?? "").trim();
        if (block) {
          parts.push(`--- Page ${page.pageNumber} ---\n${block}`);
        }
        if (
          typeof result.data.confidence === "number" &&
          !Number.isNaN(result.data.confidence)
        ) {
          confSum += result.data.confidence;
          confN += 1;
        }
      }

      const text = parts.join("\n\n");
      const confidence =
        confN > 0
          ? Math.round(Math.min(100, Math.max(0, confSum / confN)))
          : null;
      return { text, confidence };
    } finally {
      await worker.terminate();
    }
  } finally {
    await parser.destroy();
  }
}
