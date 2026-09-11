import { TAX_CATEGORY_OPTIONS } from "@/lib/taxCategories";
import {
  addCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/actions/categories";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  matchText: string | null;
  budgetEnvelopeName: string | null;
  defaultTaxCategory: string | null;
  expenseCount: number;
};

export function CategorySection({ categories }: { categories: CategoryRow[] }) {
  return (
    <section className="card p-5">
      <h2 className="font-medium">Spending categories</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Canonical categories link expenses to budget envelope names and default tax
        folders. Merchant rules can assign a category when a pattern matches.
      </p>
      <form action={addCategoryAction} className="mt-4 grid gap-2 sm:grid-cols-2">
        <input
          name="name"
          placeholder="Category name (e.g. Subscriptions)"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
        />
        <input
          name="slug"
          placeholder="slug (optional, auto from name)"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="budgetEnvelopeName"
          placeholder="Budget envelope name (defaults to category name)"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          name="matchText"
          placeholder="Match text (pipe-separated: netflix|spotify)"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
        />
        <select
          name="defaultTaxCategory"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
          defaultValue=""
        >
          <option value="">No default tax folder</option>
          {TAX_CATEGORY_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 sm:col-span-2"
        >
          Add category
        </button>
      </form>
      <ul className="mt-4 divide-y divide-border">
        {categories.map((c) => (
          <li key={c.id} className="py-4">
            <form action={updateCategoryAction} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="id" value={c.id} />
              <input
                name="name"
                defaultValue={c.name}
                required
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
              />
              <span className="self-center font-mono text-xs text-muted-foreground sm:col-span-2">
                slug: {c.slug}
              </span>
              <input
                name="budgetEnvelopeName"
                defaultValue={c.budgetEnvelopeName ?? ""}
                placeholder="Budget envelope name"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              <select
                name="defaultTaxCategory"
                defaultValue={c.defaultTaxCategory ?? ""}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">No default tax folder</option>
                {TAX_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                name="matchText"
                defaultValue={c.matchText ?? ""}
                placeholder="Match text (pipe-separated)"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
              />
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-600"
                >
                  Save
                </button>
              </div>
            </form>
            {c.expenseCount > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {c.expenseCount} expense{c.expenseCount === 1 ? "" : "s"} use this category —
                reassign before delete.
              </p>
            ) : (
              <form action={deleteCategoryAction} className="mt-2">
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="text-xs text-red-600 underline hover:no-underline"
                >
                  Delete category
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {categories.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No categories yet.</p>
      ) : null}
    </section>
  );
}
