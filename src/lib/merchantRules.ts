/**
 * Category classification for expenses. Prefer `finalizeExpenseForWrite` from
 * `@/lib/entryDefaults` for creates — it wraps draft + classification in one call.
 *
 * Agent 2 (receipts): use `finalizeExpenseForWrite` when posting from OCR.
 * Agent 3 (Plaid/CSV): use `finalizeImportedExpense` from `@/lib/entryDefaults`.
 * Agent 1 (move month): call `propagateExpenseToTargetPeriod` from `@/lib/entryDefaults`.
 */
import { prisma } from "@/lib/prisma";
import {
  fieldsFromCategoryId,
  resolveBudgetPlanIdForCategory,
  type CategoryFieldPatch,
} from "@/lib/categories";
import { mergeTagLists, parseTagsJson } from "@/lib/budgetRollup";

export type CategorySuggestion = {
  categoryId: string;
  categoryName: string;
  budgetPlanId: string | null;
  tags: string[];
  taxCategory: string | null;
  reason: "merchant_rule" | "category_match" | "tag_match";
};

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
) {
  const { applyEntryDefaultsToExistingExpenses } = await import(
    "@/lib/entryDefaults"
  );
  return applyEntryDefaultsToExistingExpenses(monthlyPeriodId, yearMonth);
}

function descriptionMatchesPattern(description: string, pattern: string): boolean {
  return description.toLowerCase().includes(pattern.toLowerCase());
}

function descriptionMatchesCategory(
  description: string,
  cat: { slug: string; name: string; matchText: string | null },
): boolean {
  const desc = description.toLowerCase();
  const slug = cat.slug.toLowerCase();
  const name = cat.name.toLowerCase();
  if (desc.includes(slug) || desc.includes(name)) return true;
  if (!cat.matchText?.trim()) return false;
  const parts = cat.matchText.split("|").map((p) => p.trim().toLowerCase()).filter(Boolean);
  return parts.some((p) => desc.includes(p));
}

/**
 * Suggest a canonical category from merchant rules, category match text, and tags.
 * Pass monthlyPeriodId to resolve budgetPlanId for the expense month.
 */
export async function suggestCategoryForDescription(
  description: string,
  tags?: string[],
  monthlyPeriodId?: string,
): Promise<CategorySuggestion | null> {
  const desc = description.trim();
  if (!desc) return null;
  const tagList = (tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);

  const [rules, categories] = await Promise.all([
    prisma.merchantRule.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { category: true },
    }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  for (const r of rules) {
    if (!r.categoryId || !r.category) continue;
    if (!descriptionMatchesPattern(desc, r.pattern)) continue;
    let budgetPlanId: string | null = null;
    if (monthlyPeriodId) {
      budgetPlanId = await resolveBudgetPlanIdForCategory(r.categoryId, monthlyPeriodId);
    }
    const mergedTags = [
      ...new Set([...tagList, r.tag.trim().toLowerCase(), r.category.slug]),
    ];
    return {
      categoryId: r.categoryId,
      categoryName: r.category.name,
      budgetPlanId,
      tags: mergedTags,
      taxCategory: r.category.defaultTaxCategory,
      reason: "merchant_rule",
    };
  }

  for (const cat of categories) {
    if (!descriptionMatchesCategory(desc, cat)) continue;
    let budgetPlanId: string | null = null;
    if (monthlyPeriodId) {
      budgetPlanId = await resolveBudgetPlanIdForCategory(cat.id, monthlyPeriodId);
    }
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      budgetPlanId,
      tags: [...new Set([...tagList, cat.slug])],
      taxCategory: cat.defaultTaxCategory,
      reason: "category_match",
    };
  }

  for (const cat of categories) {
    const slug = cat.slug.toLowerCase();
    const name = cat.name.toLowerCase();
    if (!tagList.some((t) => t === slug || t === name || slug.includes(t) || t.includes(slug))) {
      continue;
    }
    let budgetPlanId: string | null = null;
    if (monthlyPeriodId) {
      budgetPlanId = await resolveBudgetPlanIdForCategory(cat.id, monthlyPeriodId);
    }
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      budgetPlanId,
      tags: [...new Set([...tagList, cat.slug])],
      taxCategory: cat.defaultTaxCategory,
      reason: "tag_match",
    };
  }

  return null;
}

export type ExpenseClassification = CategoryFieldPatch & {
  tagsJson: string | null;
};

/**
 * Merge merchant tags + optional explicit category into expense write fields.
 */
export async function classifyExpenseForWrite(
  description: string,
  monthlyPeriodId: string,
  opts?: {
    categoryId?: string | null;
    tagsJson?: string | null;
    budgetPlanId?: string | null;
    taxCategory?: string | null;
    /** When false, do not infer category from rules (e.g. user cleared category on edit). */
    autoSuggest?: boolean;
  },
): Promise<ExpenseClassification> {
  const manualTags = parseTagsJson(opts?.tagsJson ?? null);
  let tagsJson = await applyMerchantRulesToTags(description, mergeTagLists(manualTags));

  let categoryId = opts?.categoryId ?? null;
  if (!categoryId && opts?.autoSuggest !== false) {
    const suggestion = await suggestCategoryForDescription(
      description,
      parseTagsJson(tagsJson),
      monthlyPeriodId,
    );
    if (suggestion) {
      categoryId = suggestion.categoryId;
      tagsJson = mergeTagLists(parseTagsJson(tagsJson), suggestion.tags);
    }
  }

  const fromCat = await fieldsFromCategoryId(categoryId, monthlyPeriodId, {
    budgetPlanId: opts?.budgetPlanId,
    taxCategory: opts?.taxCategory,
  });

  let budgetPlanId = fromCat.budgetPlanId;
  if (!budgetPlanId && categoryId) {
    budgetPlanId = await resolveBudgetPlanIdForCategory(categoryId, monthlyPeriodId);
  }
  if (opts?.budgetPlanId) {
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: opts.budgetPlanId, monthlyPeriodId },
    });
    budgetPlanId = plan ? opts.budgetPlanId : budgetPlanId;
  }

  return {
    categoryId: fromCat.categoryId,
    budgetPlanId,
    taxCategory: fromCat.taxCategory,
    tagsJson,
  };
}
