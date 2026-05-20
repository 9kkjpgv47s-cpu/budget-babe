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

/** Apply category defaults onto expense fields for a given month. */
export async function fieldsFromCategoryId(
  categoryId: string | null,
  monthlyPeriodId: string,
  existing?: { budgetPlanId?: string | null; taxCategory?: string | null },
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
  if (!budgetPlanId && cat.budgetEnvelopeName) {
    budgetPlanId = await resolveBudgetPlanIdForCategory(categoryId, monthlyPeriodId);
  }
  let taxCategory = existing?.taxCategory ?? null;
  if (!taxCategory && cat.defaultTaxCategory && isValidTaxCategory(cat.defaultTaxCategory)) {
    taxCategory = cat.defaultTaxCategory;
  }
  return { categoryId, budgetPlanId, taxCategory };
}
