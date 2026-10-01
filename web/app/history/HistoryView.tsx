"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"

export type ItemKey = "Album" | "Puppet" | "White" | "RedBlack"

export const ITEM_CONFIG: Record<
  ItemKey,
  { label: string; subLabel: string; color: string; badge: string; bg: string }
> = {
  Album: {
    label: "สมุดการ์ด",
    subLabel: "Card Fragment",
    color: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:border-blue-800/60 dark:text-blue-300",
    bg: "bg-blue-500/10",
  },
  Puppet: {
    label: "การ์ดหุ่น",
    subLabel: "Illusion Card",
    color: "text-purple-700 dark:text-purple-400",
    badge: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:border-purple-800/60 dark:text-purple-300",
    bg: "bg-purple-500/10",
  },
  White: {
    label: "ขนนกขาว",
    subLabel: "Light-Dark",
    color: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-300",
    bg: "bg-emerald-500/10",
  },
  RedBlack: {
    label: "ขนนกดำแดง",
    subLabel: "Time-Space",
    color: "text-rose-700 dark:text-rose-400",
    badge: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:border-rose-800/60 dark:text-rose-300",
    bg: "bg-rose-500/10",
  },
}

export interface RawHistoryItem {
  id: string
  round_id: string | null
  user_id: string
  item_type: string
  qty_awarded: number
  awarded_by: string | null
  note: string | null
  awarded_at: string
  profiles?: {
    id: string
    display_name: string
    discord_id: string
    job_class: string | null
  } | null
  awarded_by_profile?: {
    display_name: string
  } | null
}

export interface RawAttendanceItem {
  id: string
  event_name: string
  event_date: string
  message_id: string | null
  channel_id: string | null
  discord_id: string
  user_id: string | null
  status: "want_bid" | "no_bid" | "absent" | string
  interested_items: string[] | null
  created_at: string
  updated_at: string
  profiles?: {
    id: string
    display_name: string
    discord_id: string
    job_class: string | null
  } | null
}

export interface GroupedAwardItem {
  key: string
  user_id: string
  display_name: string
  discord_id: string
  job_class: string | null
  item_type: ItemKey
  event_name: string
  session_date: string
  total_qty: number
  awarded_by: string
  latest_awarded_at: string
  slots: Array<{
    id: string
    slot: string
    rawNote: string
    qty: number
    awarded_at: string
  }>
}

function parseSlotCoordinates(slotStr: string): { page: number; slot: number } {
  const pageMatch = slotStr.match(/(?:Page|หน้า)\s*(\d+)/i)
  const slotMatch = slotStr.match(/(?:Slot|ช่องที่|ช่อง)\s*(\d+)/i)

  const page = pageMatch ? parseInt(pageMatch[1], 10) : 0
  const slot = slotMatch ? parseInt(slotMatch[1], 10) : 0

  return { page, slot }
}

function compareSlots(aStr: string, bStr: string): number {
  const coordA = parseSlotCoordinates(aStr)
  const coordB = parseSlotCoordinates(bStr)

  if (coordA.page !== coordB.page) {
    return coordA.page - coordB.page
  }
  if (coordA.slot !== coordB.slot) {
    return coordA.slot - coordB.slot
  }
  return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" })
}

interface HistoryViewProps {
  history: RawHistoryItem[]
  attendance: RawAttendanceItem[]
  sessions?: any[]
  isAdmin?: boolean
}

