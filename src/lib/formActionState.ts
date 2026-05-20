/** Shared shape for useActionState with server actions that return errors or success. */
export type FormActionState = {
  error?: string;
  ok?: boolean;
  /** Non-error feedback (e.g. import counts) */
  message?: string;
  /** Set after receipt upload for redirect / scroll targeting */
  receiptId?: string;
};

export const initialFormState: FormActionState = {};
