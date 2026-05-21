import type { ExpenseEntryDefaults } from "@/lib/entryDefaults";

/** Shared shape for useActionState with server actions that return errors or success. */
export type FormActionState = {
  error?: string;
  ok?: boolean;
  /** Non-error feedback (e.g. import counts) */
  message?: string;
  /** After expense create, updated defaults for the next entry in-session. */
  entryDefaults?: ExpenseEntryDefaults;
};

export const initialFormState: FormActionState = {};
