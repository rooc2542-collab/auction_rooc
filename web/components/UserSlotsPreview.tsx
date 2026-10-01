"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ITEM_CONFIG } from "@/lib/constants"
import type { ItemType } from "@/lib/constants"

interface Profile {
  id: string
  display_name: string
  discord_id?: string
  job_class?: string | null
  role?: string
}

interface Slot {
  id: string
  event_name: string
  session_date: string
  user_id: string
  item_type: string
  page_number: number
  slot_number: number
  total_pages: number
  status: "allocated" | "awarded" | "skipped" | string
  profiles?: {
    display_name?: string
    discord_id?: string
    job_class?: string | null
  } | null
}

interface Props {
  currentProfile: Profile | null
  slots: Slot[]
  isAdmin: boolean
}

export default function UserSlotsPreview({ currentProfile, slots, isAdmin }: Props) {
  // Default strictly to "my" (only my own slots)
  const [viewMode, setViewMode] = useState<"my" | "all">("my")

  const mySlots = useMemo(() => {
    if (!currentProfile) return []
    return slots.filter((s) => s.user_id === currentProfile.id)
  }, [slots, currentProfile])

  const displayedSlots = viewMode === "my" ? mySlots : slots

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="font-semibold text-zinc-100 text-sm">
            {viewMode === "my" ? "พิกัดสล็อตของฉัน" : "พิกัดสล็อตทั้งหมดในกิลด์"}
          </h2>

          {viewMode === "my" && currentProfile && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800/60 font-medium">
              {currentProfile.display_name} ({mySlots.length} ช่อง)
            </span>
          )}

          {/* Admin Toggle: My slots vs All slots */}
          {isAdmin && (
            <div className="inline-flex rounded-lg bg-zinc-800 p-0.5 border border-zinc-700">
              <button
                type="button"
                onClick={() => setViewMode("my")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === "my"
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                เฉพาะของฉัน
              </button>
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === "all"
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                สมาชิกทุกคน ({slots.length})
              </button>
            </div>
          )}
        </div>

        <Link
          href="/queues"
          className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors w-fit flex items-center gap-1"
        >
          <span>เปิดกระดาน 4 ช่องเต็ม</span>
          <span>→</span>
        </Link>
      </div>

      {/* Empty State when no slots for user */}
      {viewMode === "my" && mySlots.length === 0 ? (
        <div className="p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-xl mx-auto border border-zinc-700">
            📦
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-200">
              ยังไม่มีสล็อตที่ได้รับจัดสรรในรอบนี้
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              เมื่อแอดมินปิดโพลและกดจัดสรรสล็อต รายการพิกัดหน้าและช่องของคุณจะแสดงที่นี่โดยอัตโนมัติ
            </p>
          </div>
          <Link
            href="/queues"
            className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-colors"
          >
            ดูผังกระดานรวมทั้งหมด →
          </Link>
        </div>
      ) : (
        /* Slots Table */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-500 text-left">
                {viewMode === "all" && <th className="px-5 py-3 font-medium">สมาชิก</th>}
                <th className="px-5 py-3 font-medium">ไอเทม</th>
                <th className="px-5 py-3 text-center font-medium">Page</th>
                <th className="px-5 py-3 text-center font-medium">ช่องที่</th>
                <th className="px-5 py-3 text-center font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {displayedSlots.slice(0, viewMode === "my" ? 50 : 16).map((slot) => {
                const cfg = ITEM_CONFIG[slot.item_type as ItemType]
                return (
                  <tr key={slot.id} className="hover:bg-zinc-800/30 transition-colors">
                    {viewMode === "all" && (
                      <td className="px-5 py-3 font-semibold text-zinc-100">
                        {slot.profiles?.display_name || "Unknown"}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                        {cfg?.label || slot.item_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-zinc-300 font-mono font-semibold">
                      Page {slot.page_number}/{slot.total_pages}
                    </td>
                    <td className="px-5 py-3 text-center text-zinc-100 font-mono font-bold">
                      ช่องที่ {slot.slot_number}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          slot.status === "awarded"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                            : slot.status === "skipped"
                            ? "bg-rose-950 text-rose-400 border border-rose-800/60"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}
                      >
                        {slot.status === "awarded"
                          ? "ได้รับแล้ว"
                          : slot.status === "skipped"
                          ? "ข้ามคิว"
                          : "รอประมูล"}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
