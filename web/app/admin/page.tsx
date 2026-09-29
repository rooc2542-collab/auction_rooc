import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { ITEM_CONFIG } from "@/lib/constants"
import type { ItemType } from "@/lib/constants"
import AdminAwardForm from "./AdminAwardForm"

interface QueueEntry {
  id: string
  round_id: string
  user_id: string
  item_type: ItemType
  status: string
  queued_at: string
  profiles: { display_name: string; discord_id: string } | null
}

interface AuctionRound {
  id: string
  round_date: string
  item_type: ItemType
  total_quantity: number
  personal_limit: number
  status: string
}

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "admin") redirect("/")

  const supabase = createAdminClient()

  // ดึง rounds ล่าสุด 10 รอบ
  const { data: rounds } = await supabase
    .from("auction_rounds")
    .select("id, round_date, item_type, total_quantity, personal_limit, status")
    .order("created_at", { ascending: false })
    .limit(10) as { data: AuctionRound[] | null }

  // ดึง active round's waiting queues
  const activeRound = (rounds ?? []).find(r => r.status === "voting" || r.status === "bidding")
  let waitingQueues: QueueEntry[] = []
  if (activeRound) {
    const { data } = await supabase
      .from("auction_queues")
      .select("*, profiles:user_id(display_name, discord_id)")
      .eq("round_id", activeRound.id)
      .eq("status", "waiting")
      .order("queued_at") as { data: QueueEntry[] | null }
    waitingQueues = data ?? []
  }

  // ดึง all members
  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, discord_id")
    .order("display_name")

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-500 hover:text-white transition-colors text-sm">← กลับ</a>
          <h1 className="text-2xl font-bold text-white">⚙️ Admin Panel</h1>
        </div>

        {/* Award Form */}
        {activeRound && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              🎁 Award ไอเทม — {ITEM_CONFIG[activeRound.item_type]?.label}
            </h2>
            <AdminAwardForm
              roundId={activeRound.id}
              itemType={activeRound.item_type}
              waitingQueues={waitingQueues}
            />
          </div>
        )}

        {/* Recent Rounds */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="bg-gray-800 px-6 py-4">
            <h2 className="text-sm font-semibold text-white">รอบล่าสุด</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-gray-400 font-medium">วันที่</th>
                <th className="px-4 py-3 text-gray-400 font-medium">ไอเทม</th>
                <th className="px-4 py-3 text-gray-400 font-medium text-center">จำนวน</th>
                <th className="px-4 py-3 text-gray-400 font-medium text-center">Limit</th>
                <th className="px-4 py-3 text-gray-400 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {(rounds ?? []).map((r) => (
                <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{r.round_date}</td>
                  <td className="px-4 py-3 text-white">{ITEM_CONFIG[r.item_type]?.label ?? r.item_type}</td>
                  <td className="px-4 py-3 text-center text-white font-mono">{r.total_quantity}</td>
                  <td className="px-4 py-3 text-center text-white font-mono">{r.personal_limit}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === "voting" ? "bg-blue-900/40 text-blue-400" :
                      r.status === "bidding" ? "bg-green-900/40 text-green-400" :
                      "bg-gray-700 text-gray-400"
                    }`}>
                      {r.status === "voting" ? "🗳️ โหวต" : r.status === "bidding" ? "🎯 จองคิว" : "✅ ปิด"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-gray-600 text-xs text-center">
          ใช้ Discord Bot (<code>/start_vote</code>, <code>/close_vote</code>) เพื่อจัดการรอบประมูล
        </p>
      </div>
    </main>
  )
}
