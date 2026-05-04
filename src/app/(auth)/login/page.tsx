import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Household budget — up to two accounts.
      </p>
      <LoginForm registered={Boolean(sp.registered)} />
      <p className="mt-6 text-center text-sm text-zinc-500">
        No account?{" "}
        <Link className="text-emerald-600 underline" href="/register">
          Register
        </Link>
      </p>
    </div>
  );
}
