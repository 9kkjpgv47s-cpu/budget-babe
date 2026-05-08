/**
 * General federal-income-tax *orientation* text for household recordkeeping.
 * Not legal advice; consult a qualified tax professional for your situation.
 */
export const TAX_APPLICABILITY_OPTIONS = [
  { id: "not_applicable", label: "Not applicable" },
  { id: "applicable", label: "Applicable" },
  { id: "applicable_with_documentation", label: "Applicable with proper documentation" },
] as const;

export type TaxApplicabilityId = (typeof TAX_APPLICABILITY_OPTIONS)[number]["id"];

export type TaxGuidanceEntry = {
  id: string;
  applicability: TaxApplicabilityId;
  title: string;
  citation: string;
  summary: string;
  detail: string;
};

const ENTRIES: TaxGuidanceEntry[] = [
  {
    id: "na_personal_consumption",
    applicability: "not_applicable",
    title: "Personal / family living expenses",
    citation: "IRC §262; Treas. Reg. §1.262-1 (overview)",
    summary:
      "Most routine personal, family, and living costs are nondeductible personal expenses, not business or investment deductions.",
    detail:
      "Internal Revenue Code §262 disallows deductions for personal, living, and family expenses except as otherwise expressly provided by statute (for example, specific itemized or credit provisions). Groceries, rent for a personal residence without a home-office allocation, purely personal travel, and similar costs generally fall here. This label is for your files so you and your preparer agree the line is not being claimed as a federal deduction.",
  },
  {
    id: "na_no_statutory_basis",
    applicability: "not_applicable",
    title: "No federal deduction category claimed",
    citation: "IRC §63, §67 (context for itemized deductions)",
    summary:
      "You are not treating this cash outflow as falling within a specific federal deduction or credit category.",
    detail:
      "Federal deductions are statutory. If an expense does not fit a provision you intend to rely on (and you are not carrying it as a basis adjustment, credit, or business deduction), marking it “not applicable” documents that decision. Keep supporting bank detail in the app as usual; this field is an explicit tax-workpaper flag.",
  },
  {
    id: "app_trade_business",
    applicability: "applicable",
    title: "Trade or business expense",
    citation: "IRC §162",
    summary:
      "Ordinary and necessary expenses paid or incurred in carrying on a trade or business may be deductible under §162 if substantiated and not disallowed by another rule.",
    detail:
      "Section 162 allows a deduction for ordinary and necessary expenses paid or incurred during the taxable year in carrying on any trade or business. “Ordinary” and “necessary” are factual questions; certain categories (meals, entertainment, listed property) have additional substantiation and percentage limits. Coordinate with your preparer on Schedule C, partnership K-1, or corporate return treatment.",
  },
  {
    id: "app_charitable",
    applicability: "applicable",
    title: "Charitable contribution",
    citation: "IRC §170",
    summary:
      "Contributions to qualified organizations may be deductible if substantiation and timing rules are met.",
    detail:
      "Section 170 governs charitable contribution deductions, including percentage limitations based on adjusted gross income and the type of property contributed. Cash gifts generally require a bank record or written communication from the donee; larger gifts require appraisals and Form 8283. Verify the organization is described in §170(c) before claiming a deduction.",
  },
  {
    id: "app_medical",
    applicability: "applicable",
    title: "Medical / dental care",
    citation: "IRC §213",
    summary:
      "Medical care expenses may count toward the medical expense itemized deduction subject to the AGI floor and other limits.",
    detail:
      "Section 213 allows a deduction for expenses paid for medical care of the taxpayer, spouse, or dependents to the extent the total exceeds the applicable adjusted gross income percentage threshold when itemizing. Not all health-related spending qualifies as “medical care” under §213(d). HSA/FSA rules differ—confirm with your preparer.",
  },
  {
    id: "app_education_credit",
    applicability: "applicable",
    title: "Education credit or tuition benefit",
    citation: "IRC §25A (American opportunity & lifetime learning credits)",
    summary:
      "Qualified tuition and related expenses may support an education credit if eligibility tests are met.",
    detail:
      "Section 25A provides the American opportunity and lifetime learning credits for qualified tuition and related expenses at an eligible educational institution. There are enrollment status, felony drug conviction, MAGI phase-out, and coordination rules with 529/Coverdell distributions. Credits are claimed on Form 8863.",
  },
  {
    id: "doc_substantiation_general",
    applicability: "applicable_with_documentation",
    title: "Substantiation required (general)",
    citation: "IRC §6001; Treas. Reg. §1.6001-1",
    summary:
      "Taxpayers must keep records sufficient to establish items of income, deduction, and credit. Certain categories have extra strict substantiation rules.",
    detail:
      "Section 6001 requires taxpayers to keep such permanent books of account or records as are sufficient to establish gross income, deductions, credits, and other matters material to the return. For expenses where you do not have an official receipt image in this app, use the audit note to describe other evidence (bank memo, calendar, mileage log, email confirmation). Your preparer decides if the documentation meets IRS standards.",
  },
  {
    id: "doc_section_274",
    applicability: "applicable_with_documentation",
    title: "Listed / sensitive expenses (meals, gifts, travel)",
    citation: "IRC §274 (substantiation and disallowance rules)",
    summary:
      "Meals, entertainment-type costs, gifts, and travel often need specific contemporaneous records: amount, time, place, business purpose, business relationship.",
    detail:
      "Section 274 and related regulations impose heightened substantiation and percentage limits for meals, entertainment (historically), business gifts, and travel. The classic “elements” substantiation (amount, time, place, purpose, relationship) applies to many of these items. If you lack a vendor receipt in the Receipts module, document each element you can in the audit note and attach proof elsewhere.",
  },
  {
    id: "doc_charitable_written",
    applicability: "applicable_with_documentation",
    title: "Charitable contribution — written acknowledgment",
    citation: "IRC §170(f); Reg. §1.170A-13",
    summary:
      "Cash and non-cash charitable gifts often need a contemporaneous written acknowledgment from the donee meeting statutory content rules.",
    detail:
      "For cash contributions of $250 or more, and for many non-cash gifts, you generally need a contemporaneous written acknowledgment from the qualified organization with specific information (amount, description of property, good-faith estimate of value for non-cash, etc.). If you only have informal proof, mark this row and describe what you have in the audit note until an acknowledgment is obtained.",
  },
];

