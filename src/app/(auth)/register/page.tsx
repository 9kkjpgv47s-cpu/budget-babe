import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        This app is for two people in one household. The second person can
        register the same way (until two accounts exist).
      </p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link className="text-emerald-600 underline" href="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
