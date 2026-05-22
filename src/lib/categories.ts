import { prisma } from "@/lib/prisma";
import { isValidTaxCategory } from "@/lib/taxCategories";

export type CategoryDTO = {
  id: string;
  name: string;
  slug: string;
  matchText: string | null;
  budgetEnvelopeName: string | null;
  defaultTaxCategory: string | null;
};

export function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "category";
}

/** Default household categories seeded once when the table is empty. */
export const DEFAULT_CATEGORIES: Omit<CategoryDTO, "id">[] = [
  {
    name: "Groceries",
    slug: "groceries",
    matchText: "grocery|supermarket|whole foods|trader joe|costco|walmart grocery",
    budgetEnvelopeName: "Groceries",
    defaultTaxCategory: null,
  },
  {
    name: "Dining",
    slug: "dining",
    matchText: "restaurant|cafe|coffee|doordash|uber eats|grubhub|starbucks",
    budgetEnvelopeName: "Dining",
    defaultTaxCategory: null,
  },
  {
    name: "Transport",
    slug: "transport",
    matchText: "uber|lyft|gas|shell|chevron|parking|transit|metro",
    budgetEnvelopeName: "Transport",
    defaultTaxCategory: null,
  },
  {
    name: "Utilities",
    slug: "utilities",
    matchText: "electric|water|gas bill|internet|comcast|verizon|att ",
    budgetEnvelopeName: "Utilities",
    defaultTaxCategory: "salt",
  },
  {
    name: "Medical",
    slug: "medical",
    matchText: "pharmacy|cvs|walgreens|doctor|hospital|dental|medical",
    budgetEnvelopeName: null,
    defaultTaxCategory: "medical",
  },
  {
    name: "Business",
    slug: "business",
    matchText: "office|staples|adobe|aws|github|slack|zoom",
    budgetEnvelopeName: null,
    defaultTaxCategory: "business",
  },
];

export async function ensureDefaultCategories(): Promise<void> {
  const count = await prisma.category.count();
  if (count > 0) return;
  for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
    await prisma.category.create({
      data: {
        name: c.name,
        slug: c.slug,
        matchText: c.matchText,
        budgetEnvelopeName: c.budgetEnvelopeName,
        defaultTaxCategory: c.defaultTaxCategory,
        sortOrder: i,
      },
    });
  }
}

