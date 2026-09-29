import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { ITEM_CONFIG, ROUND_STATUS_LABELS } from "@/lib/constants"
import type { ItemType } from "@/lib/constants"
import NavBar from "@/components/NavBar"

const VOTE_LABELS = {
  want_bid: { label: "ต้องการประมูล", icon: "🎮", color: "text-green-400" },
  no_bid: { label: "ไม่ประมูล (Credit)", icon: "📦", color: "text-yellow-400" },
  absent: { label: "ไม่เข้าร่วม", icon: "⛔", color: "text-red-400" },
}

export default async function HomePage() {
  const session = await auth()
  if (!session) redirect("/login")
  const isAdmin = (session.user as any)?.role === "admin"

  const supabase = createAdminClient()

  // Active event attendance (today)
  const today = new Date().toISOString().split("T")[0]
  const { data: attendanceSummary } = await supabase
    .from("event_attendance")
    .select("event_name, event_date, status")
    .eq("event_date", today)
    .order("created_at", { ascending: false })

  // Group by event
  const eventMap: Record<string, { event_name: string; event_date: string; want_bid: number; no_bid: number; absent: number }> = {}
  for (const row of attendanceSummary || []) {
    const key = `${row.event_name}|${row.event_date}`
    if (!eventMap[key]) {
      eventMap[key] = { event_name: row.event_name, event_date: row.event_date, want_bid: 0, no_bid: 0, absent: 0 }
    }
    eventMap[key][row.status as "want_bid" | "no_bid" | "absent"] += 1
  }
  const events = Object.values(eventMap)

  // Allocated slots today
  const { data: allocatedSlots } = await supabase
    .from("allocated_slots")
    .select("*, profiles:user_id(display_name, discord_id)")
    .eq("session_date", today)
    .order("page_number", { ascending: true })
    .order("slot_number", { ascending: true })

  // Event sessions today
  const { data: eventSessions } = await supabase
    .from("event_sessions")
    .select("*")
    .eq("session_date", today)

  // Recent members
  const { data: recentMembers } = await supabase
    .from("profiles")
    .select("id, display_name, discord_id, uid_game, job_class, role, created_at")
    .order("created_at", { ascending: false })
    .limit(5)

  // Stats
  const { count: totalMembers } = await supabase.from("profiles").select("*", { count: "exact", head: true })
  const { count: todayAttendees } = await supabase.from("event_attendance").select("*", { count: "exact", head: true }).eq("event_date", today)
  const { count: totalAllocated } = await supabase.from("allocated_slots").select("*", { count: "exact", head: true }).eq("session_date", today)

  return (
    <div className="min-h-screen bg-gray-950">
      <NavBar isAdmin={isAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">📊 Dashboard</h1>
          <p className="text-gray-400 mt-1">{new Date().toLocaleDateString("th-TH", { dateStyle: "full" })}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "สมาชิกทั้งหมด", value: totalMembers ?? 0, icon: "👥", color: "from-blue-600 to-blue-800" },
            { label: "เข้าร่วมวันนี้", value: todayAttendees ?? 0, icon: "⚔️", color: "from-green-600 to-green-800" },
            { label: "สล็อตจัดสรรแล้ว", value: totalAllocated ?? 0, icon: "🎯", color: "from-purple-600 to-purple-800" },
            { label: "อีเวนต์วันนี้", value: events.length, icon: "📅", color: "from-orange-600 to-orange-800" },
          ].map((stat) => (
            <div key={stat.label} className={`bg-gradient-to-br ${stat.color} rounded-xl p-4 shadow-lg`}>
              <div className="text-3xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-white/70">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Event Attendance Today */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-white">⚔️ อีเวนต์วันนี้</h2>
              <span className="text-xs text-gray-500">{today}</span>
            </div>
            <div className="p-4 space-y-3">
              {events.length === 0 ? (
                <p className="text-center text-gray-500 py-8">ยังไม่มีอีเวนต์วันนี้</p>
              ) : events.map((ev) => {
                const total = ev.want_bid + ev.no_bid + ev.absent
                return (
                  <div key={`${ev.event_name}|${ev.event_date}`} className="bg-gray-800 rounded-lg p-4">
                    <div className="font-medium text-white mb-3">{ev.event_name}</div>
                    <div className="space-y-2">
                      {[
                        { key: "want_bid", label: "Join / Want to bid", val: ev.want_bid, color: "bg-green-500" },
                        { key: "no_bid", label: "Join / Do not bid", val: ev.no_bid, color: "bg-yellow-500" },
                        { key: "absent", label: "Unable to attend", val: ev.absent, color: "bg-red-500" },
                      ].map((opt) => (
                        <div key={opt.key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300">{opt.label}</span>
                            <span className="text-white font-medium">{opt.val} คน ({total ? Math.round(opt.val * 100 / total) : 0}%)</span>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full">
                            <div
                              className={`h-2 ${opt.color} rounded-full transition-all`}
                              style={{ width: total ? `${opt.val * 100 / total}%` : "0%" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">{total} คนทั้งหมด</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Item Sessions Today */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="font-semibold text-white">📦 ไอเทมวันนี้</h2>
            </div>
            <div className="p-4 space-y-3">
              {!eventSessions || eventSessions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">ยังไม่มีข้อมูลไอเทม</p>
              ) : eventSessions.map((session: any) => {
                const cfg = ITEM_CONFIG[session.item_type as ItemType]
                return (
                  <div key={session.id} className="bg-gray-800 rounded-lg p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg ${cfg?.bg || "bg-gray-700"} flex items-center justify-center text-xl flex-shrink-0`}>
                      {session.item_type === "Album" ? "📖" : session.item_type === "Puppet" ? "🎭" : session.item_type === "White" ? "🪶" : "🔴"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm">{cfg?.label || session.item_type}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {session.total_quantity} ชิ้น • Limit {session.personal_limit}/คน
                        {session.start_page > 1 && ` • หน้า ${session.start_page}/${session.end_page}`}
                      </div>
                    </div>
                    <div className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded-full">Active</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Allocated Slots */}
        {allocatedSlots && allocatedSlots.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="font-semibold text-white">🎯 สล็อตที่จัดสรรแล้ว</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">สมาชิก</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">ไอเทม</th>
                    <th className="px-4 py-3 text-center text-gray-400 font-medium">หน้า</th>
                    <th className="px-4 py-3 text-center text-gray-400 font-medium">ช่อง</th>
                    <th className="px-4 py-3 text-center text-gray-400 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {(allocatedSlots as any[]).map((slot) => {
                    const cfg = ITEM_CONFIG[slot.item_type as ItemType]
                    const profile = slot.profiles
                    return (
                      <tr key={slot.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 text-white">{profile?.display_name || "Unknown"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${cfg?.badge || "bg-gray-700 text-gray-300"}`}>
                            {cfg?.label || slot.item_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-white font-mono">{slot.page_number}/{slot.total_pages}</td>
                        <td className="px-4 py-3 text-center text-white font-mono">{slot.slot_number}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            slot.status === "awarded" ? "bg-green-900 text-green-400" :
                            slot.status === "skipped" ? "bg-red-900 text-red-400" :
                            "bg-yellow-900 text-yellow-400"
                          }`}>
                            {slot.status === "awarded" ? "✅ ได้รับแล้ว" : slot.status === "skipped" ? "⏭️ ข้ามคิว" : "⏳ รอรับ"}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Members */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">👥 สมาชิกล่าสุด</h2>
            <a href="/members" className="text-sm text-purple-400 hover:text-purple-300">ดูทั้งหมด →</a>
          </div>
          <div className="divide-y divide-gray-800">
            {(recentMembers || []).map((m: any) => (
              <div key={m.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-800/50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-purple-900 flex items-center justify-center text-purple-300 font-bold text-sm flex-shrink-0">
                  {m.display_name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm truncate">{m.display_name}</div>
                  <div className="text-xs text-gray-500">{m.job_class || "ไม่ระบุอาชีพ"} • UID: {m.uid_game || "-"}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === "admin" ? "bg-purple-900 text-purple-300" : "bg-gray-700 text-gray-400"}`}>
                  {m.role === "admin" ? "Admin" : "Member"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
