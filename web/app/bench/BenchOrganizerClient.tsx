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

  // Map each member to an integer sequence ID based on DB sorting
  const memberIdMap = useMemo(() => {
    const map = new Map<string, number>()
    initialMembers.forEach((m, idx) => {
      map.set(m.id, idx + 1)
    })
    return map
  }, [initialMembers])

  // Initialize assigned IDs from database event_attendance or localStorage
  const [assignedIds, setAssignedIds] = useState<Set<string>>(() => {
    // 1. Check database attendance first
    const fromDb = new Set<string>()
    for (const a of initialAttendance) {
      if (a.status === "want_bid" && a.user_id) {
        fromDb.add(a.user_id)
      }
    }
    if (fromDb.size > 0) return fromDb

    // 2. Check localStorage
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("rooc_assigned_bench_ids")
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return new Set(parsed)
          }
        }
      } catch {}
    }

    return new Set<string>()
  })

  // Persist to localStorage whenever assignedIds changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("rooc_assigned_bench_ids", JSON.stringify(Array.from(assignedIds)))
        const assignedMembers = initialMembers.filter((m) => assignedIds.has(m.id))
        localStorage.setItem("rooc_assigned_bench_members", JSON.stringify(assignedMembers))
      } catch {}
    }
  }, [assignedIds, initialMembers])

  // Split into Assigned and Unassigned
  const { assignedList, unassignedList } = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    const filterFn = (m: Member) => {
      if (!q) return true
      const idNum = String(memberIdMap.get(m.id) || "")
      return (
        m.display_name.toLowerCase().includes(q) ||
        (m.discord_id && m.discord_id.toLowerCase().includes(q)) ||
        idNum.includes(q)
      )
    }

    const assigned: Member[] = []
    const unassigned: Member[] = []

    for (const m of initialMembers) {
      if (assignedIds.has(m.id)) {
        if (filterFn(m)) assigned.push(m)
      } else {
        if (filterFn(m)) unassigned.push(m)
      }
    }

    // Sort by member sequence ID
    assigned.sort((a, b) => (memberIdMap.get(a.id) || 0) - (memberIdMap.get(b.id) || 0))
    unassigned.sort((a, b) => (memberIdMap.get(a.id) || 0) - (memberIdMap.get(b.id) || 0))

    return { assignedList: assigned, unassignedList: unassigned }
  }, [initialMembers, assignedIds, searchTerm, memberIdMap])

  // Move member between benches
  const handleToggleMember = (id: string) => {
    setAssignedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Reset to unassigned
  const handleResetToUnassigned = () => {
    setAssignedIds(new Set())
    setToast({ type: "ok", text: "รีเซ็ตทุกคนกลับไปยัง Unassigned Bench แล้ว" })
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

      if (Array.isArray(data.assigned_members)) {
        const newAssigned = new Set<string>()
        data.assigned_members.forEach((m: any) => newAssigned.add(m.id))
        setAssignedIds(newAssigned)
        setToast({
          type: "ok",
          text: `นำเข้าโพลสำเร็จ: พบสมาชิกที่โหวต Want to bid จำนวน ${newAssigned.size} คน ย้ายเข้าสู่ Assigned Bench แล้ว`,
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

  // Capture PNG or Copy Summary
  const handleCapturePNG = () => {
    const text = [
      `=== Bench Organizer Summary: ${eventName} ===`,
      `[ Assigned Bench (${assignedIds.size} คน) ]`,
      initialMembers
        .filter((m) => assignedIds.has(m.id))
        .map((m) => `• ${m.display_name} (Id: ${memberIdMap.get(m.id)})`)
        .join("\n"),
      ``,
      `[ Unassigned Bench (${initialMembers.length - assignedIds.size} คน) ]`,
      initialMembers
        .filter((m) => !assignedIds.has(m.id))
        .map((m) => `• ${m.display_name} (Id: ${memberIdMap.get(m.id)})`)
        .join("\n"),
    ].join("\n")

    navigator.clipboard.writeText(text)
    setToast({
      type: "ok",
      text: "คัดลอกสรุป Bench ลง Clipboard เรียบร้อยแล้ว (สามารถนำไปวางใน Discord ได้ทันที)",
    })
  }

  // Proceed to Resource Pool
  const handleProceedToPool = async () => {
    setBusy(true)
    try {
      // Sync assigned bench to Supabase event_attendance if admin
      if (isAdmin && assignedIds.size > 0) {
        const todayStr = new Date().toISOString().split("T")[0]
        const cleanName = eventName.split(":")[0]?.trim() || "Guild League"
        for (const m of initialMembers) {
          const isWantBid = assignedIds.has(m.id)
          await fetch("/api/queues", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "upsert_attendance",
              event_name: cleanName,
              event_date: todayStr,
              user_id: m.id,
              discord_id: m.discord_id,
              status: isWantBid ? "want_bid" : "no_bid",
              interested_items: ["Album", "Puppet", "White", "RedBlack"],
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
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Bench Organizer</h1>
          <p className="text-xs text-zinc-500 mt-1">
            จัดคนเข้าร่วมกิลด์วอร์ (Assigned Bench) และคนสำรอง (Unassigned Bench) ดึงข้อมูลจากฐานข้อมูลและ Discord Poll
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleResetToUnassigned}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer shadow-sm"
          >
            Reset to Unassigned Bench
          </button>
          <button
            onClick={handleCapturePNG}
            className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            Capture PNG
          </button>
          <button
            onClick={handleProceedToPool}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            {busy ? "กำลังบันทึก..." : "ส่งต่อไป Resource Pool →"}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`px-4 py-3 rounded-lg text-xs font-medium border ${
            toast.type === "ok"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Search & Discord Poll Import Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
            SEARCH BENCH MEMBERS
          </label>
          <input
            type="text"
            placeholder="Search by ID, name, or Discord ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-all"
          />
        </div>

        {/* Discord Message ID */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
            DISCORD MESSAGE ID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ระบุ Message ID ของโพลจาก Discord"
              value={discordMessageId}
              onChange={(e) => setDiscordMessageId(e.target.value)}
              className="flex-1 bg-zinc-800/80 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono transition-all"
            />
            <button
              onClick={handleImportDiscordPoll}
              disabled={busy}
              className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700 hover:border-zinc-600 transition-all cursor-pointer whitespace-nowrap shadow-sm disabled:opacity-50"
            >
              {busy ? "กำลังโหลด..." : "Import Discord Poll"}
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Bench Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* UNASSIGNED BENCH Column */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                UNASSIGNED BENCH
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-mono font-bold border border-zinc-700">
                {unassignedList.length}
              </span>
            </div>
            <span className="text-[11px] text-zinc-600">คลิกที่การ์ดเพื่อย้ายไป Assigned</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[620px] overflow-y-auto pr-1">
            {unassignedList.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-zinc-600 text-xs">
                ไม่มีสมาชิกใน Unassigned Bench
              </div>
            ) : (
              unassignedList.map((m) => {
                const idNum = memberIdMap.get(m.id) || "-"
                return (
                  <div
                    key={m.id}
                    onClick={() => handleToggleMember(m.id)}
                    className="group bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/70 hover:border-zinc-500 rounded-xl p-3 cursor-pointer transition-all shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-xs text-zinc-100 truncate group-hover:text-white">
                        {m.display_name}
                      </span>
                      <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span>Id: {idNum}</span>
                      <span className="text-[10px] text-zinc-600 group-hover:text-emerald-400">
                        + Assign
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ASSIGNED BENCH Column */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                ASSIGNED BENCH
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-xs font-mono font-bold border border-emerald-800/60">
                {assignedList.length}
              </span>
            </div>
            <span className="text-[11px] text-zinc-600">คลิกที่การ์ดเพื่อย้ายออก</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[620px] overflow-y-auto pr-1">
            {assignedList.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-zinc-600 text-xs">
                ยังไม่มีสมาชิกใน Assigned Bench (กด Import Discord Poll หรือคลิกสมาชิกจากฝั่งซ้าย)
              </div>
            ) : (
              assignedList.map((m) => {
                const idNum = memberIdMap.get(m.id) || "-"
                return (
                  <div
                    key={m.id}
                    onClick={() => handleToggleMember(m.id)}
                    className="group bg-zinc-800/90 hover:bg-zinc-800 border border-emerald-800/50 hover:border-rose-700/60 rounded-xl p-3 cursor-pointer transition-all shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-xs text-zinc-100 truncate group-hover:text-white">
                        {m.display_name}
                      </span>
                      <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span>Id: {idNum}</span>
                      <span className="text-[10px] text-zinc-600 group-hover:text-rose-400">
                        - Remove
                      </span>
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
