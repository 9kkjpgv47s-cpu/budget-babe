import {
  defaultExpenseDescriptionFromReceipt,
  inferSpentAtFromOcrText,
  parseMerchantFromOcrText,
  type ParsedReceiptLine,
} from "@/lib/receiptOcr";

export function buildReceiptExpenseMeta(
  receipt: {
    ocrRawText: string | null;
    filename: string;
  },
  parsed: ParsedReceiptLine[],
  descriptionOverride?: string,
): {
  description: string;
  payee: string | null;
  spentAt: Date;
} {
  const label = receipt.filename.split("/").pop() || receipt.filename;
  const description =
    descriptionOverride?.trim() ||
    defaultExpenseDescriptionFromReceipt(
      receipt.ocrRawText ?? "",
      parsed,
      label,
    );
  const merchant = parseMerchantFromOcrText(receipt.ocrRawText ?? "");
  const payee =
    merchant && merchant.length <= 200
      ? merchant
      : merchant
        ? merchant.slice(0, 200)
        : null;
  const spentAt = inferSpentAtFromOcrText(receipt.ocrRawText ?? "", new Date());
  return { description, payee, spentAt };
}
