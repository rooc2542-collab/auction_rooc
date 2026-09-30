import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import NavBar from "@/components/NavBar"
import AdminAwardForm from "./AdminAwardForm"

export default async function AdminPage() {
  const session = await auth()
  if (!session || (session.user as any)?.role !== "admin") redirect("/")

  const supabase = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  const { data: recentSessions } = await supabase
    .from("event_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20)

  const { data: recentAttendance } = await supabase
    .from("event_attendance")
    .select("*, profiles:user_id(display_name, job_class)")
    .eq("event_date", today)
    .order("created_at", { ascending: false })

  const { data: allocatedSlots } = await supabase
    .from("allocated_slots")
    .select("*, profiles:user_id(display_name, discord_id)")
    .eq("session_date", today)
    .order("page_number", { ascending: true })

  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, discord_id")
    .order("display_name", { ascending: true })

  return (
    <div className="min-h-screen bg-zinc-950">
      <NavBar isAdmin />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Admin Panel</h1>
          <p className="text-zinc-500 text-sm mt-1">จัดการระบบประมูล</p>
        </div>

        {/* Award Form */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="font-semibold text-zinc-100 text-sm">Award ไอเทม</h2>
          </div>
          <div className="p-5">
            <AdminAwardForm members={members || []} />
          </div>
        </div>

        {/* Today's Allocated Slots */}
        {allocatedSlots && allocatedSlots.length > 0 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-100 text-sm">สล็อตที่จัดสรรวันนี้</h2>
              <span className="text-xs text-zinc-600 font-mono">{today}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                    <th className="px-5 py-3 font-medium">สมาชิก</th>
                    <th className="px-5 py-3 font-medium">ไอเทม</th>
                    <th className="px-5 py-3 text-center font-medium">Page</th>
                    <th className="px-5 py-3 text-center font-medium">Slot</th>
                    <th className="px-5 py-3 text-center font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {(allocatedSlots as any[]).map((slot) => (
                    <tr key={slot.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3 text-zinc-100">{slot.profiles?.display_name || "-"}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {slot.item_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center font-mono text-zinc-200">{slot.page_number}/{slot.total_pages}</td>
                      <td className="px-5 py-3 text-center font-mono text-zinc-200">{slot.slot_number}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                          slot.status === "awarded"
                            ? "bg-emerald-950 text-emerald-400 border-emerald-800/60"
                            : slot.status === "skipped"
                            ? "bg-rose-950 text-rose-400 border-rose-800/60"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                        }`}>
                          {slot.status === "awarded" ? "ได้รับแล้ว" : slot.status === "skipped" ? "ข้าม" : "รอ"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Today's Attendance */}
        {recentAttendance && recentAttendance.length > 0 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="font-semibold text-zinc-100 text-sm">ผู้เข้าร่วมวันนี้</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                    <th className="px-5 py-3 font-medium">สมาชิก</th>
                    <th className="px-5 py-3 font-medium">อีเวนต์</th>
                    <th className="px-5 py-3 font-medium">สถานะ</th>
                    <th className="px-5 py-3 font-medium">ไอเทมที่ต้องการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {(recentAttendance as any[]).map((a) => (
                    <tr key={a.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3 text-zinc-100">{a.profiles?.display_name || "-"}</td>
                      <td className="px-5 py-3 text-zinc-500 text-xs">{a.event_name}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                          a.status === "want_bid"
                            ? "bg-emerald-950 text-emerald-400 border-emerald-800/60"
                            : a.status === "no_bid"
                            ? "bg-amber-950 text-amber-400 border-amber-800/60"
                            : "bg-rose-950 text-rose-400 border-rose-800/60"
                        }`}>
                          {a.status === "want_bid" ? "Want to bid" : a.status === "no_bid" ? "No bid" : "Absent"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-500 text-xs">
                        {(a.interested_items || []).join(", ") || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Event Sessions */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="font-semibold text-zinc-100 text-sm">Sessions ล่าสุด</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                  <th className="px-5 py-3 font-medium">อีเวนต์</th>
                  <th className="px-5 py-3 font-medium">วันที่</th>
                  <th className="px-5 py-3 font-medium">ไอเทม</th>
                  <th className="px-5 py-3 text-center font-medium">จำนวน</th>
                  <th className="px-5 py-3 text-center font-medium">Limit</th>
                  <th className="px-5 py-3 font-medium">พิกัด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {(!recentSessions || recentSessions.length === 0) ? (
                  <tr><td colSpan={6} className="text-center text-zinc-600 py-8">ยังไม่มี session</td></tr>
                ) : (recentSessions as any[]).map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3 text-zinc-100">{s.event_name}</td>
                    <td className="px-5 py-3 text-zinc-500 text-xs font-mono">{s.session_date}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {s.item_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-zinc-100">{s.total_quantity}</td>
                    <td className="px-5 py-3 text-center text-zinc-400">{s.personal_limit}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600 font-mono">
                      {s.start_page}:{s.start_slot} → {s.end_page}:{s.end_slot}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
