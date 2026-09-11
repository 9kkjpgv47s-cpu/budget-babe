export default function AppLoading() {
  return (
    <div className="space-y-6 md:space-y-8" aria-busy="true" aria-label="Loading">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-7 w-44" />
          <div className="skeleton h-4 w-72 max-w-[60vw]" />
        </div>
        <div className="skeleton h-10 w-44" />
      </div>
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 p-5 md:p-7">
          <div className="skeleton h-3 w-24 !bg-white/25" />
          <div className="skeleton mt-2 h-10 w-52 !bg-white/30" />
          <div className="skeleton mt-6 h-3 w-full !bg-white/25" />
        </div>
        <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3.5">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton mt-1.5 h-6 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="card p-5">
        <div className="skeleton h-5 w-32" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
        </div>
      </div>
    </div>
  );
}
