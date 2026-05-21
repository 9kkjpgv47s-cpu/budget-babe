import { prisma } from "@/lib/prisma";
import { mergeTagLists, parseTagsJson } from "@/lib/budgetRollup";

/**
 * Tag-only merchant rules. For budget + payee propagation use
 * `applyMerchantRulesToDraft` from `@/lib/entryDefaults`.
 */

/**
 * Apply global merchant rules: if description contains pattern, add tag (lowercase stored).
 */
export async function applyMerchantRulesToTags(
  description: string,
  existingTagsJson: string | null,
): Promise<string | null> {
  const rules = await prisma.merchantRule.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const desc = description.toLowerCase();
  const fromRules: string[] = [];
  for (const r of rules) {
    if (desc.includes(r.pattern.toLowerCase())) {
      fromRules.push(r.tag.trim().toLowerCase());
    }
  }
  const existing = parseTagsJson(existingTagsJson);
  return mergeTagLists(existing, fromRules);
}

/**
 * Re-run entry defaults (tags, budget suggestion, payee) on existing expenses for a month.
 */
export async function applyMerchantRulesToExistingExpenses(
  monthlyPeriodId: string,
  yearMonth: string,
): Promise<{ updated: number; scanned: number }> {
  const { applyEntryDefaultsToExistingExpenses } = await import(
    "@/lib/entryDefaults"
  );
  const result = await applyEntryDefaultsToExistingExpenses(
    monthlyPeriodId,
    yearMonth,
  );
  return { updated: result.updated, scanned: result.scanned };
}
