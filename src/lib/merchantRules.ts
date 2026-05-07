import { prisma } from "@/lib/prisma";
import { mergeTagLists, parseTagsJson } from "@/lib/budgetRollup";

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
