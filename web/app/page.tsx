import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { ITEM_CONFIG, ROUND_STATUS_LABELS } from "@/lib/constants"
import type { ItemType } from "@/lib/constants"

interface AuctionRound {
  id: string
  round_date: string
  item_type: ItemType
  total_quantity: number
  personal_limit: number
  status: "voting" | "bidding" | "closed"
  created_at: string
}

interface VoteCounts {
  want_bid: number
  no_bid: number
  absent: number
}

interface QueueEntry {
  id: string
  user_id: string
  status: string
  queued_at: string
  awarded_at: string | null
  profiles: { display_name: string; discord_id: string } | null
  credit: number
}

export default async function HomePage() {
  const session = await auth()
  if (!session) redirect("/login")

  const supabase = createAdminClient()

  // ดึง round ที่ active อยู่
  const { data: activeRound } = await supabase
    .from("auction_rounds")
    .select("*")
    .in("status", ["voting", "bidding"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: AuctionRound | null }

  let voteCounts: VoteCounts = { want_bid: 0, no_bid: 0, absent: 0 }
  let queues: QueueEntry[] = []

  if (activeRound) {
    // ดึงผลโหวต
    const { data: votes } = await supabase
      .from("round_votes")
      .select("vote")
      .eq("round_id", activeRound.id)

    if (votes) {
      for (const v of votes) {
        voteCounts[v.vote as keyof VoteCounts] = (voteCounts[v.vote as keyof VoteCounts] || 0) + 1
      }
    }

    // ดึงคิว
    const { data: rawQueues } = await supabase
      .from("auction_queues")
      .select("*, profiles:user_id(display_name, discord_id)")
      .eq("round_id", activeRound.id)
      .order("queued_at", { ascending: true })

    if (rawQueues) {
      // เพิ่ม credit ให้แต่ละคน
      const withCredits = await Promise.all(
        (rawQueues as any[]).map(async (q) => {
          const { data: creditRow } = await supabase
            .from("carry_credits")
            .select("credit")
            .eq("user_id", q.user_id)
            .eq("item_type", activeRound.item_type)
            .maybeSingle()
          return { ...q, credit: creditRow?.credit ?? 0 }
        })
      )
      // เรียง: credit DESC แล้ว queued_at ASC
      queues = withCredits.sort((a, b) => b.credit - a.credit || new Date(a.queued_at).getTime() - new Date(b.queued_at).getTime())
    }
  }

  const itemCfg = activeRound ? ITEM_CONFIG[activeRound.item_type] : null
  const statusLabel = activeRound ? ROUND_STATUS_LABELS[activeRound.status] : null

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">🎲 ระบบประมูล RoOC</h1>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>{session.user.name}</span>
            {session.user.role === "admin" && (
              <a href="/admin" className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">
                ⚙️ Admin Panel
              </a>
            )}
            <a href="/history" className="text-gray-400 hover:text-white transition-colors">ประวัติ</a>
            <a href="/credits" className="text-gray-400 hover:text-white transition-colors">Credits</a>
          </div>
        </div>

        {/* Round Card */}
        {activeRound && itemCfg ? (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Round header */}
            <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{itemCfg.label}</h2>
                <p className="text-sm text-gray-400">{itemCfg.desc}</p>
              </div>
              <div className="text-right">
                <span className="inline-block bg-blue-900/50 text-blue-300 text-xs font-medium px-3 py-1 rounded-full">
                  {statusLabel}
                </span>
                <p className="text-xs text-gray-500 mt-1">{activeRound.round_date}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 p-6 border-b border-gray-800">
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">จำนวนทั้งหมด</p>
                <p className="text-2xl font-bold text-white">{activeRound.total_quantity}</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Limit ต่อคน</p>
                <p className="text-2xl font-bold text-white">{activeRound.personal_limit}</p>
              </div>
            </div>

            {/* Vote counts */}
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-sm font-medium text-gray-400 mb-3">ผลโหวต</h3>
              <div className="flex gap-3">
                <div className="flex-1 bg-green-900/20 border border-green-800 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-400">{voteCounts.want_bid}</p>
                  <p className="text-xs text-green-600 mt-1">ต้องการประมูล</p>
                </div>
                <div className="flex-1 bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-yellow-400">{voteCounts.no_bid}</p>
                  <p className="text-xs text-yellow-600 mt-1">สะสม credit</p>
                </div>
                <div className="flex-1 bg-red-900/20 border border-red-800 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-red-400">{voteCounts.absent}</p>
                  <p className="text-xs text-red-600 mt-1">ไม่เข้าร่วม</p>
                </div>
              </div>
            </div>

            {/* Queue list */}
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                คิวประมูล ({queues.length} คน)
              </h3>
              {queues.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">ยังไม่มีการจองคิว</p>
              ) : (
                <div className="space-y-2">
                  {queues.map((q, idx) => (
                    <div key={q.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-sm font-mono w-6">#{idx + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-white">{q.profiles?.display_name ?? "—"}</p>
                          <p className="text-xs text-gray-500">{q.profiles?.discord_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {q.credit > 0 && (
                          <span className="bg-amber-900/40 text-amber-400 text-xs px-2 py-0.5 rounded-full">
                            💎 +{q.credit} credit
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          q.status === "awarded"
                            ? "bg-green-900/40 text-green-400"
                            : "bg-blue-900/40 text-blue-400"
                        }`}>
                          {q.status === "awarded" ? "✅ ได้แล้ว" : "⏳ รออยู่"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
            <p className="text-gray-500 text-lg">ยังไม่มี round ที่กำลัง active</p>
            <p className="text-gray-600 text-sm mt-2">Admin สามารถเปิด round ใหม่ผ่าน Discord Bot หรือ Admin Panel</p>
          </div>
        )}
      </div>
    </main>
  )
}