/** Resolve category id from CSV/import label (slug or name, case-insensitive). */
export async function resolveCategoryIdFromLabel(
  label: string | null | undefined,
): Promise<string | null> {
  const raw = label?.trim();
  if (!raw) return null;
  const slug = raw.toLowerCase();
  const cat = await prisma.category.findFirst({
    where: {
      OR: [
        { slug },
        { name: { equals: raw, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return cat?.id ?? null;
}

/** Validate optional category id from form data. */
export async function coerceCategoryId(
  raw: string | null | undefined,
): Promise<string | null> {
  const id = raw?.trim() || null;
  if (!id) return null;
  const cat = await prisma.category.findUnique({
    where: { id },
    select: { id: true },
  });
  return cat?.id ?? null;
}

/**
 * When an expense moves to another month, re-link budget (and tax) from its category
 * in the target period. Category id is global; envelope names map per month.
 */
export async function remapExpenseCategoryFieldsToPeriod(
  categoryId: string | null,
  targetMonthlyPeriodId: string,
  existing?: { budgetPlanId?: string | null; taxCategory?: string | null },
): Promise<CategoryFieldPatch> {
  if (!categoryId) {
    return {
      categoryId: null,
      budgetPlanId: existing?.budgetPlanId ?? null,
      taxCategory: existing?.taxCategory ?? null,
    };
  }
  return fieldsFromCategoryId(
    categoryId,
    targetMonthlyPeriodId,
    {
      budgetPlanId: existing?.budgetPlanId ?? null,
      taxCategory: existing?.taxCategory ?? null,
    },
    { forceBudgetLink: true },
  );
}

export async function resolveBudgetPlanIdForCategory(
  categoryId: string,
  monthlyPeriodId: string,
): Promise<string | null> {
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat?.budgetEnvelopeName?.trim()) return null;
  const name = cat.budgetEnvelopeName.trim();
  const plan = await prisma.budgetPlan.findFirst({
    where: { monthlyPeriodId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return plan?.id ?? null;
}

export type CategoryFieldPatch = {
  categoryId: string | null;
  budgetPlanId: string | null;
  taxCategory: string | null;
};

export type CategoryFieldOptions = {
  /** Set tax folder from category default even when expense already has one. */
  forceTaxDefault?: boolean;
  /** Resolve budget plan from envelope name even when expense already linked. */
  forceBudgetLink?: boolean;
};

/** Apply category defaults onto expense fields for a given month. */
export function categoriesMissingEnvelopes(
  categories: { id: string; name: string; budgetEnvelopeName: string | null }[],
  planNamesLower: Set<string>,
): { id: string; name: string; budgetEnvelopeName: string }[] {
  const out: { id: string; name: string; budgetEnvelopeName: string }[] = [];
  for (const c of categories) {
    const env = c.budgetEnvelopeName?.trim();
    if (!env) continue;
    if (!planNamesLower.has(env.toLowerCase())) {
      out.push({ id: c.id, name: c.name, budgetEnvelopeName: env });
    }
  }
  return out;
}

/**
 * When a budget envelope is created/renamed, link matching spending categories by name or slug.
 */
export async function linkCategoriesToBudgetEnvelope(
  envelopeName: string,
): Promise<number> {
  const name = envelopeName.trim();
  if (!name) return 0;
  const slug = slugifyCategoryName(name);
  const lower = name.toLowerCase();
  const categories = await prisma.category.findMany();
  let updated = 0;
  for (const cat of categories) {
    const matches =
      cat.name.toLowerCase() === lower ||
      cat.slug === slug ||
      cat.budgetEnvelopeName?.toLowerCase() === lower;
    if (!matches) continue;
    if (cat.budgetEnvelopeName === name) continue;
    await prisma.category.update({
      where: { id: cat.id },
      data: { budgetEnvelopeName: name },
    });
    updated += 1;
  }
  return updated;
}

export async function fieldsFromCategoryId(
  categoryId: string | null,
  monthlyPeriodId: string,
  existing?: { budgetPlanId?: string | null; taxCategory?: string | null },
  opts?: CategoryFieldOptions,
): Promise<CategoryFieldPatch> {
  if (!categoryId) {
    return {
      categoryId: null,
      budgetPlanId: existing?.budgetPlanId ?? null,
      taxCategory: existing?.taxCategory ?? null,
    };
  }
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) {
    return {
      categoryId: null,
      budgetPlanId: existing?.budgetPlanId ?? null,
      taxCategory: existing?.taxCategory ?? null,
    };
  }
  let budgetPlanId = existing?.budgetPlanId ?? null;
  if (
    cat.budgetEnvelopeName &&
    (opts?.forceBudgetLink || !budgetPlanId)
  ) {
    budgetPlanId = await resolveBudgetPlanIdForCategory(categoryId, monthlyPeriodId);
  }
  let taxCategory = existing?.taxCategory ?? null;
  if (
    cat.defaultTaxCategory &&
    isValidTaxCategory(cat.defaultTaxCategory) &&
    (opts?.forceTaxDefault || !taxCategory)
  ) {
    taxCategory = cat.defaultTaxCategory;
  }
  return { categoryId, budgetPlanId, taxCategory };
}

/** Apply category defaults (budget + tax) to an expense row. */
export async function applyCategoryDefaultsToExpense(
  expenseId: string,
  monthlyPeriodId: string,
  categoryId: string | null,
  opts?: CategoryFieldOptions,
): Promise<void> {
  const exp = await prisma.expense.findFirst({
    where: { id: expenseId, monthlyPeriodId },
    select: {
      id: true,
      budgetPlanId: true,
      taxCategory: true,
      tagsJson: true,
      description: true,
    },
  });
  if (!exp) return;
  const patch = await fieldsFromCategoryId(categoryId, monthlyPeriodId, {
    budgetPlanId: exp.budgetPlanId,
    taxCategory: exp.taxCategory,
  }, opts);
  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      categoryId: patch.categoryId,
      budgetPlanId: patch.budgetPlanId,
      taxCategory: patch.taxCategory,
    },
  });
}
