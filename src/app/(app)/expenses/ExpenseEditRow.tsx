"use client";

import { useActionState, useState } from "react";
import {
  deleteExpenseAction,
  updateExpenseAction,
} from "@/app/actions/expenses";
import { ExpenseTaxApplicabilityForm } from "../tax/ExpenseTaxApplicabilityForm";
import { formatCents } from "@/lib/money";
import { CategorySuggestionHint } from "./CategorySuggestionHint";
import type { ExpenseRowDTO } from "./ExpensesInteractiveList";

function parseTagsDisplay(raw: string | null): string {
  if (!raw) return "";
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return "";
    return v.filter((x): x is string => typeof x === "string").join(", ");
  } catch {
    return "";
  }
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExpenseEditRow({
  expense: e,
  yearMonth,
  plans,
  categories,
  selected,
  onToggle,
}: {
  expense: ExpenseRowDTO;
  yearMonth: string;
  plans: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState(e.description);
  const [savedAt, setSavedAt] = useState(0);
  const [, submitUpdate, updatePending] = useActionState(
    async (_prev: { ok?: boolean } | null, formData: FormData) => {
      await updateExpenseAction(formData);
      setSavedAt(Date.now());
      return { ok: true };
    },
    null,
  );
  const formKey = `${e.id}-${savedAt}`;

  const spentAt = new Date(e.spentAt);
  const dateLabel = spentAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const tags = parseTagsDisplay(e.tagsJson);

  return (
    <li
      className={`card overflow-hidden transition-shadow ${expanded ? "ring-1 ring-accent/30" : ""}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${e.description}`}
          className="h-4 w-4 shrink-0 rounded border-border-strong accent-emerald-600"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {e.description}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{dateLabel}</span>
              {e.payee ? <span>· {e.payee}</span> : null}
              {e.userName ? <span>· {e.userName}</span> : null}
              {e.splitGroupId ? <span>· split</span> : null}
              {e.categoryName ? (
                <span className="rounded-full bg-accent-soft px-1.5 py-px font-medium text-accent">
                  {e.categoryName}
                </span>
              ) : (
                <span className="text-muted-foreground/70">Uncategorized</span>
              )}
              {tags ? <span className="text-muted-foreground/70">#{tags.replace(/, /g, " #")}</span> : null}
            </span>
          </span>
          <span className="stat-value shrink-0 text-sm text-foreground">
            {formatCents(e.amountCents)}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-border bg-muted/30 px-4 py-4">
          <form
            key={formKey}
            action={submitUpdate}
            className="grid gap-2.5 sm:grid-cols-2"
          >
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="yearMonth" value={yearMonth} />
            <div className="space-y-1 sm:col-span-2">
              <input
                name="description"
                value={description}
                onChange={(ev) => setDescription(ev.target.value)}
                className="w-full"
                aria-label="Description"
              />
              <CategorySuggestionHint yearMonth={yearMonth} description={description} />
            </div>
            <input
              name="amount"
              defaultValue={(e.amountCents / 100).toFixed(2)}
              inputMode="decimal"
              aria-label="Amount"
            />
            <input
              name="spentAt"
              type="datetime-local"
              defaultValue={toLocalInput(e.spentAt)}
              aria-label="Date"
            />
            <input
              name="payee"
              defaultValue={e.payee ?? ""}
              placeholder="Payee / store"
              aria-label="Payee"
            />
            <select
              name="categoryId"
              defaultValue={e.categoryId ?? ""}
              aria-label="Category"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              name="budgetPlanId"
              defaultValue={e.budgetPlanId ?? ""}
              aria-label="Budget envelope"
            >
              <option value="">No budget link</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              name="tags"
              defaultValue={tags}
              placeholder="tags, comma"
              aria-label="Tags"
            />
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={updatePending}
                className="btn btn-primary"
              >
                {updatePending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
          <form action={deleteExpenseAction} className="mt-3">
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="yearMonth" value={yearMonth} />
            <button
              type="submit"
              className="text-xs font-medium text-negative hover:underline"
            >
              Delete expense
            </button>
          </form>
          <div className="mt-4 border-t border-border pt-3">
            <ExpenseTaxApplicabilityForm
              expenseId={e.id}
              taxYear={spentAt.getFullYear()}
              yearMonth={yearMonth}
              initialApplicability={e.taxApplicability}
              initialCodeRef={e.taxCodeRefId}
              initialCategory={e.taxCategory}
              initialNote={e.taxNote}
              receiptId={e.receiptId}
              taxReviewedAt={e.taxReviewedAt}
              compact
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}
