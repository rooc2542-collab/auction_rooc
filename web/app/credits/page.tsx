import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { ITEM_CONFIG } from "@/lib/constants"
import type { ItemType } from "@/lib/constants"
import NavBar from "@/components/NavBar"

export default async function CreditsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const isAdmin = (session.user as any)?.role === "admin"

  const supabase = createAdminClient()

  const { data: credits } = await supabase
    .from("carry_credits")
    .select("*, profiles:user_id(display_name, discord_id)")
    .order("credit", { ascending: false })

  // Group by user
  const userMap: Record<string, { display_name: string; discord_id: string; items: Record<string, number> }> = {}
  for (const c of credits || []) {
    const uid = c.user_id
    if (!userMap[uid]) {
      userMap[uid] = {
        display_name: (c.profiles as any)?.display_name || "Unknown",
        discord_id: (c.profiles as any)?.discord_id || "",
        items: {},
      }
    }
    userMap[uid].items[c.item_type] = c.credit
  }

  const users = Object.values(userMap).filter((u) => Object.values(u.items).some((v) => v > 0))

  return (
    <div className="min-h-screen bg-gray-950">
      <NavBar isAdmin={isAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">💳 ยอดค้างสะสม (Carry Credits)</h1>
          <p className="text-gray-400 text-sm mt-1">สะสมจากการเลือก "Join / Do not bid" — นำไปลัดคิวรอบถัดไป</p>
        </div>

        {users.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-16 text-center">
            <div className="text-4xl mb-3">💳</div>
            <p className="text-gray-400">ยังไม่มียอดค้างสะสมในระบบ</p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-left">
                    <th className="px-4 py-3 font-medium">สมาชิก</th>
                    {Object.entries(ITEM_CONFIG).map(([key, cfg]) => (
                      <th key={key} className="px-4 py-3 font-medium text-center">{cfg.label}</th>
                    ))}
                    <th className="px-4 py-3 font-medium text-center">รวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map((u) => {
                    const total = Object.values(u.items).reduce((a, b) => a + b, 0)
                    return (
                      <tr key={u.discord_id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-900 flex items-center justify-center text-purple-300 font-bold text-xs">
                              {u.display_name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <span className="font-medium text-white">{u.display_name}</span>
                          </div>
                        </td>
                        {Object.keys(ITEM_CONFIG).map((key) => {
                          const val = u.items[key] || 0
                          return (
                            <td key={key} className="px-4 py-3 text-center">
                              {val > 0 ? (
                                <span className={`font-bold ${ITEM_CONFIG[key as ItemType].badge.split(" ")[0] === "bg-purple-100" ? "text-purple-400" : val > 0 ? "text-amber-400" : "text-gray-600"}`}>
                                  +{val}
                                </span>
                              ) : (
                                <span className="text-gray-700">—</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-white bg-gray-700 px-2 py-0.5 rounded-full text-xs">+{total}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
