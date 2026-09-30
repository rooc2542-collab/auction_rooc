export default function PageSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Navbar Skeleton */}
      <div className="h-14 border-b border-zinc-800/80 bg-zinc-950/90 px-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-zinc-800 animate-pulse" />
          <div className="w-24 h-4 rounded bg-zinc-800 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="w-20 h-8 rounded-md bg-zinc-900 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div className="space-y-2">
            <div className="w-48 h-6 rounded bg-zinc-800 animate-pulse" />
            <div className="w-72 h-4 rounded bg-zinc-900 animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="w-36 h-9 rounded-md bg-zinc-900 border border-zinc-800 animate-pulse" />
            <div className="w-28 h-9 rounded-md bg-zinc-800 animate-pulse" />
          </div>
        </div>

        {/* Stat Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-5 space-y-3">
              <div className="w-24 h-3.5 rounded bg-zinc-800 animate-pulse" />
              <div className="w-16 h-7 rounded bg-zinc-800 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Table / Grid Skeleton */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800/80 flex justify-between items-center">
            <div className="w-40 h-4 rounded bg-zinc-800 animate-pulse" />
            <div className="w-24 h-4 rounded bg-zinc-900 animate-pulse" />
          </div>
          <div className="divide-y divide-zinc-800/60 p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((r) => (
              <div key={r} className="pt-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 rounded-md bg-zinc-800 animate-pulse" />
                  <div className="space-y-1.5 flex-1 max-w-xs">
                    <div className="w-full h-3.5 rounded bg-zinc-800 animate-pulse" />
                    <div className="w-2/3 h-3 rounded bg-zinc-900 animate-pulse" />
                  </div>
                </div>
                <div className="w-20 h-6 rounded bg-zinc-800 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
