"use client";

import { deleteMerchantRuleAction, updateMerchantRuleAction } from "@/app/actions/rules";

export type MerchantRuleRow = {
  id: string;
  pattern: string;
  tag: string;
  categoryId: string | null;
  categoryName: string | null;
};

export function MerchantRulesList({
  rules,
  categories,
}: {
  rules: MerchantRuleRow[];
  categories: { id: string; name: string }[];
}) {
  if (rules.length === 0) {
    return <p className="mt-2 text-sm text-zinc-500">No rules yet.</p>;
  }

  return (
    <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
      {rules.map((r) => (
        <li key={r.id} className="py-4">
          <form action={updateMerchantRuleAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={r.id} />
            <input
              name="pattern"
              defaultValue={r.pattern}
              className="min-w-[6rem] flex-1 rounded-lg border border-zinc-300 px-2 py-1 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <span className="text-zinc-400">→</span>
            <input
              name="tag"
              defaultValue={r.tag}
              className="min-w-[6rem] flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <select
              name="categoryId"
              defaultValue={r.categoryId ?? ""}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
            >
              Save
            </button>
          </form>
          <form action={deleteMerchantRuleAction} className="mt-2">
            <input type="hidden" name="id" value={r.id} />
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
  );
}
