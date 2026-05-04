/** Shared shape for useActionState with server actions that return errors or success. */
export type FormActionState = {
  error?: string;
  ok?: boolean;
};

export const initialFormState: FormActionState = {};
