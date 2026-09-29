"use client"

import { useState } from "react"
import { ITEM_CONFIG } from "@/lib/constants"
import type { ItemType } from "@/lib/constants"

interface QueueEntry {
  id: string
  user_id: string
  item_type: ItemType
  status: string
  profiles: { display_name: string; discord_id: string } | null
}

interface Props {
  roundId: string
  itemType: ItemType
  waitingQueues: QueueEntry[]
}

export default function AdminAwardForm({ roundId, itemType, waitingQueues }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [localQueues, setLocalQueues] = useState(waitingQueues)

  const handleAward = async (queueId: string, userId: string, displayName: string) => {
    setLoading(queueId)
    setResult(null)
    try {
      const res = await fetch("/api/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueId, roundId }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ success: true, message: `✅ Award ให้ ${displayName} เรียบร้อย` })
        setLocalQueues((prev) => prev.filter((q) => q.id !== queueId))
      } else {
        setResult({ success: false, message: `❌ ${data.error}` })
      }
    } catch {
      setResult({ success: false, message: "❌ เกิดข้อผิดพลาด ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      {result && (
        <div className={`text-sm px-4 py-2 rounded-lg ${result.success ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
          {result.message}
        </div>
      )}

      {localQueues.length === 0 ? (
        <p className="text-gray-500 text-sm">ไม่มีคิวที่รออยู่</p>
      ) : (
        localQueues.map((q, idx) => (
          <div key={q.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-gray-500 font-mono text-sm w-6">#{idx + 1}</span>
              <div>
                <p className="text-white font-medium text-sm">{q.profiles?.display_name ?? "—"}</p>
                <p className="text-gray-500 text-xs">{q.profiles?.discord_id}</p>
              </div>
            </div>
            <button
              onClick={() => handleAward(q.id, q.user_id, q.profiles?.display_name ?? "—")}
              disabled={loading === q.id}
              className="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {loading === q.id ? "กำลัง..." : "🎁 Award"}
            </button>
          </div>
        ))
      )}
    </div>
  )
}
