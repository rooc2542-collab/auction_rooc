"use client"

import { useState } from "react"

export const JOB_CLASSES = [
  "Lord Knight", "Paladin", "Biochemist", "Mastersmith", "Bard",
  "Gypsy", "Sniper", "Champion", "Priest", "Assassin",
  "Rogue", "Wizard", "Sage", "Summoner", "Rebellion"
]

export const JOB_EMOJI: Record<string, string> = {
  "Lord Knight": "⚔️", "Paladin": "🛡️", "Biochemist": "🧪", "Mastersmith": "🔨",
  "Bard": "🎵", "Gypsy": "💃", "Sniper": "🏹", "Champion": "👊",
  "Priest": "✝️", "Assassin": "🗡️", "Rogue": "🎭", "Wizard": "🔮",
  "Sage": "📖", "Summoner": "🌟", "Rebellion": "🔫"
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
  isAdmin: boolean
}

export default function MemberTable({ members, isAdmin }: MemberTableProps) {
  const [search, setSearch] = useState("")
  const [filterJob, setFilterJob] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({ display_name: "", discord_id: "", job_class: "", role: "member" })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const filtered = members.filter((m) => {
    const q = search.toLowerCase()
    const matchSearch = !q || m.display_name?.toLowerCase().includes(q) ||
      m.discord_id?.toLowerCase().includes(q)
    const matchJob = !filterJob || m.job_class === filterJob
    const matchRole = !filterRole || m.role === filterRole
    return matchSearch && matchJob && matchRole
  })

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
        setMessage({ type: "success", text: "✅ เพิ่มสมาชิกสำเร็จ!" })
        setTimeout(() => { setIsAddModalOpen(false); window.location.reload() }, 1000)
      } else if (editMember) {
        const res = await fetch("/api/members/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editMember.id, ...editForm }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด")
        setMessage({ type: "success", text: "✅ อัปเดตข้อมูลสำเร็จ!" })
        setTimeout(() => { setEditMember(null); window.location.reload() }, 1000)
      }
    } catch (e: any) {
      setMessage({ type: "error", text: `❌ ${e.message}` })
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
      alert(`❌ ${e.message}`)
    }
  }

  return (
    <div className="space-y-5">
      {/* Top Bar & Filters */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-4 flex flex-wrap items-center gap-3 shadow-lg">
        <input
          type="text"
          placeholder="🔍 ค้นหาชื่อตัวละคร หรือ Discord ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-56 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
        />
        <select
          value={filterJob}
          onChange={(e) => setFilterJob(e.target.value)}
          className="bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
        >
          <option value="">ทุกอาชีพ (15 อาชีพ)</option>
          {JOB_CLASSES.map((j) => (
            <option key={j} value={j}>{JOB_EMOJI[j]} {j}</option>
          ))}
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
        >
          <option value="">ทุกสิทธิ์ (Role)</option>
          <option value="admin">👑 Admin</option>
          <option value="member">🛡️ Member</option>
        </select>
        <div className="text-sm font-medium text-slate-400 px-2">พบ {filtered.length} คน</div>
        {isAdmin && (
          <button
            onClick={openAdd}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-md shadow-purple-900/40 transition-all cursor-pointer"
          >
            ➕ เพิ่มสมาชิกใหม่
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 text-left">
                <th className="px-5 py-3.5 font-semibold">ชื่อตัวละคร</th>
                <th className="px-5 py-3.5 font-semibold">อาชีพ</th>
                <th className="px-5 py-3.5 font-semibold">Discord ID</th>
                <th className="px-5 py-3.5 font-semibold">ระดับสิทธิ์</th>
                <th className="px-5 py-3.5 font-semibold">วันที่ลงทะเบียน</th>
                {isAdmin && <th className="px-5 py-3.5 font-semibold text-right">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center text-slate-500 py-14">
                    ไม่พบสมาชิกที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                        {m.display_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <span className="font-semibold text-white">{m.display_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {m.job_class ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium">
                        <span>{JOB_EMOJI[m.job_class] || "⚔️"}</span>
                        <span>{m.job_class}</span>
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">ยังไม่ระบุ</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-500 text-xs">{m.discord_id}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      m.role === "admin"
                        ? "bg-purple-950/80 text-purple-300 border border-purple-700/50"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {m.role === "admin" ? "👑 Admin" : "🛡️ Member"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">
                    {new Date(m.created_at).toLocaleDateString("th-TH")}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(m)}
                          className="text-xs font-medium text-indigo-400 hover:text-white bg-indigo-950/40 hover:bg-indigo-600 border border-indigo-800/50 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          ✏️ แก้ไข
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.display_name)}
                          className="text-xs font-medium text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-600 border border-rose-800/50 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          🗑️ ลบ
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(editMember || isAddModalOpen) && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <h3 className="font-bold text-white text-base">
                {isAddModalOpen ? "➕ เพิ่มสมาชิกใหม่ในกิลด์" : `✏️ แก้ไขข้อมูล: ${editMember?.display_name}`}
              </h3>
              <button
                onClick={() => { setEditMember(null); setIsAddModalOpen(false) }}
                className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              {isAddModalOpen && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Discord ID *</label>
                  <input
                    placeholder="เช่น 123456789012345678"
                    value={editForm.discord_id}
                    onChange={(e) => setEditForm(f => ({ ...f, discord_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">ชื่อตัวละคร *</label>
                <input
                  placeholder="ชื่อในเกม / ชื่อแสดงผล"
                  value={editForm.display_name}
                  onChange={(e) => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">อาชีพ</label>
                  <select
                    value={editForm.job_class}
                    onChange={(e) => setEditForm(f => ({ ...f, job_class: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- กรุณาเลือก --</option>
                    {JOB_CLASSES.map((j) => (
                      <option key={j} value={j}>{JOB_EMOJI[j]} {j}</option>
                    ))}
                  </select>
                </div>
                {isAdmin && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">ระดับสิทธิ์ (Role)</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                )}
              </div>
              {message && (
                <div className={`text-sm px-3.5 py-2.5 rounded-xl ${message.type === "success" ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300" : "bg-rose-950/60 border border-rose-800 text-rose-300"}`}>
                  {message.text}
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => { setEditMember(null); setIsAddModalOpen(false) }}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? "กำลังบันทึก..." : "💾 บันทึกการแก้ไข"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
