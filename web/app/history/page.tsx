import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { ITEM_CONFIG } from "@/lib/constants"
import type { ItemType } from "@/lib/constants"
import NavBar from "@/components/NavBar"

export default async function HistoryPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const isAdmin = (session.user as any)?.role === "admin"

  const supabase = createAdminClient()

  const { data: history } = await supabase
    .from("auction_history")
    .select("*, profiles:user_id(display_name, discord_id), awarded_by_profile:awarded_by(display_name)")
    .order("awarded_at", { ascending: false })
    .limit(200)

  return (
    <div className="min-h-screen bg-zinc-950">
      <NavBar isAdmin={isAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">ประวัติการประมูล</h1>
          <p className="text-zinc-500 text-sm mt-1">รายการล่าสุด 200 รายการ</p>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          {(!history || history.length === 0) ? (
            <div className="p-16 text-center">
              <p className="text-zinc-500">ยังไม่มีประวัติการประมูล</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                    <th className="px-5 py-3 font-medium">วันที่</th>
                    <th className="px-5 py-3 font-medium">สมาชิก</th>
                    <th className="px-5 py-3 font-medium">ไอเทม</th>
                    <th className="px-5 py-3 text-center font-medium">จำนวน</th>
                    <th className="px-5 py-3 font-medium">มอบโดย</th>
                    <th className="px-5 py-3 font-medium">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {(history as any[]).map((h) => {
                    const cfg = ITEM_CONFIG[h.item_type as ItemType]
                    return (
                      <tr key={h.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-5 py-3 text-zinc-500 text-xs whitespace-nowrap">
                          {new Date(h.awarded_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-5 py-3 font-medium text-zinc-100">
                          {(h.profiles as any)?.display_name || "Unknown"}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {cfg?.label || h.item_type}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center text-zinc-100 font-bold">{h.qty_awarded}</td>
                        <td className="px-5 py-3 text-zinc-400 text-xs">
                          {(h.awarded_by_profile as any)?.display_name || "-"}
                        </td>
                        <td className="px-5 py-3 text-zinc-600 text-xs max-w-xs truncate">
                          {h.note || "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
