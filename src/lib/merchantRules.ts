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

/**
 * Re-run all merchant rules against existing expenses for a month.
 * Only updates rows whose tag JSON would change.
 */
export async function applyMerchantRulesToExistingExpenses(
  monthlyPeriodId: string,
): Promise<{ updated: number; scanned: number }> {
  const expenses = await prisma.expense.findMany({
    where: { monthlyPeriodId },
    select: { id: true, description: true, tagsJson: true },
  });

  let updated = 0;
  for (const exp of expenses) {
    const nextTags = await applyMerchantRulesToTags(exp.description, exp.tagsJson);
    const prev = exp.tagsJson ?? null;
    if (nextTags === prev) continue;
    await prisma.expense.update({
      where: { id: exp.id },
      data: { tagsJson: nextTags },
    });
    updated += 1;
  }

  return { updated, scanned: expenses.length };
}
