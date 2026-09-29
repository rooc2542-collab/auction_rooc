import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/server"
import { ITEM_CONFIG } from "@/lib/constants"
import type { ItemType } from "@/lib/constants"
import NavBar from "@/components/NavBar"

export default async function HomePage() {
  const session = await auth()
  if (!session) redirect("/login")
  const isAdmin = (session.user as any)?.role === "admin"

  const supabase = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  const [
    { data: attendanceSummary },
    { data: allocatedSlots },
    { data: eventSessions },
    { data: recentMembers },
    { count: totalMembers },
    { count: todayAttendees },
    { count: totalAllocated },
  ] = await Promise.all([
    supabase
      .from("event_attendance")
      .select("event_name, event_date, status")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("allocated_slots")
      .select("*, profiles:user_id(display_name, discord_id, job_class)")
      .order("page_number", { ascending: true })
      .order("slot_number", { ascending: true })
      .limit(100),
    supabase
      .from("event_sessions")
      .select("*")
      .order("session_date", { ascending: false })
      .limit(12),
    supabase
      .from("profiles")
      .select("id, display_name, discord_id, job_class, role, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("event_attendance").select("*", { count: "exact", head: true }).eq("event_date", today),
    supabase.from("allocated_slots").select("*", { count: "exact", head: true }),
  ])

  // Group attendance by event
  const eventMap: Record<
    string,
    { event_name: string; event_date: string; want_bid: number; no_bid: number; absent: number }
  > = {}
  for (const row of attendanceSummary || []) {
    const key = `${row.event_name}|${row.event_date}`
    if (!eventMap[key]) {
      eventMap[key] = {
        event_name: row.event_name,
        event_date: row.event_date,
        want_bid: 0,
        no_bid: 0,
        absent: 0,
      }
    }
    eventMap[key][row.status as "want_bid" | "no_bid" | "absent"] += 1
  }
  const events = Object.values(eventMap).slice(0, 4)

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar isAdmin={isAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-purple-900/50 via-indigo-900/40 to-slate-900 border border-purple-700/30 p-6 md:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-700/50 text-purple-300 text-xs font-bold mb-3">
              <span>⚡</span>
              <span>Auction_Rooc • ระบบจัดสรรคิวและสล็อตประมูล</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              ระบบประมูล
            </h1>
            <p className="text-slate-300 text-sm mt-1.5">
              วัน{new Date().toLocaleDateString("th-TH", { dateStyle: "full" })} • แบ่งสล็อตหน้าละ 4 ช่องตามเกมจริง
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/queues"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-900/40 transition-all"
            >
              🎯 จัดคิว & กระดานสล็อต 4 ช่อง →
            </Link>
            <Link
              href="/members"
              className="px-5 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all"
            >
              👥 จัดการสมาชิก ({totalMembers ?? 0})
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "สมาชิกในกิลด์", value: totalMembers ?? 0, icon: "👥", color: "from-blue-600/30 to-blue-900/40 border-blue-700/40", href: "/members" },
            { label: "ลงชื่อเข้าร่วมวันนี้", value: todayAttendees ?? 0, icon: "⚔️", color: "from-emerald-600/30 to-emerald-900/40 border-emerald-700/40", href: "/queues" },
            { label: "สล็อตที่จัดสรรแล้ว", value: totalAllocated ?? 0, icon: "🎯", color: "from-purple-600/30 to-purple-900/40 border-purple-700/40", href: "/queues" },
            { label: "อีเวนต์ที่เปิดรับ", value: events.length, icon: "📅", color: "from-amber-600/30 to-amber-900/40 border-amber-700/40", href: "/queues" },
          ].map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className={`bg-gradient-to-br ${stat.color} border rounded-2xl p-5 shadow-xl hover:scale-[1.02] transition-all`}
            >
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-3xl font-extrabold text-white font-mono">{stat.value}</div>
              <div className="text-xs font-semibold text-slate-300 mt-1">{stat.label}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Event Attendance Poll Summary */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <span>⚔️</span>
                <span>สถิติผู้เข้าร่วมกิจกรรม (Attendance Count)</span>
              </h2>
              <Link href="/queues" className="text-xs font-bold text-purple-400 hover:text-purple-300">
                จัดการคิว →
              </Link>
            </div>
            <div className="p-5 space-y-4">
              {events.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-sm">
                  ยังไม่มีโพลนับคนเข้าร่วม (ใช้คำสั่ง <code className="text-purple-400">/event_poll</code> ใน Discord หรือเพิ่มในหน้าจัดคิว)
                </div>
              ) : (
                events.map((ev) => {
                  const total = ev.want_bid + ev.no_bid + ev.absent
                  return (
                    <div
                      key={`${ev.event_name}|${ev.event_date}`}
                      className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{ev.event_name}</span>
                        <span className="text-xs font-mono text-slate-400">{ev.event_date}</span>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { key: "want_bid", label: "🎮 Join the war / Want to bid", val: ev.want_bid, color: "bg-emerald-500" },
                          { key: "no_bid", label: "🚫 Join the war / Do not want to bid", val: ev.no_bid, color: "bg-amber-500" },
                          { key: "absent", label: "⛔ Unable to attend", val: ev.absent, color: "bg-rose-500" },
                        ].map((opt) => {
                          const pct = total ? Math.round((opt.val * 100) / total) : 0
                          return (
                            <div key={opt.key}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-300 font-medium">{opt.label}</span>
                                <span className="text-white font-bold">
                                  {pct}% ({opt.val} คน)
                                </span>
                              </div>
                              <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${opt.color} rounded-full transition-all`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="text-xs text-slate-400 pt-1">รวมทั้งหมด {total} คน</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Configured Items Summary */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <span>📦</span>
                <span>รายการไอเทมและพิกัดหน้า/ช่อง</span>
              </h2>
              <Link href="/queues" className="text-xs font-bold text-purple-400 hover:text-purple-300">
                ตั้งค่าไอเทม →
              </Link>
            </div>
            <div className="p-5 space-y-3">
              {!eventSessions || eventSessions.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-sm">
                  ยังไม่มีข้อมูลไอเทม (ตั้งค่าได้ที่หน้า <Link href="/queues" className="text-purple-400 underline">จัดคิว & สล็อต</Link>)
                </div>
              ) : (
                eventSessions.slice(0, 4).map((s: any) => {
                  const cfg = ITEM_CONFIG[s.item_type as ItemType]
                  const icon =
                    s.item_type === "Album"
                      ? "📖"
                      : s.item_type === "Puppet"
                      ? "🎭"
                      : s.item_type === "White"
                      ? "🪶"
                      : "🔴"
                  return (
                    <div
                      key={s.id}
                      className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl flex-shrink-0">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{cfg?.label || s.item_type}</span>
                          <span className="text-[11px] text-slate-400 font-mono">({s.event_name})</span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1 font-mono">
                          Page {s.start_page} ช่อง {s.start_slot} → Page {s.end_page} ช่อง {s.end_slot}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-extrabold text-white font-mono">{s.total_quantity} ชิ้น</div>
                        <div className="text-xs text-emerald-400 font-semibold">Limit {s.personal_limit}/คน</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Allocated Slots Preview */}
        {allocatedSlots && allocatedSlots.length > 0 && (
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-white">🎯 พิกัดสล็อตที่จัดสรรล่าสุด</h2>
              <Link href="/queues" className="text-xs font-bold text-purple-400 hover:text-purple-300">
                เปิดกระดาน 4 ช่องเต็ม →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 text-left">
                    <th className="px-5 py-3 font-semibold">สมาชิก</th>
                    <th className="px-5 py-3 font-semibold">ไอเทม</th>
                    <th className="px-5 py-3 text-center font-semibold">พิกัดหน้า (Page)</th>
                    <th className="px-5 py-3 text-center font-semibold">ช่องที่ (Slot 1-4)</th>
                    <th className="px-5 py-3 text-center font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {(allocatedSlots as any[]).slice(0, 12).map((slot) => {
                    const cfg = ITEM_CONFIG[slot.item_type as ItemType]
                    return (
                      <tr key={slot.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3 font-semibold text-white">
                          {slot.profiles?.display_name || "Unknown"}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${cfg?.badge || "bg-slate-800 text-slate-300"}`}>
                            {cfg?.label || slot.item_type}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center text-purple-300 font-mono font-bold">
                          Page {slot.page_number}/{slot.total_pages}
                        </td>
                        <td className="px-5 py-3 text-center text-white font-mono font-bold">
                          ช่องที่ {slot.slot_number}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              slot.status === "awarded"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                                : slot.status === "skipped"
                                ? "bg-rose-950 text-rose-400 border border-rose-800/60"
                                : "bg-amber-950 text-amber-400 border border-amber-800/60"
                            }`}
                          >
                            {slot.status === "awarded"
                              ? "✅ ได้รับแล้ว"
                              : slot.status === "skipped"
                              ? "⏭️ ข้ามคิว"
                              : "⏳ รอประมูล"}
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
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-white">👥 สมาชิกล่าสุด</h2>
            <Link href="/members" className="text-xs font-bold text-purple-400 hover:text-purple-300">
              จัดการสมาชิกทั้งหมด →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md: gap-px bg-slate-800">
            {(recentMembers || []).map((m: any) => (
              <div key={m.id} className="bg-slate-900 p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {m.display_name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm truncate">{m.display_name}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {m.job_class || "ไม่ระบุอาชีพ"}
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    m.role === "admin" ? "bg-purple-950 text-purple-300 border border-purple-700/50" : "bg-slate-800 text-slate-400"
                  }`}
                >
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
