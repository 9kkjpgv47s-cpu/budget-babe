import { TAX_CATEGORY_OPTIONS } from "@/lib/taxCategories";
import { addCategoryAction, deleteCategoryAction } from "@/app/actions/categories";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  matchText: string | null;
  budgetEnvelopeName: string | null;
  defaultTaxCategory: string | null;
};

export function CategorySection({ categories }: { categories: CategoryRow[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-medium">Spending categories</h2>
      <p className="mt-1 text-xs text-zinc-500">
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
          placeholder="Budget envelope name to link"
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
      <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"
          >
            <div>
              <span className="font-medium">{c.name}</span>
              <span className="ml-2 font-mono text-xs text-zinc-500">{c.slug}</span>
              {c.budgetEnvelopeName ? (
                <p className="text-xs text-zinc-500">
                  Envelope: {c.budgetEnvelopeName}
                </p>
              ) : null}
              {c.matchText ? (
                <p className="text-xs text-zinc-400">Match: {c.matchText}</p>
              ) : null}
            </div>
            <form action={deleteCategoryAction}>
              <input type="hidden" name="id" value={c.id} />
              <button
                type="submit"
                className="text-xs text-red-600 underline hover:no-underline"
              >
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>
      {categories.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No categories yet.</p>
      ) : null}
    </section>
  );
}
