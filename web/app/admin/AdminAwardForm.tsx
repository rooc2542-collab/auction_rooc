"use client"

import { useState } from "react"

const ITEM_CHOICES = [
  { value: "Album", label: "📖 สมุดการ์ด" },
  { value: "Puppet", label: "🎭 เศษการ์ดบอส" },
  { value: "White", label: "🪶 ขนนกขาว" },
  { value: "RedBlack", label: "🔴 ขนนกดำแดง" },
]

interface Member { id: string; display_name: string; discord_id: string }

export default function AdminAwardForm({ members }: { members: Member[] }) {
  const [memberId, setMemberId] = useState("")
  const [itemType, setItemType] = useState("Album")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!memberId) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch("/api/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId, itemType, note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด")
      setResult({ type: "success", text: `✅ Award สำเร็จ!` })
      setMemberId("")
      setNote("")
    } catch (e: any) {
      setResult({ type: "error", text: `❌ ${e.message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-48">
        <label className="block text-xs text-gray-400 mb-1.5">สมาชิก</label>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          required
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
        >
          <option value="">เลือกสมาชิก...</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1.5">ไอเทม</label>
        <select
          value={itemType}
          onChange={(e) => setItemType(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
        >
          {ITEM_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-48">
        <label className="block text-xs text-gray-400 mb-1.5">หมายเหตุ (ไม่บังคับ)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="หมายเหตุ..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !memberId}
        className="px-5 py-2.5 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {loading ? "กำลัง..." : "🎁 Award"}
      </button>

      {result && (
        <div className={`w-full text-sm px-4 py-2.5 rounded-lg ${result.type === "success" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
          {result.text}
        </div>
      )}
    </form>
  )
}
