"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"

interface Member {
  id: string
  display_name: string
  discord_id: string
  job_class?: string | null
  role?: string
}

interface Attendance {
  event_name: string
  event_date: string
  discord_id: string
  status: string
  user_id: string
}

interface Props {
  isAdmin: boolean
  initialMembers: Member[]
  initialAttendance: Attendance[]
}

type AttendanceStatus = "want_bid" | "no_bid" | "absent"

const JOB_EMOJIS: Record<string, string> = {
  "Lord Knight": "⚔️",
  "Paladin": "🛡️",
  "Biochemist": "🧪",
  "Mastersmith": "🔨",
  "Bard": "🎵",
  "Gypsy": "💃",
  "Sniper": "🏹",
  "Champion": "👊",
  "Priest": "✝️",
  "Assassin": "🗡️",
  "Rogue": "🎭",
  "Wizard": "🔮",
  "Sage": "📖",
  "Summoner": "🌟",
  "Rebellion": "🔫",
}

export default function BenchOrganizerClient({
  isAdmin,
  initialMembers,
  initialAttendance,
}: Props) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [discordMessageId, setDiscordMessageId] = useState("")
  const [eventName, setEventName] = useState("Emperium Overrun")
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  // Mobile column view mode
  const [mobileTab, setMobileTab] = useState<"want_bid" | "no_bid" | "absent" | "all">("want_bid")

  // Map each member to an integer sequence ID based on DB sorting
  const memberIdMap = useMemo(() => {
    const map = new Map<string, number>()
    initialMembers.forEach((m, idx) => {
      map.set(m.id, idx + 1)
    })
    return map
  }, [initialMembers])

  // Initialize status map for all members (want_bid | no_bid | absent)
  const [statusMap, setStatusMap] = useState<Map<string, AttendanceStatus>>(() => {
    const map = new Map<string, AttendanceStatus>()

    // 1. From database initialAttendance (most recent)
    for (const a of initialAttendance) {
      if (a.user_id && (a.status === "want_bid" || a.status === "no_bid" || a.status === "absent")) {
        map.set(a.user_id, a.status as AttendanceStatus)
      }
    }

    // 2. From localStorage cache if available
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("rooc_bench_status_map")
        if (cached) {
          const parsed = JSON.parse(cached)
          if (typeof parsed === "object" && parsed !== null) {
            Object.entries(parsed).forEach(([id, st]) => {
              if (st === "want_bid" || st === "no_bid" || st === "absent") {
                map.set(id, st as AttendanceStatus)
              }
            })
          }
        }
      } catch {}
    }

    // 3. Any remaining member defaults to "no_bid" (สำรอง / ไม่ต้องการประมูล)
    for (const m of initialMembers) {
      if (!map.has(m.id)) {
        map.set(m.id, "no_bid")
      }
    }

    return map
  })

  // Persist to localStorage whenever statusMap changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const obj: Record<string, AttendanceStatus> = {}
        statusMap.forEach((val, key) => {
          obj[key] = val
        })
        localStorage.setItem("rooc_bench_status_map", JSON.stringify(obj))
      } catch {}
    }
  }, [statusMap])

  // Split into 3 Discord-aligned groups: want_bid, no_bid, absent
  const { wantBidList, noBidList, absentList } = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    const filterFn = (m: Member) => {
      if (!q) return true
      const idNum = String(memberIdMap.get(m.id) || "")
      return (
        m.display_name.toLowerCase().includes(q) ||
        (m.discord_id && m.discord_id.toLowerCase().includes(q)) ||
        (m.job_class && m.job_class.toLowerCase().includes(q)) ||
        idNum.includes(q)
      )
    }

    const wantBid: Member[] = []
    const noBid: Member[] = []
    const absent: Member[] = []

    for (const m of initialMembers) {
      if (!filterFn(m)) continue
      const st = statusMap.get(m.id) || "no_bid"
      if (st === "want_bid") wantBid.push(m)
      else if (st === "absent") absent.push(m)
      else noBid.push(m)
    }

    const sortFn = (a: Member, b: Member) => (memberIdMap.get(a.id) || 0) - (memberIdMap.get(b.id) || 0)
    wantBid.sort(sortFn)
    noBid.sort(sortFn)
    absent.sort(sortFn)

    return { wantBidList: wantBid, noBidList: noBid, absentList: absent }
  }, [initialMembers, statusMap, searchTerm, memberIdMap])

  // Set member status directly
  const handleSetStatus = (id: string, status: AttendanceStatus) => {
    setStatusMap((prev) => {
      const next = new Map(prev)
      next.set(id, status)
      return next
    })
  }

  // Reset all members to "no_bid"
  const handleResetToNoBid = () => {
    setStatusMap(() => {
      const next = new Map<string, AttendanceStatus>()
      for (const m of initialMembers) {
        next.set(m.id, "no_bid")
      }
      return next
    })
    setToast({ type: "ok", text: "รีเซ็ตทุกคนกลับสู่กลุ่ม 'เข้าร่วม / ไม่ต้องการประมูล' แล้ว" })
  }

  // Import from Discord Poll
  const handleImportDiscordPoll = async () => {
    if (!discordMessageId.trim()) {
      setToast({ type: "err", text: "กรุณาระบุ Discord Message ID" })
      return
    }

    setBusy(true)
    setToast(null)
    try {
      const res = await fetch("/api/discord/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: discordMessageId.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการดึงข้อมูลโพล")

      if (data.poll_title) {
        setEventName(data.poll_title)
      }

      if (
        Array.isArray(data.want_bid_members) ||
        Array.isArray(data.no_bid_members) ||
        Array.isArray(data.absent_members) ||
        Array.isArray(data.assigned_members)
      ) {
        setStatusMap((prev) => {
          const next = new Map(prev)
          const wantIds = new Set((data.want_bid_members || data.assigned_members || []).map((m: any) => m.id))
          const noBidIds = new Set((data.no_bid_members || []).map((m: any) => m.id))
          const absentIds = new Set((data.absent_members || []).map((m: any) => m.id))

          for (const m of initialMembers) {
            if (wantIds.has(m.id)) next.set(m.id, "want_bid")
            else if (noBidIds.has(m.id)) next.set(m.id, "no_bid")
            else if (absentIds.has(m.id)) next.set(m.id, "absent")
          }
          return next
        })

        const wb = data.want_bid_count ?? data.assigned_count ?? 0
        const nb = data.no_bid_count ?? 0
        const ab = data.absent_count ?? 0
        setToast({
          type: "ok",
          text: `นำเข้าโพลสำเร็จ: ต้องการประมูล ${wb} คน, ไม่ต้องการประมูล ${nb} คน, ไม่เข้าร่วม ${ab} คน`,
        })
      } else {
        setToast({ type: "ok", text: "นำเข้าโพลสำเร็จ" })
      }
    } catch (e: any) {
      setToast({ type: "err", text: e.message })
    } finally {
      setBusy(false)
    }
  }

  // Capture PNG or Copy Summary (All 3 areas)
  const handleCapturePNG = () => {
    const todayStr = new Date().toISOString().split("T")[0]
    const text = [
      `=== Bench Organizer Summary: ${eventName} ===`,
      `📅 วันที่: ${todayStr}`,
      ``,
      `[ 🎮 1. เข้าร่วม / ต้องการประมูล (${wantBidList.length} คน) ]`,
      wantBidList.length > 0
        ? wantBidList
            .map((m) => `• ${m.display_name} (Id: ${memberIdMap.get(m.id)})${m.job_class ? ` [${m.job_class}]` : ""}`)
            .join("\n")
        : "• (ไม่มี)",
      ``,
      `[ 📦 2. เข้าร่วม / ไม่ต้องการประมูล (${noBidList.length} คน) ]`,
      noBidList.length > 0
        ? noBidList
            .map((m) => `• ${m.display_name} (Id: ${memberIdMap.get(m.id)})${m.job_class ? ` [${m.job_class}]` : ""}`)
            .join("\n")
        : "• (ไม่มี)",
      ``,
      `[ ⛔ 3. ไม่ประสงค์เข้าร่วม (${absentList.length} คน) ]`,
      absentList.length > 0
        ? absentList
            .map((m) => `• ${m.display_name} (Id: ${memberIdMap.get(m.id)})${m.job_class ? ` [${m.job_class}]` : ""}`)
            .join("\n")
        : "• (ไม่มี)",
    ].join("\n")

    navigator.clipboard.writeText(text)
    setToast({
      type: "ok",
      text: "คัดลอกสรุปสถานะทั้ง 3 กลุ่มลง Clipboard เรียบร้อยแล้ว",
    })
  }

  // Proceed to Resource Pool (Upsert attendance for all members)
  const handleProceedToPool = async () => {
    setBusy(true)
    try {
      if (isAdmin) {
        const todayStr = new Date().toISOString().split("T")[0]
        const cleanName = eventName.split(":")[0]?.trim() || "Emperium Overrun"
        for (const m of initialMembers) {
          const st = statusMap.get(m.id) || "no_bid"
          await fetch("/api/queues", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "upsert_attendance",
              event_name: cleanName,
              event_date: todayStr,
              user_id: m.id,
              discord_id: m.discord_id,
              status: st,
              interested_items: st === "want_bid" ? ["Album", "Puppet", "White", "RedBlack"] : [],
            }),
          }).catch(() => {})
        }
      }
      router.push("/pool")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Bench Organizer
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            จัดคนเข้าร่วมวอร์ 3 กลุ่มตามโพล Discord: ต้องการประมูล, ไม่ต้องการประมูล (สำรอง/สะสมแต้ม), และไม่ประสงค์เข้าร่วม
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <button
            onClick={handleResetToNoBid}
            className="px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 transition-all cursor-pointer shadow-sm text-center"
          >
            รีเซ็ตเป็นไม่ประมูล
          </button>
          <button
            onClick={handleCapturePNG}
            className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 dark:bg-teal-700 dark:hover:bg-teal-600 text-white text-xs font-bold transition-all cursor-pointer shadow-sm text-center"
          >
            Copy Summary
          </button>
          <button
            onClick={handleProceedToPool}
            disabled={busy}
            className="col-span-2 sm:col-span-1 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-all cursor-pointer shadow-sm text-center"
          >
            {busy ? "กำลังบันทึก..." : "ส่งไป Resource Pool →"}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`px-4 py-3 rounded-lg text-xs font-medium border ${
            toast.type === "ok"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/60 text-rose-800 dark:text-rose-300"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Search & Discord Poll Import Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Search */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 sm:p-4 shadow-sm">
          <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
            SEARCH BENCH MEMBERS
          </label>
          <input
            type="text"
            placeholder="ค้นหาชื่อ, อาชีพ, Discord ID, หรือ ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-all"
          />
        </div>

        {/* Discord Message ID */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 sm:p-4 shadow-sm">
          <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
            DISCORD MESSAGE ID
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="ระบุ Message ID ของโพล"
              value={discordMessageId}
              onChange={(e) => setDiscordMessageId(e.target.value)}
              className="flex-1 bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono transition-all"
            />
            <button
              onClick={handleImportDiscordPoll}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer whitespace-nowrap shadow-sm disabled:opacity-50 text-center"
            >
              {busy ? "กำลังโหลด..." : "Import Discord Poll"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 gap-1">
        <button
          onClick={() => setMobileTab("want_bid")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            mobileTab === "want_bid"
              ? "bg-emerald-600 text-white dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/60 shadow-sm"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          ประมูล ({wantBidList.length})
        </button>
        <button
          onClick={() => setMobileTab("no_bid")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            mobileTab === "no_bid"
              ? "bg-amber-600 text-white dark:bg-amber-950 dark:text-amber-300 border border-amber-500/60 shadow-sm"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          ไม่ประมูล ({noBidList.length})
        </button>
        <button
          onClick={() => setMobileTab("absent")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            mobileTab === "absent"
              ? "bg-rose-600 text-white dark:bg-rose-950 dark:text-rose-300 border border-rose-500/60 shadow-sm"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          ไม่เข้าร่วม ({absentList.length})
        </button>
        <button
          onClick={() => setMobileTab("all")}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mobileTab === "all"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700"
              : "text-zinc-500"
          }`}
        >
          ทั้งหมด
        </button>
      </div>

      {/* 3 Column Bench Lists (Matching Discord 3 Options) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* COLUMN 1: เข้าร่วม / ต้องการประมูล (want_bid) */}
        <div
          className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4 ${
            mobileTab !== "all" && mobileTab !== "want_bid" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  เข้าร่วม / ต้องการประมูล
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-mono font-bold border border-emerald-300 dark:border-emerald-800/60">
                  {wantBidList.length}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">สมาชิกที่ต้องการขอรับไอเทมในการประมูล</p>
            </div>
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {wantBidList.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 dark:text-zinc-600 text-xs">
                ยังไม่มีสมาชิกในกลุ่มต้องการประมูล
              </div>
            ) : (
              wantBidList.map((m) => {
                const idNum = memberIdMap.get(m.id) || "-"
                return (
                  <div
                    key={m.id}
                    className="bg-emerald-50/80 dark:bg-zinc-800/90 border border-emerald-300 dark:border-emerald-700/60 rounded-xl p-3 transition-all shadow-sm flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-sm" />
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {m.display_name}
                        </span>
                        {m.job_class && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium border border-emerald-200 dark:border-emerald-800/40 shrink-0">
                            {JOB_EMOJIS[m.job_class] ? `${JOB_EMOJIS[m.job_class]} ` : ""}{m.job_class}
                          </span>
                        )}
                      </div>
                      <svg className={`w-3.5 h-3.5 shrink-0 ${m.discord_id ? "text-indigo-500 dark:text-indigo-400" : "text-zinc-300 dark:text-zinc-600"}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 dark:border-zinc-700/60 text-[11px]">
                      <span className="font-mono text-zinc-500 dark:text-zinc-400">Id: {idNum}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSetStatus(m.id, "no_bid")}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer"
                          title="ย้ายไปกลุ่มไม่ต้องการประมูล"
                        >
                          📦 ไม่ประมูล
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStatus(m.id, "absent")}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 transition-all cursor-pointer"
                          title="ย้ายไปกลุ่มไม่ประสงค์เข้าร่วม"
                        >
                          ⛔ ไม่มา
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* COLUMN 2: เข้าร่วม / ไม่ต้องการประมูล (no_bid) */}
        <div
          className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4 ${
            mobileTab !== "all" && mobileTab !== "no_bid" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  เข้าร่วม / ไม่ต้องการประมูล
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-mono font-bold border border-amber-300 dark:border-amber-800/60">
                  {noBidList.length}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">สมาชิกสำรอง / ช่วยวอร์ (สะสม Carry Credit)</p>
            </div>
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {noBidList.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 dark:text-zinc-600 text-xs">
                ไม่มีสมาชิกในกลุ่มนี้
              </div>
            ) : (
              noBidList.map((m) => {
                const idNum = memberIdMap.get(m.id) || "-"
                return (
                  <div
                    key={m.id}
                    className="bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl p-3 transition-all shadow-sm flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 shadow-sm" />
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {m.display_name}
                        </span>
                        {m.job_class && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 font-medium shrink-0">
                            {JOB_EMOJIS[m.job_class] ? `${JOB_EMOJIS[m.job_class]} ` : ""}{m.job_class}
                          </span>
                        )}
                      </div>
                      <svg className={`w-3.5 h-3.5 shrink-0 ${m.discord_id ? "text-indigo-500 dark:text-indigo-400" : "text-zinc-300 dark:text-zinc-600"}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-zinc-700/60 text-[11px]">
                      <span className="font-mono text-zinc-500 dark:text-zinc-400">Id: {idNum}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSetStatus(m.id, "want_bid")}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 transition-all cursor-pointer"
                          title="ย้ายไปกลุ่มต้องการประมูล"
                        >
                          🎮 ประมูล
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStatus(m.id, "absent")}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 transition-all cursor-pointer"
                          title="ย้ายไปกลุ่มไม่ประสงค์เข้าร่วม"
                        >
                          ⛔ ไม่มา
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* COLUMN 3: ไม่ประสงค์เข้าร่วม (absent) */}
        <div
          className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4 ${
            mobileTab !== "all" && mobileTab !== "absent" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  ไม่ประสงค์เข้าร่วม
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-xs font-mono font-bold border border-rose-300 dark:border-rose-800/60">
                  {absentList.length}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">สมาชิกที่ไม่สะดวกเข้าร่วมกิลด์วอร์รอบนี้</p>
            </div>
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {absentList.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 dark:text-zinc-600 text-xs">
                ไม่มีสมาชิกในกลุ่มไม่เข้าร่วม
              </div>
            ) : (
              absentList.map((m) => {
                const idNum = memberIdMap.get(m.id) || "-"
                return (
                  <div
                    key={m.id}
                    className="bg-rose-50/70 dark:bg-zinc-800/80 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3 transition-all shadow-sm flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-sm" />
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {m.display_name}
                        </span>
                        {m.job_class && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-medium border border-rose-200 dark:border-rose-800/40 shrink-0">
                            {JOB_EMOJIS[m.job_class] ? `${JOB_EMOJIS[m.job_class]} ` : ""}{m.job_class}
                          </span>
                        )}
                      </div>
                      <svg className={`w-3.5 h-3.5 shrink-0 ${m.discord_id ? "text-indigo-500 dark:text-indigo-400" : "text-zinc-300 dark:text-zinc-600"}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-rose-200/60 dark:border-zinc-700/60 text-[11px]">
                      <span className="font-mono text-zinc-500 dark:text-zinc-400">Id: {idNum}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSetStatus(m.id, "want_bid")}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 transition-all cursor-pointer"
                          title="ย้ายไปกลุ่มต้องการประมูล"
                        >
                          🎮 ประมูล
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStatus(m.id, "no_bid")}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer"
                          title="ย้ายไปกลุ่มไม่ต้องการประมูล"
                        >
                          📦 ไม่ประมูล
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
