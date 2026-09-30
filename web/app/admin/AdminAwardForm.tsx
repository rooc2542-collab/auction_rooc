"use client"

import { useState } from "react"

const ITEM_CHOICES = [
  { value: "Album", label: "สมุดการ์ด" },
  { value: "Puppet", label: "เศษการ์ดบอส" },
  { value: "White", label: "ขนนกขาว" },
  { value: "RedBlack", label: "ขนนกดำแดง" },
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
      setResult({ type: "success", text: `Award สำเร็จ` })
      setMemberId("")
      setNote("")
    } catch (e: any) {
      setResult({ type: "error", text: `${e.message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-48">
        <label className="block text-xs text-zinc-500 mb-1.5">สมาชิก</label>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          required
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
        >
          <option value="">เลือกสมาชิก...</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-zinc-500 mb-1.5">ไอเทม</label>
        <select
          value={itemType}
          onChange={(e) => setItemType(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
        >
          {ITEM_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-48">
        <label className="block text-xs text-zinc-500 mb-1.5">หมายเหตุ (ไม่บังคับ)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="หมายเหตุ..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !memberId}
        className="px-5 py-2.5 bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
      >
        {loading ? "กำลังบันทึก..." : "Award"}
      </button>

      {result && (
        <div className={`w-full text-sm px-4 py-2.5 rounded-lg border ${
          result.type === "success"
            ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
            : "bg-rose-950/40 border-rose-800/60 text-rose-300"
        }`}>
          {result.text}
        </div>
      )}
    </form>
  )
}
