import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { ITEM_CONFIG } from "@/lib/constants"
import type { ItemType } from "@/lib/constants"

interface CreditRow {
  user_id: string
  item_type: ItemType
  credit: number
  last_updated: string
  profiles: { display_name: string; discord_id: string } | null
}

export default async function CreditsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const supabase = createAdminClient()
  const { data: credits } = await supabase
    .from("carry_credits")
    .select("*, profiles:user_id(display_name, discord_id)")
    .gt("credit", 0)
    .order("credit", { ascending: false }) as { data: CreditRow[] | null }

  // Group by user
  const byUser: Record<string, { display_name: string; credits: Record<string, number> }> = {}
  for (const row of credits ?? []) {
    const uid = row.user_id
    if (!byUser[uid]) {
      byUser[uid] = {
        display_name: row.profiles?.display_name ?? "—",
        credits: {},
      }
    }
    byUser[uid].credits[row.item_type] = row.credit
  }

  const itemTypes = Object.keys(ITEM_CONFIG) as ItemType[]

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-500 hover:text-white transition-colors text-sm">← กลับ</a>
          <h1 className="text-2xl font-bold text-white">💎 ยอดค้างสะสม (Carry Credits)</h1>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium">ชื่อ</th>
                  {itemTypes.map((t) => (
                    <th key={t} className="px-4 py-3 text-gray-400 font-medium text-center">
                      {ITEM_CONFIG[t].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(byUser).length === 0 ? (
                  <tr>
                    <td colSpan={itemTypes.length + 1} className="px-4 py-8 text-center text-gray-600">
                      ยังไม่มียอดค้างสะสม
                    </td>
                  </tr>
                ) : (
                  Object.entries(byUser).map(([uid, user]) => (
                    <tr key={uid} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{user.display_name}</td>
                      {itemTypes.map((t) => (
                        <td key={t} className="px-4 py-3 text-center">
                          {user.credits[t] ? (
                            <span className="bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full text-xs font-mono">
                              +{user.credits[t]}
                            </span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-gray-600 text-xs">
          💡 credit สะสมจากการเลือก &quot;ไม่ประมูล&quot; — ใช้เพื่อรับสิทธิ์ก่อนคนอื่นในรอบถัดไป
        </p>
      </div>
    </main>
  )
}
