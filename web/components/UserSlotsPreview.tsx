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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(5) // default 5 items per page

  const mySlots = useMemo(() => {
    if (!currentProfile) return []
    return slots.filter((s) => s.user_id === currentProfile.id)
  }, [slots, currentProfile])

  const displayedSlots = viewMode === "my" ? mySlots : slots

  const totalItems = displayedSlots.length
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize))
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages)

  const startIndex = pageSize === 0 ? 0 : (validCurrentPage - 1) * pageSize
  const endIndex = pageSize === 0 ? totalItems : Math.min(startIndex + pageSize, totalItems)
  const paginatedSlots = pageSize === 0 ? displayedSlots : displayedSlots.slice(startIndex, endIndex)

  const handleViewModeChange = (mode: "my" | "all") => {
    setViewMode(mode)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    if (validCurrentPage <= 3) {
      return [1, 2, 3, 4, 5]
    }
    if (validCurrentPage >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }
    return [validCurrentPage - 2, validCurrentPage - 1, validCurrentPage, validCurrentPage + 1, validCurrentPage + 2]
  }

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
                onClick={() => handleViewModeChange("my")}
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
                onClick={() => handleViewModeChange("all")}
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
        <>
          {/* ─── Top Pagination Toolbar ──────────────── */}
          {totalItems > 0 && (
            <div className="px-5 py-2.5 bg-zinc-950/50 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Range Info & Page Size Options */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-zinc-400">
                  แสดง <span className="font-semibold text-zinc-200">{startIndex + 1} - {endIndex}</span> จากทั้งหมด <span className="font-semibold text-zinc-200">{totalItems}</span> ช่อง
                </span>

                <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <span>ต่อหน้า:</span>
                  {[5, 10, 20].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handlePageSizeChange(size)}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                        pageSize === size
                          ? "bg-teal-700 text-white font-bold shadow-sm"
                          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/60"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handlePageSizeChange(0)}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                      pageSize === 0
                        ? "bg-teal-700 text-white font-bold shadow-sm"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/60"
                    }`}
                  >
                    ทั้งหมด
                  </button>
                </div>
              </div>

              {/* Top Page Buttons */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={validCurrentPage === 1}
                    className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-300 border border-zinc-700 text-xs font-medium cursor-pointer transition-all"
                  >
                    ‹ ก่อนหน้า
                  </button>

                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                          validCurrentPage === p
                            ? "bg-teal-700 text-white shadow-sm"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700/70"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={validCurrentPage === totalPages}
                    className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-300 border border-zinc-700 text-xs font-medium cursor-pointer transition-all"
                  >
                    ถัดไป ›
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Slots Table */}
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
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                {paginatedSlots.map((slot) => {
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

          {/* ─── Bottom Pagination Footer ──────────────── */}
          {totalItems > 0 && totalPages > 1 && (
            <div className="px-5 py-3 bg-zinc-950/40 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-zinc-400">
                หน้า <span className="font-semibold text-zinc-200">{validCurrentPage}</span> จาก <span className="font-semibold text-zinc-200">{totalPages}</span>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage === 1}
                  className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-300 border border-zinc-700 text-xs font-medium cursor-pointer transition-all"
                >
                  ‹ ก่อนหน้า
                </button>

                <div className="flex items-center gap-1">
                  {getPageNumbers().map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`w-7 h-7 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                        validCurrentPage === p
                          ? "bg-teal-700 text-white shadow-sm"
                          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700/70"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage === totalPages}
                  className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-300 border border-zinc-700 text-xs font-medium cursor-pointer transition-all"
                >
                  ถัดไป ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
