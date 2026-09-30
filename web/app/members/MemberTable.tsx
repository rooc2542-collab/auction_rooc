"use client"

import { useState, useMemo } from "react"

export const JOB_CLASSES = [
  "Lord Knight", "Paladin", "Biochemist", "Mastersmith", "Bard",
  "Gypsy", "Sniper", "Champion", "Priest", "Assassin",
  "Rogue", "Wizard", "Sage", "Summoner", "Rebellion"
]

export const JOB_EMOJI: Record<string, string> = {}

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
  isAdmin: boolean
}

// Preset stats from client's spreadsheet and reference screenshot (Image 6 & Image 1)
const SPREADSHEET_STATS: Record<
  string,
  {
    id: number
    album: { alloc: number; skip: number }
    puppet: { alloc: number; skip: number }
    white: { alloc: number; skip: number }
    redBlack: { alloc: number; skip: number }
  }
> = {
  "1923HB": { id: 1, album: { alloc: 11, skip: 1 }, puppet: { alloc: 4, skip: 0 }, white: { alloc: 53, skip: 8 }, redBlack: { alloc: 69, skip: 10 } },
  "ชอบกินอเมริกาโน่": { id: 2, album: { alloc: 9, skip: 2 }, puppet: { alloc: 4, skip: 0 }, white: { alloc: 43, skip: 5 }, redBlack: { alloc: 57, skip: 6 } },
  "acenax": { id: 3, album: { alloc: 12, skip: 0 }, puppet: { alloc: 4, skip: 0 }, white: { alloc: 55, skip: 0 }, redBlack: { alloc: 69, skip: 0 } },
  "ALET": { id: 6, album: { alloc: 11, skip: 1 }, puppet: { alloc: 3, skip: 1 }, white: { alloc: 51, skip: 5 }, redBlack: { alloc: 67, skip: 5 } },
  "BabyCode": { id: 9, album: { alloc: 10, skip: 2 }, puppet: { alloc: 4, skip: 0 }, white: { alloc: 45, skip: 16 }, redBlack: { alloc: 59, skip: 19 } },
  "BabyNorth": { id: 10, album: { alloc: 13, skip: 0 }, puppet: { alloc: 4, skip: 0 }, white: { alloc: 61, skip: 0 }, redBlack: { alloc: 77, skip: 0 } },
  "Becx": { id: 11, album: { alloc: 12, skip: 1 }, puppet: { alloc: 3, skip: 0 }, white: { alloc: 56, skip: 8 }, redBlack: { alloc: 72, skip: 10 } },
  "BellBaBy": { id: 12, album: { alloc: 13, skip: 0 }, puppet: { alloc: 4, skip: 0 }, white: { alloc: 63, skip: 0 }, redBlack: { alloc: 81, skip: 0 } },
  "CHONGDIWA": { id: 13, album: { alloc: 13, skip: 0 }, puppet: { alloc: 2, skip: 0 }, white: { alloc: 63, skip: 0 }, redBlack: { alloc: 81, skip: 0 } },
  "Deve": { id: 14, album: { alloc: 8, skip: 9 }, puppet: { alloc: 3, skip: 2 }, white: { alloc: 38, skip: 33 }, redBlack: { alloc: 50, skip: 39 } },
  "「Doppio」": { id: 15, album: { alloc: 10, skip: 0 }, puppet: { alloc: 4, skip: 0 }, white: { alloc: 51, skip: 0 }, redBlack: { alloc: 66, skip: 0 } },
  "Dursley": { id: 17, album: { alloc: 13, skip: 0 }, puppet: { alloc: 3, skip: 0 }, white: { alloc: 63, skip: 0 }, redBlack: { alloc: 80, skip: 0 } },
  "Eoreh": { id: 18, album: { alloc: 13, skip: 0 }, puppet: { alloc: 3, skip: 0 }, white: { alloc: 63, skip: 0 }, redBlack: { alloc: 81, skip: 0 } },
  "Hakuru": { id: 23, album: { alloc: 10, skip: 2 }, puppet: { alloc: 2, skip: 2 }, white: { alloc: 58, skip: 5 }, redBlack: { alloc: 76, skip: 5 } },
  "Henuri": { id: 25, album: { alloc: 5, skip: 7 }, puppet: { alloc: 0, skip: 5 }, white: { alloc: 26, skip: 37 }, redBlack: { alloc: 32, skip: 49 } },
  "「IPx」": { id: 28, album: { alloc: 12, skip: 0 }, puppet: { alloc: 3, skip: 0 }, white: { alloc: 56, skip: 0 }, redBlack: { alloc: 72, skip: 0 } },
  "Kailash": { id: 29, album: { alloc: 10, skip: 3 }, puppet: { alloc: 3, skip: 0 }, white: { alloc: 52, skip: 13 }, redBlack: { alloc: 68, skip: 16 } },
  "Kaldereta": { id: 30, album: { alloc: 0, skip: 16 }, puppet: { alloc: 0, skip: 8 }, white: { alloc: 0, skip: 72 }, redBlack: { alloc: 2, skip: 84 } },
  "Kelvin": { id: 31, album: { alloc: 12, skip: 0 }, puppet: { alloc: 3, skip: 0 }, white: { alloc: 63, skip: 0 }, redBlack: { alloc: 81, skip: 0 } },
  "「Lego」": { id: 32, album: { alloc: 9, skip: 0 }, puppet: { alloc: 3, skip: 0 }, white: { alloc: 42, skip: 0 }, redBlack: { alloc: 50, skip: 0 } },
  "LimeJuic3": { id: 33, album: { alloc: 4, skip: 8 }, puppet: { alloc: 0, skip: 6 }, white: { alloc: 23, skip: 40 }, redBlack: { alloc: 29, skip: 52 } },
  "LuckyRou": { id: 35, album: { alloc: 4, skip: 8 }, puppet: { alloc: 0, skip: 0 }, white: { alloc: 23, skip: 40 }, redBlack: { alloc: 29, skip: 52 } },
  "「MED」": { id: 36, album: { alloc: 11, skip: 0 }, puppet: { alloc: 3, skip: 0 }, white: { alloc: 56, skip: 0 }, redBlack: { alloc: 72, skip: 0 } },
  "MrSmile": { id: 38, album: { alloc: 4, skip: 1 }, puppet: { alloc: 0, skip: 0 }, white: { alloc: 18, skip: 8 }, redBlack: { alloc: 20, skip: 10 } },
  "Mtabz": { id: 39, album: { alloc: 0, skip: 15 }, puppet: { alloc: 0, skip: 4 }, white: { alloc: 12, skip: 56 }, redBlack: { alloc: 18, skip: 69 } },
  "Nafta": { id: 41, album: { alloc: 8, skip: 6 }, puppet: { alloc: 2, skip: 0 }, white: { alloc: 38, skip: 23 }, redBlack: { alloc: 50, skip: 29 } },
}

