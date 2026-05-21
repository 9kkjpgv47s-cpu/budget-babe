import { categoriesMissingEnvelopes } from "@/lib/categories";
import { createMissingCategoryEnvelopesAction } from "@/app/actions/categories";

export function CategoryEnvelopePanel({
  yearMonth,
  categories,
  planNames,
}: {
  yearMonth: string;
  categories: { id: string; name: string; budgetEnvelopeName: string | null }[];
  planNames: string[];
}) {
  const planNamesLower = new Set(planNames.map((n) => n.toLowerCase()));
  const missing = categoriesMissingEnvelopes(categories, planNamesLower);
  if (missing.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/50 dark:bg-amber-950/40">
      <h2 className="font-medium text-amber-950 dark:text-amber-100">
        Missing budget envelopes
      </h2>
      <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
        These categories expect an envelope name that is not in {yearMonth} yet.
        Create them so categorized spending rolls up correctly.
      </p>
      <ul className="mt-3 space-y-1 text-sm text-amber-950 dark:text-amber-100">
        {missing.map((m) => (
          <li key={m.id}>
            <span className="font-medium">{m.name}</span>
            <span className="text-amber-800 dark:text-amber-300">
              {" "}
              → “{m.budgetEnvelopeName}”
            </span>
          </li>
        ))}
      </ul>
      <form action={createMissingCategoryEnvelopesAction} className="mt-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="yearMonth" value={yearMonth} />
        <label className="text-xs">
          Default limit ($)
          <input
            name="defaultLimit"
            placeholder="0"
            inputMode="decimal"
            className="ml-1 w-20 rounded border border-amber-300 bg-white px-2 py-1 dark:border-amber-800 dark:bg-zinc-950"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-700"
        >
          Create {missing.length} envelope{missing.length === 1 ? "" : "s"}
        </button>
      </form>
    </section>
  );
}