export const TAX_GUIDANCE_BY_ID: Record<string, TaxGuidanceEntry> = Object.fromEntries(
  ENTRIES.map((e) => [e.id, e]),
);

export function guidanceForApplicability(a: TaxApplicabilityId): TaxGuidanceEntry[] {
  return ENTRIES.filter((e) => e.applicability === a);
}

export function defaultGuidanceId(a: TaxApplicabilityId): string {
  const list = guidanceForApplicability(a);
  return list[0]?.id ?? "na_personal_consumption";
}

export function isValidTaxApplicability(v: string | null | undefined): v is TaxApplicabilityId {
  return v === "not_applicable" || v === "applicable" || v === "applicable_with_documentation";
}

export function isInTaxWorkpaperFolder(a: string | null | undefined): boolean {
  return a === "applicable" || a === "applicable_with_documentation";
}

export function resolveGuidance(id: string | null | undefined): TaxGuidanceEntry | null {
  if (!id) return null;
  return TAX_GUIDANCE_BY_ID[id] ?? null;
}

export function isValidGuidanceRefForApplicability(
  refId: string,
  applicability: TaxApplicabilityId,
): boolean {
  const g = resolveGuidance(refId);
  return g !== null && g.applicability === applicability;
}

export const TAX_LEGAL_DISCLAIMER =
  "This app shows general statutory references for household recordkeeping only. It is not tax advice, not a substitute for a CPA or enrolled agent, and does not cover state or local rules.";