export default function HistoryView({
  history,
  attendance,
  sessions = [],
  isAdmin,
}: HistoryViewProps) {
  const [tab, setTab] = useState<"awards" | "votes">("awards")
  const [search, setSearch] = useState("")
  const [filterEvent, setFilterEvent] = useState("")
  const [filterItem, setFilterItem] = useState("")
  const [filterVoteStatus, setFilterVoteStatus] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // 1. Group Award History by (user_id + item_type + event_title + date)
  const groupedAwards = useMemo(() => {
    const map = new Map<string, GroupedAwardItem>()

    for (const h of history) {
      const it = (h.item_type || "Album") as ItemKey
      let eventTitle = "ทั่วไป"
      let slotInfo = ""

      if (h.note) {
        const parts = h.note.split(" - ")
        eventTitle = parts[0]?.trim() || h.note
        slotInfo = parts.slice(1).join(" - ").trim()
      }

      // Extract date if available or use awarded_at date
      const dateMatch = eventTitle.match(/\((\d{4}-\d{2}-\d{2})\)/)
      const sessionDate = dateMatch
        ? dateMatch[1]
        : h.awarded_at
        ? h.awarded_at.slice(0, 10)
        : ""

      const groupKey = `${h.user_id}__${it}__${eventTitle}__${sessionDate}`

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          user_id: h.user_id,
          display_name: h.profiles?.display_name || "Unknown",
          discord_id: h.profiles?.discord_id || "-",
          job_class: h.profiles?.job_class || null,
          item_type: it,
          event_name: eventTitle,
          session_date: sessionDate,
          total_qty: 0,
          awarded_by: h.awarded_by_profile?.display_name || "-",
          latest_awarded_at: h.awarded_at,
          slots: [],
        })
      }

      const g = map.get(groupKey)!
      g.total_qty += h.qty_awarded || 1
      if (slotInfo) {
        g.slots.push({
          id: h.id,
          slot: slotInfo,
          rawNote: h.note || "",
          qty: h.qty_awarded || 1,
          awarded_at: h.awarded_at,
        })
      }
      if (new Date(h.awarded_at) > new Date(g.latest_awarded_at)) {
        g.latest_awarded_at = h.awarded_at
      }
    }

    // Sort slots inside each group in ascending order (Page ASC, Slot ASC)
    for (const g of map.values()) {
      g.slots.sort((a, b) => compareSlots(a.slot || a.rawNote || "", b.slot || b.rawNote || ""))
    }

    // Sort by latest_awarded_at descending
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latest_awarded_at).getTime() - new Date(a.latest_awarded_at).getTime()
    )
  }, [history])

  // Extract distinct event names for filters
  const awardEventOptions = useMemo(() => {
    const set = new Set<string>()
    for (const g of groupedAwards) {
      if (g.event_name) set.add(g.event_name)
    }
    return Array.from(set)
  }, [groupedAwards])

  const voteEventOptions = useMemo(() => {
    const set = new Set<string>()
    for (const a of attendance) {
      const label = `${a.event_name} (${a.event_date})`
      set.add(label)
    }
    return Array.from(set)
  }, [attendance])

  // Filter Grouped Awards
  const filteredAwards = useMemo(() => {
    return groupedAwards.filter((item) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        item.display_name.toLowerCase().includes(q) ||
        item.discord_id.toLowerCase().includes(q) ||
        item.event_name.toLowerCase().includes(q)

      const matchEvent = !filterEvent || item.event_name === filterEvent
      const matchItem = !filterItem || item.item_type === filterItem

      return matchSearch && matchEvent && matchItem
    })
  }, [groupedAwards, search, filterEvent, filterItem])

  // Filter Votes (Attendance)
  const filteredVotes = useMemo(() => {
    return attendance.filter((a) => {
      const q = search.toLowerCase()
      const displayName = a.profiles?.display_name || ""
      const discordId = a.discord_id || ""
      const eventLabel = `${a.event_name} (${a.event_date})`

      const matchSearch =
        !q ||
        displayName.toLowerCase().includes(q) ||
        discordId.toLowerCase().includes(q) ||
        eventLabel.toLowerCase().includes(q)

      const matchEvent = !filterEvent || eventLabel === filterEvent
      const matchStatus = !filterVoteStatus || a.status === filterVoteStatus

      return matchSearch && matchEvent && matchStatus
    })
  }, [attendance, search, filterEvent, filterVoteStatus])

  // Aggregate Stats for Awards
  const awardStats = useMemo(() => {
    let totalItems = 0
    const userSet = new Set<string>()
    for (const a of filteredAwards) {
      totalItems += a.total_qty
      userSet.add(a.user_id)
    }
    return {
      entriesCount: filteredAwards.length,
      totalItems,
      uniqueUsers: userSet.size,
    }
  }, [filteredAwards])

  // Aggregate Stats for Votes
  const voteStats = useMemo(() => {
    let wantBid = 0
    let noBid = 0
    let absent = 0
    for (const v of filteredVotes) {
      if (v.status === "want_bid") wantBid++
      else if (v.status === "no_bid") noBid++
      else if (v.status === "absent") absent++
    }
    return {
      total: filteredVotes.length,
      wantBid,
      noBid,
      absent,
    }
  }, [filteredVotes])

  // Pagination state for Awards
  const [pageAwards, setPageAwards] = useState(1)
  const [pageSizeAwards, setPageSizeAwards] = useState(20)

  // Pagination state for Votes
  const [pageVotes, setPageVotes] = useState(1)
  const [pageSizeVotes, setPageSizeVotes] = useState(20)

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setPageAwards(1)
  }, [search, filterEvent, filterItem])

  useEffect(() => {
    setPageVotes(1)
  }, [search, filterEvent, filterVoteStatus])

  // Paginated Awards
  const totalAwardItems = filteredAwards.length
  const totalAwardPages = pageSizeAwards > 0 ? Math.max(1, Math.ceil(totalAwardItems / pageSizeAwards)) : 1
  const validPageAwards = Math.min(Math.max(1, pageAwards), totalAwardPages)
  const startAwardIdx = pageSizeAwards > 0 ? (validPageAwards - 1) * pageSizeAwards : 0
  const endAwardIdx = pageSizeAwards > 0 ? Math.min(startAwardIdx + pageSizeAwards, totalAwardItems) : totalAwardItems
  const paginatedAwards = pageSizeAwards > 0 ? filteredAwards.slice(startAwardIdx, endAwardIdx) : filteredAwards

  // Paginated Votes
  const totalVoteItems = filteredVotes.length
  const totalVotePages = pageSizeVotes > 0 ? Math.max(1, Math.ceil(totalVoteItems / pageSizeVotes)) : 1
  const validPageVotes = Math.min(Math.max(1, pageVotes), totalVotePages)
  const startVoteIdx = pageSizeVotes > 0 ? (validPageVotes - 1) * pageSizeVotes : 0
  const endVoteIdx = pageSizeVotes > 0 ? Math.min(startVoteIdx + pageSizeVotes, totalVoteItems) : totalVoteItems
  const paginatedVotes = pageSizeVotes > 0 ? filteredVotes.slice(startVoteIdx, endVoteIdx) : filteredVotes

  function getPageNumbers(current: number, total: number) {
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1)
    }
    if (current <= 3) {
      return [1, 2, 3, 4, 5]
    }
    if (current >= total - 2) {
      return [total - 4, total - 3, total - 2, total - 1, total]
    }
    return [current - 2, current - 1, current, current + 1, current + 2]
  }

  function toggleExpand(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function renderPagination(
    totalItems: number,
    currentPage: number,
    totalPages: number,
    startIndex: number,
    endIndex: number,
    pageSize: number,
    onPageChange: (p: number) => void,
    onPageSizeChange: (s: number) => void,
    position: "top" | "bottom",
    unitName: string
  ) {
    if (totalItems === 0) return null
    const pageNumbers = getPageNumbers(currentPage, totalPages)
    const isTop = position === "top"

    return (
      <div
        className={`px-4 py-2.5 bg-zinc-50/80 dark:bg-zinc-950/50 ${
          isTop ? "border-b" : "border-t"
        } border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs`}
      >
        {/* Left: Range and Per-Page Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-zinc-600 dark:text-zinc-400">
            แสดง{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-200 font-mono">
              {startIndex + 1} - {endIndex}
            </span>{" "}
            จากทั้งหมด{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-200 font-mono">
              {totalItems}
            </span>{" "}
            {unitName}
          </span>

          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
            <span>ต่อหน้า:</span>
            {[10, 20, 50, 100].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onPageSizeChange(size)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                  pageSize === size
                    ? "bg-teal-700 text-white font-bold shadow-xs"
                    : "bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700/60"
                }`}
              >
                {size}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onPageSizeChange(0)}
              className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                pageSize === 0
                  ? "bg-teal-700 text-white font-bold shadow-xs"
                  : "bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700/60"
              }`}
            >
              ทั้งหมด
            </button>
          </div>
        </div>

        {/* Right: Page Buttons */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded-md bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 text-xs font-medium cursor-pointer transition-all shadow-xs"
            >
              ‹ ก่อนหน้า
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`w-7 h-7 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    currentPage === p
                      ? "bg-teal-700 text-white shadow-xs"
                      : "bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700/70"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded-md bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 text-xs font-medium cursor-pointer transition-all shadow-xs"
            >
              ถัดไป ›
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ─── Top Header & Controls ──────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>ประวัติระบบประมูล</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm mt-1">
            ดูประวัติการแจกของ (สรุปรวมยอด) และประวัติการลงชื่อโหวตจาก Discord
          </p>
        </div>

        <Link
          href="/queues"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs font-medium border border-zinc-300 dark:border-zinc-800 transition-colors w-fit shadow-xs"
        >
          <span>← กลับหน้าจัดคิวและสล็อต</span>
        </Link>
      </div>

      {/* ─── Tabs & Filters Toolbar ──────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-sm">
        {/* Main Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 rounded-xl">
            <button
              onClick={() => {
                setTab("awards")
                setFilterEvent("")
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tab === "awards"
                  ? "bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300 border border-zinc-200 dark:border-zinc-700 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span>🎁 ประวัติการแจกของ</span>
              <span className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-850 text-[10px] rounded-full text-zinc-700 dark:text-zinc-400 font-mono">
                {groupedAwards.length}
              </span>
            </button>

            <button
              onClick={() => {
                setTab("votes")
                setFilterEvent("")
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tab === "votes"
                  ? "bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-300 border border-zinc-200 dark:border-zinc-700 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span>🗳️ ประวัติการโหวต</span>
              <span className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-850 text-[10px] rounded-full text-zinc-700 dark:text-zinc-400 font-mono">
                {attendance.length}
              </span>
            </button>
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              {tab === "awards" ? "แสดงยอดรวมต่อรายการ" : "ข้อมูลซิงค์จาก Discord Poll"}
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search box */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="ค้นหาชื่อสมาชิก / Discord ID / อีเวนต์..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 shadow-xs"
            />
          </div>

          {/* Event Filter */}
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 shadow-xs"
          >
            <option value="">ทุกอีเวนต์ / ทุกรอบ</option>
            {(tab === "awards" ? awardEventOptions : voteEventOptions).map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>

          {/* Tab-Specific Filters */}
          {tab === "awards" ? (
            <select
              value={filterItem}
              onChange={(e) => setFilterItem(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 shadow-xs"
            >
              <option value="">ทุกไอเทม</option>
              <option value="Album">สมุดการ์ด (Card Fragment)</option>
              <option value="Puppet">การ์ดหุ่น (Illusion Card)</option>
              <option value="White">ขนนกขาว (Light-Dark)</option>
              <option value="RedBlack">ขนนกดำแดง (Time-Space)</option>
            </select>
          ) : (
            <select
              value={filterVoteStatus}
              onChange={(e) => setFilterVoteStatus(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 shadow-xs"
            >
              <option value="">ทุกสถานะการโหวต</option>
              <option value="want_bid">🟢 ต้องการประมูล</option>
              <option value="no_bid">🟡 สละสิทธิ์ (สะสมเครดิต)</option>
              <option value="absent">🔴 ไม่เข้าร่วม</option>
            </select>
          )}

          {(search || filterEvent || filterItem || filterVoteStatus) && (
            <button
              onClick={() => {
                setSearch("")
                setFilterEvent("")
                setFilterItem("")
                setFilterVoteStatus("")
              }}
              className="px-3 py-2 rounded-xl text-xs text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700/60 cursor-pointer shadow-xs transition-colors"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* Mini Stats Banner */}
        {tab === "awards" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3 shadow-xs">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">จำนวนการแจก (สรุปรวม)</div>
              <div className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-0.5">
                {awardStats.entriesCount}{" "}
                <span className="text-xs text-zinc-500 font-normal">รายการ</span>
              </div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3 shadow-xs">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">ไอเทมที่แจกทั้งหมด</div>
              <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                {awardStats.totalItems}{" "}
                <span className="text-xs text-zinc-500 font-normal">ชิ้น/สล็อต</span>
              </div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3 col-span-2 sm:col-span-1 shadow-xs">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">สมาชิกที่ได้รับของ</div>
              <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {awardStats.uniqueUsers}{" "}
                <span className="text-xs text-zinc-500 font-normal">คน</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3 shadow-xs">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">ลงชื่อทั้งหมด</div>
              <div className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-0.5">
                {voteStats.total}{" "}
                <span className="text-xs text-zinc-500 font-normal">คน</span>
              </div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3 shadow-xs">
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">🟢 ต้องการประมูล</div>
              <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-300 mt-0.5">
                {voteStats.wantBid}{" "}
                <span className="text-xs text-zinc-500 font-normal">คน</span>
              </div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3 shadow-xs">
              <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">🟡 สละสิทธิ์/ข้าม</div>
              <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-300 mt-0.5">
                {voteStats.noBid}{" "}
                <span className="text-xs text-zinc-500 font-normal">คน</span>
              </div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3 shadow-xs">
              <div className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">🔴 ไม่เข้าร่วม</div>
              <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-300 mt-0.5">
                {voteStats.absent}{" "}
                <span className="text-xs text-zinc-500 font-normal">คน</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── TAB 1: AWARDS HISTORY (GROUPED) ──────────────── */}
      {tab === "awards" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          {/* Top Pagination */}
          {renderPagination(
            totalAwardItems,
            validPageAwards,
            totalAwardPages,
            startAwardIdx,
            endAwardIdx,
            pageSizeAwards,
            setPageAwards,
            (newSize) => {
              setPageSizeAwards(newSize)
              setPageAwards(1)
            },
            "top",
            "รายการแจก"
          )}

          {filteredAwards.length === 0 ? (
            <div className="p-16 text-center text-zinc-500 text-sm">
              ไม่พบประวัติการแจกของที่ตรงกับการค้นหา
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/90 dark:bg-zinc-950/50 text-zinc-600 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="px-4 py-3.5">วันที่แจก</th>
                    <th className="px-4 py-3.5">สมาชิก</th>
                    <th className="px-4 py-3.5">อีเวนต์ / รอบ</th>
                    <th className="px-4 py-3.5">ไอเทม</th>
                    <th className="px-4 py-3.5 text-center">ยอดรวมที่ได้รับ</th>
                    <th className="px-4 py-3.5">ผู้มอบ</th>
                    <th className="px-4 py-3.5 text-right">รายละเอียดสล็อต</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {paginatedAwards.map((item) => {
                    const cfg = ITEM_CONFIG[item.item_type]
                    const isExpanded = expandedGroups.has(item.key)

                    return (
                      <tr
                        key={item.key}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group align-top"
                      >
                        {/* Date */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                          {new Date(item.latest_awarded_at).toLocaleString("th-TH", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>

                        {/* Member */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                            {item.display_name}
                          </div>
                          <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                            {item.job_class && <span>{item.job_class}</span>}
                            {item.discord_id && (
                              <span className="font-mono">({item.discord_id.slice(-6)})</span>
                            )}
                          </div>
                        </td>

                        {/* Event */}
                        <td className="px-4 py-3.5">
                          <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 text-xs font-medium">
                            {item.event_name}
                          </span>
                        </td>

                        {/* Item */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                cfg?.badge || "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                              }`}
                            >
                              {cfg?.label || item.item_type}
                            </span>
                            <span className="text-[10px] text-zinc-500 hidden sm:inline">
                              ({cfg?.subLabel || item.item_type})
                            </span>
                          </div>
                        </td>

                        {/* Total Qty (Highlighted & Grouped) */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-baseline gap-1 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-1 rounded-xl">
                            <span className="text-amber-700 dark:text-amber-400 font-extrabold text-base font-mono">
                              {item.total_qty}
                            </span>
                            <span className="text-amber-600/80 dark:text-amber-500/80 text-[11px] font-medium">
                              อัน
                            </span>
                          </div>
                        </td>

                        {/* Awarded By */}
                        <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400 text-xs">
                          {item.awarded_by}
                        </td>

                        {/* Slot Details & Toggle */}
                        <td className="px-4 py-3.5 text-right">
                          {item.slots.length > 0 ? (
                            <div className="space-y-1.5">
                              <button
                                onClick={() => toggleExpand(item.key)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium border border-zinc-300 dark:border-zinc-700 cursor-pointer transition-colors shadow-2xs"
                              >
                                <span>{isExpanded ? "▲ ซ่อนสล็อต" : `▼ ดูสล็อต (${item.slots.length})`}</span>
                              </button>

                              {isExpanded && (
                                <div className="mt-2 p-2.5 bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-xl text-left space-y-1 max-w-sm ml-auto shadow-sm">
                                  <div className="text-[10px] text-zinc-500 font-semibold mb-1">
                                    รายการสล็อตที่ได้รับ ({item.slots.length} สล็อต):
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {item.slots.map((s, sIdx) => (
                                      <span
                                        key={s.id || sIdx}
                                        className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-[10px] font-mono text-zinc-700 dark:text-zinc-300"
                                      >
                                        {s.slot || s.rawNote}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-600 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Pagination */}
          {renderPagination(
            totalAwardItems,
            validPageAwards,
            totalAwardPages,
            startAwardIdx,
            endAwardIdx,
            pageSizeAwards,
            setPageAwards,
            (newSize) => {
              setPageSizeAwards(newSize)
              setPageAwards(1)
            },
            "bottom",
            "รายการแจก"
          )}
        </div>
      )}

      {/* ─── TAB 2: VOTES / ATTENDANCE HISTORY ──────────────── */}
      {tab === "votes" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          {/* Top Pagination */}
          {renderPagination(
            totalVoteItems,
            validPageVotes,
            totalVotePages,
            startVoteIdx,
            endVoteIdx,
            pageSizeVotes,
            setPageVotes,
            (newSize) => {
              setPageSizeVotes(newSize)
              setPageVotes(1)
            },
            "top",
            "คน"
          )}

          {filteredVotes.length === 0 ? (
            <div className="p-16 text-center text-zinc-500 text-sm">
              ไม่พบประวัติการลงชื่อโหวตที่ตรงกับการค้นหา
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/90 dark:bg-zinc-950/50 text-zinc-600 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="px-4 py-3.5">วันที่ & กิจกรรม</th>
                    <th className="px-4 py-3.5">สมาชิก</th>
                    <th className="px-4 py-3.5">Discord ID</th>
                    <th className="px-4 py-3.5 text-center">สถานะการโหวต</th>
                    <th className="px-4 py-3.5">ไอเทมที่เลือกลงชื่อ</th>
                    <th className="px-4 py-3.5 text-right">เวลาลงคะแนน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {paginatedVotes.map((v) => {
                    const statusConfig = {
                      want_bid: {
                        label: "🟢 ต้องการประมูล",
                        badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-300",
                      },
                      no_bid: {
                        label: "🟡 สละสิทธิ์ / ข้าม",
                        badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:border-amber-800/60 dark:text-amber-300",
                      },
                      absent: {
                        label: "🔴 ไม่เข้าร่วม",
                        badge: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:border-rose-800/60 dark:text-rose-300",
                      },
                    }[v.status] || {
                      label: v.status,
                      badge: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400",
                    }

                    const interested = Array.isArray(v.interested_items) ? v.interested_items : []

                    return (
                      <tr key={v.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                        {/* Event & Date */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{v.event_name}</div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            {v.event_date}
                          </div>
                        </td>

                        {/* Member */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-200">
                            {v.profiles?.display_name || "Unknown"}
                          </div>
                          {v.profiles?.job_class && (
                            <div className="text-[10px] text-zinc-500">
                              {v.profiles.job_class}
                            </div>
                          )}
                        </td>

                        {/* Discord ID */}
                        <td className="px-4 py-3.5 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          {v.discord_id || "-"}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusConfig.badge}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>

                        {/* Interested Items */}
                        <td className="px-4 py-3.5">
                          {v.status === "want_bid" ? (
                            interested.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {interested.map((itKey) => {
                                  const cfg = ITEM_CONFIG[itKey as ItemKey]
                                  return (
                                    <span
                                      key={itKey}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                        cfg?.badge || "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                                      }`}
                                    >
                                      {cfg?.label || itKey}
                                    </span>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">สนใจทุกไอเทม</span>
                            )
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-600 text-xs">-</span>
                          )}
                        </td>

                        {/* Timestamp */}
                        <td className="px-4 py-3.5 text-right font-mono text-zinc-500 text-[11px] whitespace-nowrap">
                          {v.updated_at || v.created_at
                            ? new Date(v.updated_at || v.created_at).toLocaleString("th-TH", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Pagination */}
          {renderPagination(
            totalVoteItems,
            validPageVotes,
            totalVotePages,
            startVoteIdx,
            endVoteIdx,
            pageSizeVotes,
            setPageVotes,
            (newSize) => {
              setPageSizeVotes(newSize)
              setPageVotes(1)
            },
            "bottom",
            "คน"
          )}
        </div>
      )}
    </div>
  )
}
