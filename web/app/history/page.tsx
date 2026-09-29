import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { ITEM_CONFIG } from "@/lib/constants"
import type { ItemType } from "@/lib/constants"

interface HistoryRow {
  id: string
  round_id: string | null
  item_type: ItemType
  qty_awarded: number
  note: string | null
  awarded_at: string
  profiles: { display_name: string } | null
  awarded_by_profile: { display_name: string } | null
}

export default async function HistoryPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const supabase = createAdminClient()

  const { data: history } = await supabase
    .from("auction_history")
    .select(`
      id, round_id, item_type, qty_awarded, note, awarded_at,
      profiles:user_id(display_name),
      awarded_by_profile:awarded_by(display_name)
    `)
    .order("awarded_at", { ascending: false })
    .limit(200) as { data: HistoryRow[] | null }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-500 hover:text-white transition-colors text-sm">← กลับ</a>
          <h1 className="text-2xl font-bold text-white">📋 ประวัติการประมูล</h1>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium">วันที่</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">ผู้รับ</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">ไอเทม</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">จำนวน</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Admin</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {(history ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-600">ยังไม่มีประวัติ</td>
                  </tr>
                ) : (
                  (history ?? []).map((row) => {
                    const cfg = ITEM_CONFIG[row.item_type]
                    const dt = new Date(row.awarded_at)
                    return (
                      <tr key={row.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {dt.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" })}{" "}
                          {dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {row.profiles?.display_name ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${cfg?.badge ?? "bg-gray-700 text-gray-300"}`}>
                            {cfg?.label ?? row.item_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-white font-mono">{row.qty_awarded}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {row.awarded_by_profile?.display_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{row.note ?? "—"}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
