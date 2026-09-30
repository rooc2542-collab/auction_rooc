"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"

export const JOB_CLASSES = [
  "Lord Knight", "Paladin", "Biochemist", "Mastersmith", "Bard",
  "Gypsy", "Sniper", "Champion", "Priest", "Assassin",
  "Rogue", "Wizard", "Sage", "Summoner", "Rebellion"
]

export const JOB_EMOJI: Record<string, string> = {}

type ItemKey = "Album" | "Puppet" | "White" | "RedBlack"

const ITEM_DISPLAY_NAMES: Record<ItemKey, string> = {
  Album: "Card Fragment",
  Puppet: "Illusion Card",
  White: "Light-Dark",
  RedBlack: "Time-Space",
}

interface Member {
  id: string
  display_name: string
  discord_id: string
  job_class: string | null
  role: "admin" | "member"
  created_at: string
}

interface MemberTableProps {
  members: Member[]
  slots?: Array<{ user_id: string; item_type: string; status: string }>
  credits?: Array<{ user_id: string; item_type: string; credit: number }>
  attendance?: Array<{ user_id: string; status: string; interested_items?: string[] }>
  isAdmin: boolean
}

export default function MemberTable({
  members,
  slots = [],
  credits = [],
  attendance = [],
  isAdmin,
}: MemberTableProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"items" | "profile">("items")
  const [mobileDisplay, setMobileDisplay] = useState<"cards" | "table">("cards")
  const [search, setSearch] = useState("")
  const [filterJob, setFilterJob] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({ display_name: "", discord_id: "", job_class: "", role: "member" })
  const [saving, setSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("")

  // Load last synced time from localStorage or current time on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rooc_members_last_synced")
      if (saved) {
        setLastSyncedTime(saved)
      } else {
        const timeStr = new Date().toTimeString().split(" ")[0]
        setLastSyncedTime(timeStr)
        localStorage.setItem("rooc_members_last_synced", timeStr)
      }
    } catch {
      const timeStr = new Date().toTimeString().split(" ")[0]
      setLastSyncedTime(timeStr)
    }
  }, [])

  // Filter members by search query and dropdowns
  const filtered = useMemo(() => {
    return members.filter((m) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        m.display_name?.toLowerCase().includes(q) ||
        m.discord_id?.toLowerCase().includes(q)
      const matchJob = !filterJob || m.job_class === filterJob
      const matchRole = !filterRole || m.role === filterRole
      return matchSearch && matchJob && matchRole
    })
  }, [members, search, filterJob, filterRole])

  // Aggregate stats per member per item type dynamically from DB
  const memberItemStats = useMemo(() => {
    const map = new Map<string, Record<ItemKey, { alloc: number; skip: number }>>()

    for (const m of members) {
      map.set(m.id, {
        Album: { alloc: 0, skip: 0 },
        Puppet: { alloc: 0, skip: 0 },
        White: { alloc: 0, skip: 0 },
        RedBlack: { alloc: 0, skip: 0 },
      })
    }

    // 1. Calculate Allocated count from allocated_slots
    for (const s of slots) {
      if (!s.user_id || !map.has(s.user_id)) continue
      const userStat = map.get(s.user_id)!
      const it = s.item_type as ItemKey
      if (userStat[it]) {
        userStat[it].alloc += 1
      }
    }

    // 2. Calculate Skipped count from carry_credits / attendance
    for (const c of credits) {
      if (!c.user_id || !map.has(c.user_id)) continue
      const userStat = map.get(c.user_id)!
      const it = c.item_type as ItemKey
      if (userStat[it]) {
        userStat[it].skip += c.credit || 0
      }
    }

    // Count no_bid / absent attendance as skipped
    for (const a of attendance) {
      if (!a.user_id || !map.has(a.user_id)) continue
      if (a.status === "no_bid" || a.status === "absent") {
        const userStat = map.get(a.user_id)!
        const items =
          Array.isArray(a.interested_items) && a.interested_items.length > 0
            ? (a.interested_items as ItemKey[])
            : (["Album", "Puppet", "White", "RedBlack"] as ItemKey[])
        for (const it of items) {
          if (userStat[it]) {
            userStat[it].skip += 1
          }
        }
      }
    }

    return map
  }, [members, slots, credits, attendance])

  // Total allocated per item type for column headers
  const columnTotals = useMemo(() => {
    const totals: Record<ItemKey, number> = { Album: 0, Puppet: 0, White: 0, RedBlack: 0 }
    for (const s of slots) {
      const it = s.item_type as ItemKey
      if (totals[it] !== undefined) totals[it] += 1
    }
    return totals
  }, [slots])

  function handleSync() {
    setIsSyncing(true)
    const now = new Date()
    const timeStr = now.toTimeString().split(" ")[0]
    setLastSyncedTime(timeStr)
    try {
      localStorage.setItem("rooc_members_last_synced", timeStr)
    } catch {}
    router.refresh()
    setMessage({ type: "success", text: `ซิงค์ข้อมูลกับฐานข้อมูลเรียบร้อย ณ เวลา ${timeStr}` })
    setTimeout(() => setMessage(null), 3000)
    setTimeout(() => setIsSyncing(false), 600)
  }

  function openAdd() {
    setEditMember(null)
    setEditForm({ display_name: "", discord_id: "", job_class: "Lord Knight", role: "member" })
    setMessage(null)
    setIsAddModalOpen(true)
  }

  function openEdit(m: Member) {
    setIsAddModalOpen(false)
    setEditMember(m)
    setEditForm({
      display_name: m.display_name || "",
      discord_id: m.discord_id || "",
      job_class: m.job_class || "",
      role: m.role || "member",
    })
    setMessage(null)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      if (isAddModalOpen) {
        const res = await fetch("/api/members/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด")
        setMessage({ type: "success", text: "เพิ่มสมาชิกสำเร็จ" })
        setTimeout(() => { setIsAddModalOpen(false); window.location.reload() }, 1000)
      } else if (editMember) {
        const res = await fetch("/api/members/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editMember.id, ...editForm }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด")
        setMessage({ type: "success", text: "อัปเดตข้อมูลสำเร็จ" })
        setTimeout(() => { setEditMember(null); window.location.reload() }, 1000)
      }
    } catch (e: any) {
      setMessage({ type: "error", text: `${e.message}` })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`ลบสมาชิก "${name}" ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return
    try {
      const res = await fetch(`/api/members/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("ลบไม่สำเร็จ")
      window.location.reload()
    } catch (e: any) {
      alert(`${e.message}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header Controls (Image 6 UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* View Mode Toggle: Grid on mobile */}
        <div className="grid grid-cols-2 sm:flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          <button
            onClick={() => setViewMode("items")}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              viewMode === "items"
                ? "bg-zinc-100 text-zinc-900 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            ตารางไอเทม (Alloc &amp; Skip)
          </button>
          <button
            onClick={() => setViewMode("profile")}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              viewMode === "profile"
                ? "bg-zinc-100 text-zinc-900 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            จัดการโปรไฟล์ &amp; อาชีพ
          </button>
        </div>

        {/* Sync Indicator & Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
          <span className="text-[11px] sm:text-xs text-zinc-500 font-mono">
            Synced: {lastSyncedTime || "--:--:--"}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSyncing ? "Syncing..." : "Sync"}
            </button>
            {isAdmin && (
              <button
                onClick={openAdd}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold transition-all cursor-pointer shadow-sm whitespace-nowrap"
              >
                + เพิ่มสมาชิก
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Message alert */}
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-xs font-medium border ${
            message.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Search Bar & Mobile Layout Toggle */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <input
          type="text"
          placeholder="ค้นหาชื่อตัวละคร หรือ Discord ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-44 bg-zinc-800/80 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-all"
        />

        {viewMode === "profile" && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filterJob}
              onChange={(e) => setFilterJob(e.target.value)}
              className="flex-1 sm:flex-initial bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-100 focus:outline-none"
            >
              <option value="">ทุกอาชีพ (15 อาชีพ)</option>
              {JOB_CLASSES.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="flex-1 sm:flex-initial bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-100 focus:outline-none"
            >
              <option value="">ทุกสิทธิ์ (Role)</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </div>
        )}

        {/* Mobile Display Switcher for Items View (Card vs Table) */}
        {viewMode === "items" && (
          <div className="sm:hidden flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setMobileDisplay("cards")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                mobileDisplay === "cards"
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              การ์ด
            </button>
            <button
              onClick={() => setMobileDisplay("table")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                mobileDisplay === "table"
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              ตาราง
            </button>
          </div>
        )}

        <div className="text-xs font-medium text-zinc-500 font-mono">
          พบ {filtered.length} คน
        </div>
      </div>

      {/* ─── VIEW 1: Allocation & Skipped Items (Image 6 UI) ─── */}
      {viewMode === "items" && (
        <div>
          {/* Mobile Cards View (Visible on small screens if selected) */}
          <div className={`sm:hidden space-y-2.5 ${mobileDisplay === "cards" ? "block" : "hidden"}`}>
            {filtered.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-10 text-center text-zinc-600 text-xs">
                ไม่พบสมาชิกที่ตรงกับการค้นหา
              </div>
            ) : (
              filtered.map((m, idx) => {
                const stats = memberItemStats.get(m.id) || {
                  Album: { alloc: 0, skip: 0 },
                  Puppet: { alloc: 0, skip: 0 },
                  White: { alloc: 0, skip: 0 },
                  RedBlack: { alloc: 0, skip: 0 },
                }

                return (
                  <div
                    key={m.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-zinc-500 font-bold text-xs shrink-0">#{idx + 1}</span>
                        <span className="font-bold text-sm text-zinc-100 truncate">{m.display_name}</span>
                        {m.job_class && (
                          <span className="text-[10px] text-zinc-500 shrink-0">({m.job_class})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-zinc-400">
                          {m.discord_id ? m.discord_id.slice(-6) : "-"}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => openEdit(m)}
                            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium border border-zinc-700 cursor-pointer shrink-0"
                          >
                            แก้ไข
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4 Items Grid */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-zinc-800/80 text-center">
                      {(["Album", "Puppet", "White", "RedBlack"] as ItemKey[]).map((it) => (
                        <div key={it} className="bg-zinc-800/60 rounded-lg p-2 border border-zinc-700/40">
                          <div className="text-[9px] text-zinc-400 truncate mb-0.5">
                            {ITEM_DISPLAY_NAMES[it]}
                          </div>
                          <div className="font-bold text-zinc-100 text-sm font-mono">
                            {stats[it].alloc}
                          </div>
                          <div className="text-[9px] text-amber-500 font-medium">
                            Skip: {stats[it].skip}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop & Mobile Table View */}
          <div
            className={`bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-sm ${
              mobileDisplay === "cards" ? "hidden sm:block" : "block"
            }`}
          >
            {/* Scroll Hint on Mobile */}
            <div className="sm:hidden px-3.5 py-1.5 bg-zinc-800/40 text-[10px] text-zinc-400 flex items-center justify-between border-b border-zinc-800">
              <span>เลื่อนซ้าย-ขวาเพื่อดูไอเทมทั้งหมด</span>
              <span>👉</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="px-3.5 sm:px-4 py-3.5 w-12 sticky left-0 z-10 bg-zinc-950">#</th>
                    <th className="px-3.5 sm:px-4 py-3.5 sticky left-12 z-10 bg-zinc-950 border-r border-zinc-800/60">
                      Name
                    </th>
                    <th className="px-4 py-3.5">Discord ID</th>
                    <th className="px-4 py-3.5 text-center">
                      Card Fragments ({columnTotals.Album})
                    </th>
                    <th className="px-4 py-3.5 text-center">
                      Illusion Cards ({columnTotals.Puppet})
                    </th>
                    <th className="px-4 py-3.5 text-center">
                      Light-Dark Feathers ({columnTotals.White})
                    </th>
                    <th className="px-4 py-3.5 text-center">
                      Time-Space Feathers ({columnTotals.RedBlack})
                    </th>
                    {isAdmin && <th className="px-4 py-3.5 text-right">จัดการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-zinc-600 py-12 text-xs">
                        ไม่พบสมาชิกที่ตรงกับการค้นหา
                      </td>
                    </tr>
                  ) : (
                    filtered.map((m, idx) => {
                      const stats = memberItemStats.get(m.id) || {
                        Album: { alloc: 0, skip: 0 },
                        Puppet: { alloc: 0, skip: 0 },
                        White: { alloc: 0, skip: 0 },
                        RedBlack: { alloc: 0, skip: 0 },
                      }

                      return (
                        <tr key={m.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-3.5 sm:px-4 py-3.5 font-mono text-zinc-500 font-bold sticky left-0 z-10 bg-zinc-900">
                            {idx + 1}
                          </td>
                          <td className="px-3.5 sm:px-4 py-3.5 sticky left-12 z-10 bg-zinc-900 border-r border-zinc-800/60">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-semibold text-zinc-100 whitespace-nowrap">
                                  {m.display_name}
                                </div>
                                {m.job_class && (
                                  <div className="text-[10px] text-zinc-500">{m.job_class}</div>
                                )}
                              </div>
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border shrink-0 ${
                                m.role === "admin"
                                  ? "bg-purple-950 text-purple-300 border-purple-800/60"
                                  : "bg-zinc-800 text-zinc-500 border-zinc-700"
                              }`}>
                                {m.role}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-zinc-400">
                            {m.discord_id || "-"}
                          </td>
                          {/* Card Fragments */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="font-bold text-zinc-100 text-sm font-mono">
                              {stats.Album.alloc}
                            </div>
                            <div className="text-[10px] text-amber-500/90 font-medium">
                              Skipped: {stats.Album.skip}
                            </div>
                          </td>
                          {/* Illusion Cards */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="font-bold text-zinc-100 text-sm font-mono">
                              {stats.Puppet.alloc}
                            </div>
                            <div className="text-[10px] text-amber-500/90 font-medium">
                              Skipped: {stats.Puppet.skip}
                            </div>
                          </td>
                          {/* Light-Dark Feathers */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="font-bold text-zinc-100 text-sm font-mono">
                              {stats.White.alloc}
                            </div>
                            <div className="text-[10px] text-amber-500/90 font-medium">
                              Skipped: {stats.White.skip}
                            </div>
                          </td>
                          {/* Time-Space Feathers */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="font-bold text-zinc-100 text-sm font-mono">
                              {stats.RedBlack.alloc}
                            </div>
                            <div className="text-[10px] text-amber-500/90 font-medium">
                              Skipped: {stats.RedBlack.skip}
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => openEdit(m)}
                                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium border border-zinc-700 cursor-pointer whitespace-nowrap"
                              >
                                แก้ไข
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── VIEW 2: Profile & Role Management Table ──────────────── */}
      {viewMode === "profile" && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[550px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3.5">ชื่อตัวละคร</th>
                  <th className="px-4 py-3.5">Discord ID</th>
                  <th className="px-4 py-3.5">อาชีพ</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">วันที่สมัคร</th>
                  {isAdmin && <th className="px-4 py-3.5 text-right">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3.5 font-semibold text-zinc-100 whitespace-nowrap">
                      {m.display_name}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-400">
                      {m.discord_id || "-"}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-300">
                      {m.job_class || "ไม่ระบุ"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        m.role === "admin"
                          ? "bg-purple-950 text-purple-300 border-purple-800/60"
                          : "bg-zinc-800 text-zinc-400 border-zinc-700"
                      }`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-500 text-[11px]">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString("th-TH") : "-"}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openEdit(m)}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium border border-zinc-700 cursor-pointer"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.display_name)}
                          className="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-[11px] font-medium border border-rose-800/60 cursor-pointer"
                        >
                          ลบ
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Profile Modal */}
      {(isAddModalOpen || editMember) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-zinc-100">
                  {isAddModalOpen ? "เพิ่มสมาชิกใหม่" : `แก้ไขข้อมูล`}
                </h3>
                {editMember && (
                  <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                    {editMember.display_name}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      editMember.role === "admin"
                        ? "bg-purple-950 text-purple-300 border-purple-800/60"
                        : "bg-zinc-800 text-zinc-500 border-zinc-700"
                    }`}>
                      {editMember.role}
                    </span>
                  </p>
                )}
              </div>
              <button
                onClick={() => { setIsAddModalOpen(false); setEditMember(null) }}
                className="text-zinc-500 hover:text-zinc-300 text-lg leading-none cursor-pointer shrink-0"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">ชื่อที่แสดงในระบบ</label>
                <input
                  type="text"
                  value={editForm.display_name}
                  onChange={(e) => setEditForm((p) => ({ ...p, display_name: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Discord ID (ตัวเลข)</label>
                <input
                  type="text"
                  value={editForm.discord_id}
                  onChange={(e) => setEditForm((p) => ({ ...p, discord_id: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Job Class & Role side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">อาชีพ</label>
                  <select
                    value={editForm.job_class}
                    onChange={(e) => setEditForm((p) => ({ ...p, job_class: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="">ไม่ระบุ</option>
                    {JOB_CLASSES.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">สิทธิ์ (Role)</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as any }))}
                    className={`w-full bg-zinc-800 border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-zinc-500 ${
                      editForm.role === "admin"
                        ? "text-purple-300 border-purple-800/60"
                        : "text-zinc-100 border-zinc-700"
                    }`}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* Preview badge */}
              {editForm.role && (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>ตัวอย่าง Role:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    editForm.role === "admin"
                      ? "bg-purple-950 text-purple-300 border-purple-800/60"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}>
                    {editForm.role}
                  </span>
                </div>
              )}
            </div>

            {message && (
              <div className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                message.type === "success"
                  ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                  : "bg-rose-950/40 border-rose-800/60 text-rose-300"
              }`}>
                {message.text}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setIsAddModalOpen(false); setEditMember(null) }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editForm.display_name.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
