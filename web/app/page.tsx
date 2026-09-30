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
    <div className="min-h-screen bg-zinc-950">
      <NavBar isAdmin={isAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">ระบบประมูล</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {new Date().toLocaleDateString("th-TH", { dateStyle: "full" })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/queues"
              className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-sm transition-all"
            >
              จัดคิว &amp; สล็อต →
            </Link>
            <Link
              href="/members"
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-sm border border-zinc-700 transition-all"
            >
              สมาชิก ({totalMembers ?? 0})
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "สมาชิกในกิลด์", value: totalMembers ?? 0, href: "/members" },
            { label: "ลงชื่อวันนี้", value: todayAttendees ?? 0, href: "/queues" },
            { label: "สล็อตจัดสรรแล้ว", value: totalAllocated ?? 0, href: "/queues" },
            { label: "อีเวนต์ที่เปิดรับ", value: events.length, href: "/queues" },
          ].map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all"
            >
              <div className="text-xs text-zinc-500 font-medium mb-2">{stat.label}</div>
              <div className="text-3xl font-bold text-zinc-100 font-mono">{stat.value}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Event Attendance Poll Summary */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-100 text-sm">
                สถิติผู้เข้าร่วมกิจกรรม
              </h2>
              <Link href="/queues" className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
                จัดการคิว →
              </Link>
            </div>
            <div className="p-5 space-y-4">
              {events.length === 0 ? (
                <div className="text-center text-zinc-600 py-10 text-sm">
                  ยังไม่มีโพลนับคนเข้าร่วม{" "}
                  <span className="text-zinc-500">
                    (ใช้คำสั่ง <code className="text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">/event_poll</code> ใน Discord)
                  </span>
                </div>
              ) : (
                events.map((ev) => {
                  const total = ev.want_bid + ev.no_bid + ev.absent
                  return (
                    <div
                      key={`${ev.event_name}|${ev.event_date}`}
                      className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-100 text-sm">{ev.event_name}</span>
                        <span className="text-xs font-mono text-zinc-500">{ev.event_date}</span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { key: "want_bid", label: "Join the war / Want to bid", val: ev.want_bid, bar: "bg-emerald-500" },
                          { key: "no_bid", label: "Join the war / Do not want to bid", val: ev.no_bid, bar: "bg-amber-500" },
                          { key: "absent", label: "Unable to attend", val: ev.absent, bar: "bg-rose-500" },
                        ].map((opt) => {
                          const pct = total ? Math.round((opt.val * 100) / total) : 0
                          return (
                            <div key={opt.key}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-zinc-400">{opt.label}</span>
                                <span className="text-zinc-200 font-semibold">
                                  {pct}% ({opt.val} คน)
                                </span>
                              </div>
                              <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${opt.bar} rounded-full transition-all`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="text-xs text-zinc-600">รวมทั้งหมด {total} คน</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Configured Items Summary */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-100 text-sm">
                รายการไอเทมและพิกัดหน้า/ช่อง
              </h2>
              <Link href="/queues" className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
                ตั้งค่าไอเทม →
              </Link>
            </div>
            <div className="p-5 space-y-3">
              {!eventSessions || eventSessions.length === 0 ? (
                <div className="text-center text-zinc-600 py-10 text-sm">
                  ยังไม่มีข้อมูลไอเทม (ตั้งค่าได้ที่หน้า{" "}
                  <Link href="/queues" className="text-zinc-400 underline">
                    จัดคิว &amp; สล็อต
                  </Link>
                  )
                </div>
              ) : (
                eventSessions.slice(0, 4).map((s: any) => {
                  const cfg = ITEM_CONFIG[s.item_type as ItemType]
                  return (
                    <div
                      key={s.id}
                      className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-4 flex items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-100 text-sm">{cfg?.label || s.item_type}</span>
                          <span className="text-[11px] text-zinc-500 font-mono">({s.event_name})</span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5 font-mono">
                          Page {s.start_page} ช่อง {s.start_slot} → Page {s.end_page} ช่อง {s.end_slot}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-zinc-100 font-mono">{s.total_quantity} ชิ้น</div>
                        <div className="text-xs text-emerald-400">Limit {s.personal_limit}/คน</div>
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
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-100 text-sm">พิกัดสล็อตที่จัดสรรล่าสุด</h2>
              <Link href="/queues" className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
                เปิดกระดาน 4 ช่องเต็ม →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-500 text-left">
                    <th className="px-5 py-3 font-medium">สมาชิก</th>
                    <th className="px-5 py-3 font-medium">ไอเทม</th>
                    <th className="px-5 py-3 text-center font-medium">Page</th>
                    <th className="px-5 py-3 text-center font-medium">ช่องที่</th>
                    <th className="px-5 py-3 text-center font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {(allocatedSlots as any[]).slice(0, 12).map((slot) => {
                    const cfg = ITEM_CONFIG[slot.item_type as ItemType]
                    return (
                      <tr key={slot.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-5 py-3 font-semibold text-zinc-100">
                          {slot.profiles?.display_name || "Unknown"}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {cfg?.label || slot.item_type}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center text-zinc-300 font-mono font-semibold">
                          Page {slot.page_number}/{slot.total_pages}
                        </td>
                        <td className="px-5 py-3 text-center text-zinc-100 font-mono font-semibold">
                          ช่องที่ {slot.slot_number}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              slot.status === "awarded"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                                : slot.status === "skipped"
                                ? "bg-rose-950 text-rose-400 border border-rose-800/60"
                                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                            }`}
                          >
                            {slot.status === "awarded"
                              ? "ได้รับแล้ว"
                              : slot.status === "skipped"
                              ? "ข้ามคิว"
                              : "รอประมูล"}
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
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-100 text-sm">สมาชิกล่าสุด</h2>
            <Link href="/members" className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
              จัดการสมาชิกทั้งหมด →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y divide-zinc-800 md:divide-y-0 md:divide-x">
            {(recentMembers || []).map((m: any) => (
              <div key={m.id} className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-700 flex items-center justify-center text-zinc-100 font-bold text-sm flex-shrink-0">
                  {m.display_name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-zinc-100 text-sm truncate">{m.display_name}</div>
                  <div className="text-xs text-zinc-500 truncate">{m.job_class || "ไม่ระบุอาชีพ"}</div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    m.role === "admin"
                      ? "bg-zinc-700 text-zinc-200 border border-zinc-600"
                      : "bg-zinc-800 text-zinc-500"
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
