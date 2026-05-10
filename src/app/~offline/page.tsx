import Link from "next/link";
import { OfflineRetryButton } from "./OfflineRetryButton";

export const dynamic = "force-static";

export const metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
      <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        Household Budget
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">You are offline</h1>
      <p className="mt-3 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        This page was cached on your device. Reconnect to the internet to load fresh balances, sync Plaid, or upload
        receipts. Installed shortcuts can still open this shell.
      </p>
      <OfflineRetryButton />
      <p className="mt-6 text-xs text-zinc-500">
        <Link href="/login" className="underline">
          Sign-in page
        </Link>{" "}
        (needs network the first time)
      </p>
    </div>
  );
}
