/** Stable ids stored on Expense.taxCategory (informational — not tax advice). */
export const TAX_CATEGORY_OPTIONS = [
  { id: "medical", label: "Medical & dental" },
  { id: "charitable", label: "Charitable giving" },
  { id: "business", label: "Business / self-employment" },
  { id: "education", label: "Education" },
  { id: "childcare", label: "Child / dependent care" },
  { id: "salt", label: "SALT / property / state (documentation)" },
  { id: "mortgage_interest", label: "Mortgage interest" },
  { id: "energy_property", label: "Energy / home improvement (credits)" },
  { id: "vehicle_business", label: "Vehicle (business use)" },
  { id: "other_qualifying", label: "Other — preparer to classify" },
  { id: "record_only", label: "Record only (no deduction claimed)" },
] as const;

export type TaxCategoryId = (typeof TAX_CATEGORY_OPTIONS)[number]["id"];

const ALLOWED = new Set<string>(TAX_CATEGORY_OPTIONS.map((o) => o.id));

export function isValidTaxCategory(id: string | null | undefined): id is TaxCategoryId {
  return id != null && ALLOWED.has(id);
}

export function taxCategoryLabel(id: string | null | undefined): string {
  if (!id) return "—";
  const row = TAX_CATEGORY_OPTIONS.find((o) => o.id === id);
  return row?.label ?? id;
}
