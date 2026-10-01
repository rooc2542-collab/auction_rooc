"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"

const ITEM_CHOICES = [
  { value: "Album", label: "สมุดการ์ด" },
  { value: "Puppet", label: "เศษการ์ดบอส" },
  { value: "White", label: "ขนนกขาว" },
  { value: "RedBlack", label: "ขนนกดำแดง" },
]

interface Member { id: string; display_name: string; discord_id: string }

interface AdminAwardFormProps {
  members: Member[]
  existingUserIds?: string[]
}

export default function AdminAwardForm({ members, existingUserIds = [] }: AdminAwardFormProps) {
  const router = useRouter()
  const [memberId, setMemberId] = useState("")
  const [itemType, setItemType] = useState("Album")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [hideExisting, setHideExisting] = useState(true)

  const existingSet = useMemo(() => new Set(existingUserIds), [existingUserIds])

  const availableMembers = useMemo(() => {
    if (!hideExisting) return members
    return members.filter((m) => !existingSet.has(m.id))
  }, [members, hideExisting, existingSet])

  useEffect(() => {
    if (memberId && !availableMembers.some((m) => m.id === memberId)) {
      setMemberId("")
    }
  }, [availableMembers, memberId])

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
      router.refresh()
    } catch (e: any) {
      setResult({ type: "error", text: `${e.message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-48">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-zinc-500">สมาชิก</label>
          {existingUserIds.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideExisting}
                onChange={(e) => setHideExisting(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>ซ่อนคนที่มีชื่อแล้ว ({existingUserIds.length})</span>
            </label>
          )}
        </div>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          required
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
        >
          <option value="">
            {availableMembers.length === 0 ? "-- สมาชิกทุกคนมีชื่อในรอบนี้แล้ว --" : "เลือกสมาชิก..."}
          </option>
          {availableMembers.map((m) => (
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
