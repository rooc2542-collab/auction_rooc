"use client"

import { useState } from "react"

const JOB_CLASSES = [
  "Lord Knight", "Paladin", "Biochemist", "Mastersmith", "Bard",
  "Gypsy", "Sniper", "Champion", "Priest", "Assassin",
  "Rogue", "Wizard", "Sage", "Summoner", "Rebellion"
]

const JOB_EMOJI: Record<string, string> = {
  "Lord Knight": "⚔️", "Paladin": "🛡️", "Biochemist": "🧪", "Mastersmith": "🔨",
  "Bard": "🎵", "Gypsy": "💃", "Sniper": "🏹", "Champion": "👊",
  "Priest": "✝️", "Assassin": "🗡️", "Rogue": "🎭", "Wizard": "🔮",
  "Sage": "📖", "Summoner": "🌟", "Rebellion": "🔫"
}

interface Member {
  id: string
  display_name: string
  discord_id: string
  uid_game: string | null
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
  const [editForm, setEditForm] = useState({ display_name: "", uid_game: "", job_class: "", role: "member" })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const filtered = members.filter((m) => {
    const q = search.toLowerCase()
    const matchSearch = !q || m.display_name?.toLowerCase().includes(q) ||
      m.discord_id?.toLowerCase().includes(q) ||
      (m.uid_game || "").toLowerCase().includes(q)
    const matchJob = !filterJob || m.job_class === filterJob
    const matchRole = !filterRole || m.role === filterRole
    return matchSearch && matchJob && matchRole
  })

  function openEdit(m: Member) {
    setEditMember(m)
    setEditForm({
      display_name: m.display_name || "",
      uid_game: m.uid_game || "",
      job_class: m.job_class || "",
      role: m.role || "member",
    })
    setMessage(null)
  }

  async function handleSave() {
    if (!editMember) return
    setSaving(true)
    try {
      const res = await fetch("/api/members/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editMember.id, ...editForm }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด")
      setMessage({ type: "success", text: "✅ อัปเดตข้อมูลสำเร็จ" })
      setTimeout(() => { setEditMember(null); window.location.reload() }, 1500)
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
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="🔍 ค้นหาชื่อ, Discord ID, UID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
        <select
          value={filterJob}
          onChange={(e) => setFilterJob(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
        >
          <option value="">ทุกอาชีพ</option>
          {JOB_CLASSES.map((j) => (
            <option key={j} value={j}>{JOB_EMOJI[j]} {j}</option>
          ))}
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
        >
          <option value="">ทุก Role</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
        <div className="text-sm text-gray-400 flex items-center">พบ {filtered.length} คน</div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">สมาชิก</th>
                <th className="px-4 py-3 font-medium">อาชีพ</th>
                <th className="px-4 py-3 font-medium">UID Game</th>
                <th className="px-4 py-3 font-medium">Discord ID</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">ลงทะเบียน</th>
                {isAdmin && <th className="px-4 py-3 font-medium">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center text-gray-500 py-12">
                    ไม่พบสมาชิกที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : filtered.map((m) => (
                <tr key={m.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-900 flex items-center justify-center text-purple-300 font-bold text-xs flex-shrink-0">
                        {m.display_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <span className="font-medium text-white">{m.display_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {m.job_class ? `${JOB_EMOJI[m.job_class] || ""} ${m.job_class}` : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-400 text-xs">{m.uid_game || "-"}</td>
                  <td className="px-4 py-3 font-mono text-gray-500 text-xs">{m.discord_id}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === "admin" ? "bg-purple-900 text-purple-300" : "bg-gray-700 text-gray-400"}`}>
                      {m.role === "admin" ? "👑 Admin" : "Member"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(m.created_at).toLocaleDateString("th-TH")}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(m)}
                          className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 px-2 py-1 rounded transition-colors"
                        >
                          ✏️ แก้ไข
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.display_name)}
                          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
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

      {/* Edit Modal */}
      {editMember && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-white">✏️ แก้ไขข้อมูลสมาชิก</h3>
              <button onClick={() => setEditMember(null)} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">ชื่อในระบบ</label>
                <input
                  value={editForm.display_name}
                  onChange={(e) => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">UID Game</label>
                <input
                  value={editForm.uid_game}
                  onChange={(e) => setEditForm(f => ({ ...f, uid_game: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">อาชีพ</label>
                <select
                  value={editForm.job_class}
                  onChange={(e) => setEditForm(f => ({ ...f, job_class: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">ไม่ระบุ</option>
                  {JOB_CLASSES.map((j) => (
                    <option key={j} value={j}>{JOB_EMOJI[j]} {j}</option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}
              {message && (
                <div className={`text-sm px-3 py-2 rounded-lg ${message.type === "success" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                  {message.text}
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setEditMember(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-purple-700 hover:bg-purple-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