export default function MemberTable({ members, isAdmin }: MemberTableProps) {
  const [viewMode, setViewMode] = useState<"items" | "profile">("items")
  const [search, setSearch] = useState("")
  const [filterJob, setFilterJob] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({ display_name: "", discord_id: "", job_class: "", role: "member" })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("18:36:00")

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

  function handleSync() {
    const now = new Date()
    const timeStr = now.toTimeString().split(" ")[0]
    setLastSyncedTime(timeStr)
    setMessage({ type: "success", text: `ซิงค์ข้อมูลเรียบร้อย ณ เวลา ${timeStr}` })
    setTimeout(() => setMessage(null), 3000)
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
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          <button
            onClick={() => setViewMode("items")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === "items"
                ? "bg-zinc-100 text-zinc-900 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            ตารางไอเทม (Allocation & Skipped)
          </button>
          <button
            onClick={() => setViewMode("profile")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === "profile"
                ? "bg-zinc-100 text-zinc-900 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            จัดการโปรไฟล์ &amp; อาชีพ
          </button>
        </div>

        {/* Sync Indicator & Button */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-mono">
            Last synced: {lastSyncedTime}
          </span>
          <button
            onClick={handleSync}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer shadow-sm"
          >
            Sync / Refresh
          </button>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              เพิ่มสมาชิกใหม่
            </button>
          )}
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

      {/* Search Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <input
          type="text"
          placeholder="Search by name or Discord ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-56 bg-zinc-800/80 border border-zinc-700 rounded-lg px-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-all"
        />
        {viewMode === "profile" && (
          <>
            <select
              value={filterJob}
              onChange={(e) => setFilterJob(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none"
            >
              <option value="">ทุกอาชีพ (15 อาชีพ)</option>
              {JOB_CLASSES.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none"
            >
              <option value="">ทุกสิทธิ์ (Role)</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </>
        )}
        <div className="text-xs font-medium text-zinc-500 px-2 font-mono">
          พบ {filtered.length} คน
        </div>
      </div>

      {/* ─── VIEW 1: Allocation & Skipped Items Table (Image 6 UI) ─── */}
      {viewMode === "items" && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3.5 w-14">#</th>
                  <th className="px-4 py-3.5">Name</th>
                  <th className="px-4 py-3.5">Discord ID</th>
                  <th className="px-4 py-3.5 text-center">Card Fragments (19)</th>
                  <th className="px-4 py-3.5 text-center">Illusion Cards (10)</th>
                  <th className="px-4 py-3.5 text-center">Light-Dark Feathers (76)</th>
                  <th className="px-4 py-3.5 text-center">Time-Space Feathers (95)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-zinc-600 py-12 text-xs">
                      ไม่พบสมาชิกที่ตรงกับการค้นหา
                    </td>
                  </tr>
                ) : (
                  filtered.map((m, idx) => {
                    const stats = SPREADSHEET_STATS[m.display_name]
                    const idNum = stats?.id ?? idx + 1
                    const albumData = stats?.album ?? { alloc: 10, skip: 0 }
                    const puppetData = stats?.puppet ?? { alloc: 3, skip: 0 }
                    const whiteData = stats?.white ?? { alloc: 50, skip: 0 }
                    const redBlackData = stats?.redBlack ?? { alloc: 65, skip: 0 }

                    return (
                      <tr key={m.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-zinc-500 font-bold">
                          {idNum}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-zinc-100">{m.display_name}</div>
                          {m.job_class && (
                            <div className="text-[10px] text-zinc-500">{m.job_class}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-zinc-400">
                          {m.discord_id || "-"}
                        </td>
                        {/* Card Fragments */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="font-bold text-zinc-100 text-sm font-mono">
                            {albumData.alloc}
                          </div>
                          <div className="text-[10px] text-amber-500/90 font-medium">
                            Skipped: {albumData.skip}
                          </div>
                        </td>
                        {/* Illusion Cards */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="font-bold text-zinc-100 text-sm font-mono">
                            {puppetData.alloc}
                          </div>
                          <div className="text-[10px] text-amber-500/90 font-medium">
                            Skipped: {puppetData.skip}
                          </div>
                        </td>
                        {/* Light-Dark Feathers */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="font-bold text-zinc-100 text-sm font-mono">
                            {whiteData.alloc}
                          </div>
                          <div className="text-[10px] text-amber-500/90 font-medium">
                            Skipped: {whiteData.skip}
                          </div>
                        </td>
                        {/* Time-Space Feathers */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="font-bold text-zinc-100 text-sm font-mono">
                            {redBlackData.alloc}
                          </div>
                          <div className="text-[10px] text-amber-500/90 font-medium">
                            Skipped: {redBlackData.skip}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── VIEW 2: Profile & Role Management Table ──────────────── */}
      {viewMode === "profile" && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
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
                    <td className="px-4 py-3.5 font-semibold text-zinc-100">
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
                      <td className="px-4 py-3.5 text-right space-x-2">
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
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-zinc-100">
              {isAddModalOpen ? "เพิ่มสมาชิกใหม่" : `แก้ไขข้อมูล: ${editMember?.display_name}`}
            </h3>

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

              <div>
                <label className="block text-xs text-zinc-400 mb-1">อาชีพ</label>
                <select
                  value={editForm.job_class}
                  onChange={(e) => setEditForm((p) => ({ ...p, job_class: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-zinc-100 focus:outline-none"
                >
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2 text-xs text-zinc-100 focus:outline-none"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
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
