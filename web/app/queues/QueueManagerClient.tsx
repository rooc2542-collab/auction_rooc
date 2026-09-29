"use client"

import { useState, useMemo } from "react"
import { JOB_EMOJI } from "@/app/members/MemberTable"

type ItemKey = "Album" | "Puppet" | "White" | "RedBlack"

const ITEMS_META: Record<ItemKey, { label: string; icon: string; desc: string; gradient: string; border: string; badge: string }> = {
  Album: {
    label: "สมุดการ์ด",
    icon: "📖",
    desc: "สมุดเลือกการ์ดส้ม / การ์ดบอสปลอม",
    gradient: "from-purple-900/40 to-indigo-950/60",
    border: "border-purple-700/50",
    badge: "bg-purple-950/80 text-purple-300 border border-purple-700/50",
  },
  Puppet: {
    label: "เศษการ์ดบอส",
    icon: "🎭",
    desc: "เศษการ์ดบอสปลอมสำหรับสะสม",
    gradient: "from-amber-900/40 to-orange-950/60",
    border: "border-amber-700/50",
    badge: "bg-amber-950/80 text-amber-300 border border-amber-700/50",
  },
  White: {
    label: "ขนนกขาว",
    icon: "🪶",
    desc: "ขนนกขาวเกรดอัปเกรดสเตตัส",
    gradient: "from-slate-800/60 to-slate-900/80",
    border: "border-slate-600/50",
    badge: "bg-slate-800 text-slate-200 border border-slate-600",
  },
  RedBlack: {
    label: "ขนนกดำแดง",
    icon: "🔴",
    desc: "ขนนกแดง/ดำสเตตัสขั้นสูง",
    gradient: "from-rose-900/40 to-red-950/60",
    border: "border-rose-700/50",
    badge: "bg-rose-950/80 text-rose-300 border border-rose-700/50",
  },
}

const ITEM_KEYS: ItemKey[] = ["Album", "Puppet", "White", "RedBlack"]

interface ItemFormEntry {
  start_page: string
  start_slot: string
  end_page: string
  end_slot: string
  total_quantity: string
  personal_limit: string
}

interface Props {
  isAdmin: boolean
  members: any[]
  initialAttendance: any[]
  initialSessions: any[]
  initialSlots: any[]
  initialCredits: any[]
}

export default function QueueManagerClient({
  isAdmin,
  members,
  initialAttendance,
  initialSessions,
  initialSlots,
  initialCredits,
}: Props) {
  const todayStr = new Date().toISOString().split("T")[0]

  // หา event ล่าสุดถ้ามี
  const existingEvents = useMemo(() => {
    const set = new Set<string>()
    for (const s of initialSessions) set.add(`${s.event_name}|${s.session_date}`)
    for (const a of initialAttendance) set.add(`${a.event_name}|${a.event_date}`)
    return Array.from(set)
  }, [initialSessions, initialAttendance])

  const defaultPair = existingEvents[0] ? existingEvents[0].split("|") : ["Emperium Overrun", todayStr]

  const [eventName, setEventName] = useState(defaultPair[0] || "Emperium Overrun")
  const [eventDate, setEventDate] = useState(defaultPair[1] || todayStr)
  const [activeTab, setActiveTab] = useState<"board" | "queue" | "config">("board")
  const [filterItem, setFilterItem] = useState<"ALL" | ItemKey>("ALL")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  // Proxy add member state
  const [proxyUserId, setProxyUserId] = useState("")
  const [proxyStatus, setProxyStatus] = useState<"want_bid" | "no_bid" | "absent">("want_bid")
  const [proxyItems, setProxyItems] = useState<ItemKey[]>(["Album", "Puppet", "White", "RedBlack"])

  // Item config state initialized from current eventSessions
  const buildInitialForm = (evName: string, evDate: string): Record<ItemKey, ItemFormEntry> => {
    const result = {} as Record<ItemKey, ItemFormEntry>
    for (const k of ITEM_KEYS) {
      const found = initialSessions.find(
        (s) => s.event_name === evName && s.session_date === evDate && s.item_type === k
      )
      result[k] = {
        start_page: String(found?.start_page ?? 1),
        start_slot: String(found?.start_slot ?? 1),
        end_page: String(found?.end_page ?? 1),
        end_slot: String(found?.end_slot ?? 4),
        total_quantity: String(found?.total_quantity ?? 0),
        personal_limit: String(found?.personal_limit ?? 1),
      }
    }
    return result
  }

  const [itemForms, setItemForms] = useState<Record<ItemKey, ItemFormEntry>>(() =>
    buildInitialForm(defaultPair[0], defaultPair[1])
  )

  const handleSelectEventPreset = (val: string) => {
    if (!val) return
    const [en, ed] = val.split("|")
    setEventName(en)
    setEventDate(ed)
    setItemForms(buildInitialForm(en, ed))
    setCurrentPage(1)
  }

  const handleCoordChange = (key: ItemKey, field: keyof ItemFormEntry, val: string) => {
    setItemForms((prev) => {
      const updated = { ...prev[key], [field]: val }
      if (field === "start_page" || field === "start_slot" || field === "end_page" || field === "end_slot") {
        const sp = parseInt(updated.start_page)
        const ss = parseInt(updated.start_slot)
        const ep = parseInt(updated.end_page)
        const es = parseInt(updated.end_slot)
        if (!isNaN(sp) && !isNaN(ss) && !isNaN(ep) && !isNaN(es) && sp > 0 && ss >= 1 && ss <= 4 && ep > 0 && es >= 1 && es <= 4) {
          if (ep > sp || (ep === sp && es >= ss)) {
            updated.total_quantity = String((ep - sp) * 4 + (es - ss) + 1)
          } else {
            updated.total_quantity = "0"
          }
        }
      } else if (field === "total_quantity") {
        const tot = Math.max(0, parseInt(val) || 0)
        const sp = Math.max(1, parseInt(updated.start_page) || 1)
        const ss = Math.min(4, Math.max(1, parseInt(updated.start_slot) || 1))
        if (tot > 0) {
          const offset = ss - 1 + tot - 1
          updated.end_page = String(sp + Math.floor(offset / 4))
          updated.end_slot = String((offset % 4) + 1)
        }
      }
      return { ...prev, [key]: updated }
    })
  }

  // ข้อมูลที่กรองตาม Event ปัจจุบัน
  const currentAttendance = useMemo(
    () => initialAttendance.filter((a) => a.event_name === eventName && a.event_date === eventDate),
    [initialAttendance, eventName, eventDate]
  )

  const creditMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of initialCredits) {
      map[`${c.user_id}|${c.item_type}`] = c.credit || 0
    }
    return map
  }, [initialCredits])

  // เรียงลำดับคิว: want_bid มาก่อน -> แต้มรวม Carry Credit มากก่อน -> เวลาลงชื่อก่อน
  const sortedAttendance = useMemo(() => {
    const statusWeight: Record<string, number> = { want_bid: 0, no_bid: 1, absent: 2 }
    return [...currentAttendance].sort((a, b) => {
      const swA = statusWeight[a.status] ?? 9
      const swB = statusWeight[b.status] ?? 9
      if (swA !== swB) return swA - swB
      const totalCredA = ITEM_KEYS.reduce((acc, k) => acc + (creditMap[`${a.user_id}|${k}`] || 0), 0)
      const totalCredB = ITEM_KEYS.reduce((acc, k) => acc + (creditMap[`${b.user_id}|${k}`] || 0), 0)
      if (totalCredB !== totalCredA) return totalCredB - totalCredA
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [currentAttendance, creditMap])

  const currentSlots = useMemo(() => {
    return initialSlots.filter(
      (s) =>
        s.event_name === eventName &&
        s.session_date === eventDate &&
        (filterItem === "ALL" || s.item_type === filterItem)
    )
  }, [initialSlots, eventName, eventDate, filterItem])

  // จัดกลุ่มสล็อตเป็นหน้าละ 4 ช่อง (4 Slots per Page)
  const pagesList = useMemo(() => {
    const pageGroups: Record<number, any[]> = {}
    for (const s of currentSlots) {
      const p = Number(s.page_number) || 1
      if (!pageGroups[p]) pageGroups[p] = []
      pageGroups[p].push(s)
    }
    const sortedPageNums = Object.keys(pageGroups)
      .map(Number)
      .sort((a, b) => a - b)
    return sortedPageNums.map((pageNum) => ({
      pageNumber: pageNum,
      slots: pageGroups[pageNum].sort((a, b) => a.slot_number - b.slot_number),
    }))
  }, [currentSlots])

  const totalBoardPages = pagesList.length || 1
  const activePageObj = pagesList[Math.min(currentPage - 1, pagesList.length - 1)] || null

  // สร้างข้อความ Kafra Format (ตรงตามรูปที่ 3)
  const kafraAnnouncementText = useMemo(() => {
    const allEventSlots = initialSlots.filter(
      (s) => s.event_name === eventName && s.session_date === eventDate
    )
    if (allEventSlots.length === 0) return ""

    const overallMaxPage = Math.max(...allEventSlots.map((s) => Number(s.total_pages) || Number(s.page_number) || 1), 1)
    const byMember: Record<string, { name: string; discordId: string; pages: Record<number, number[]> }> = {}

    for (const s of allEventSlots) {
      const uid = s.user_id || s.id
      const name = s.profiles?.display_name || "Unknown"
      const discordId = s.profiles?.discord_id || ""
      if (!byMember[uid]) {
        byMember[uid] = { name, discordId, pages: {} }
      }
      const pg = Number(s.page_number) || 1
      const sl = Number(s.slot_number) || 1
      if (!byMember[uid].pages[pg]) byMember[uid].pages[pg] = []
      if (!byMember[uid].pages[pg].includes(sl)) {
        byMember[uid].pages[pg].push(sl)
      }
    }

    const blocks: string[] = []
    for (const info of Object.values(byMember)) {
      const pageLines = Object.keys(info.pages)
        .map(Number)
        .sort((a, b) => a - b)
        .map((pg) => {
          const slotsStr = info.pages[pg].sort((a, b) => a - b).join(", ")
          return `Page ${pg}/${overallMaxPage}: ${slotsStr}`
        })
      const mention = info.discordId ? `@${info.name} (<@${info.discordId}>)` : `@${info.name}`
      blocks.push(`${mention} | ${eventName}: ${eventDate}\n${pageLines.join("\n")}`)
    }

    return blocks.join("\n-----\n")
  }, [initialSlots, eventName, eventDate])

  async function callApi(payload: any, successMsg: string) {
    setBusy(true)
    setToast(null)
    try {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด")
      setToast({ type: "ok", text: successMsg })
      setTimeout(() => window.location.reload(), 700)
    } catch (e: any) {
      setToast({ type: "err", text: `❌ ${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  const handleSaveSessions = async () => {
    const items = ITEM_KEYS.map((k) => ({
      item_type: k,
      start_page: Number(itemForms[k].start_page) || 1,
      start_slot: Number(itemForms[k].start_slot) || 1,
      end_page: Number(itemForms[k].end_page) || 1,
      end_slot: Number(itemForms[k].end_slot) || 4,
      total_quantity: Number(itemForms[k].total_quantity) || 0,
      personal_limit: Number(itemForms[k].personal_limit) || 1,
    }))
    await callApi(
      { action: "save_sessions", event_name: eventName, session_date: eventDate, items },
      "✅ บันทึกพิกัดและจำนวนไอเทมทั้ง 4 ชนิดเรียบร้อยแล้ว!"
    )
  }

  const handleRunAllocation = async () => {
    // Save sessions first, then run allocation
    setBusy(true)
    setToast(null)
    try {
      const items = ITEM_KEYS.map((k) => ({
        item_type: k,
        start_page: Number(itemForms[k].start_page) || 1,
        start_slot: Number(itemForms[k].start_slot) || 1,
        end_page: Number(itemForms[k].end_page) || 1,
        end_slot: Number(itemForms[k].end_slot) || 4,
        total_quantity: Number(itemForms[k].total_quantity) || 0,
        personal_limit: Number(itemForms[k].personal_limit) || 1,
      }))
      await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_sessions", event_name: eventName, session_date: eventDate, items }),
      })

      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_allocation", event_name: eventName, session_date: eventDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "คำนวณไม่สำเร็จ")
      setToast({ type: "ok", text: `⚡ จัดสรรสล็อตสำเร็จทั้งหมด ${data.allocated_count} ช่อง!` })
      setTimeout(() => window.location.reload(), 800)
    } catch (e: any) {
      setToast({ type: "err", text: `❌ ${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  const handleProxyAdd = async () => {
    const member = members.find((m) => m.id === proxyUserId)
    if (!member) return
    await callApi(
      {
        action: "upsert_attendance",
        event_name: eventName,
        event_date: eventDate,
        user_id: member.id,
        discord_id: member.discord_id,
        status: proxyStatus,
        interested_items: proxyStatus === "want_bid" ? proxyItems : [],
      },
      `✅ เพิ่ม ${member.display_name} เข้าคิวเรียบร้อยแล้ว`
    )
  }

  const handleToggleMemberItem = async (att: any, itemKey: ItemKey) => {
    if (!isAdmin) return
    const current: string[] = Array.isArray(att.interested_items) ? att.interested_items : []
    const next = current.includes(itemKey)
      ? current.filter((x) => x !== itemKey)
      : [...current, itemKey]
    await callApi(
      {
        action: "upsert_attendance",
        event_name: eventName,
        event_date: eventDate,
        user_id: att.user_id,
        discord_id: att.discord_id,
        status: att.status,
        interested_items: next,
      },
      "✅ อัปเดตไอเทมที่ต้องการสำเร็จ"
    )
  }

  const handleStatusChange = async (att: any, newStatus: string) => {
    if (!isAdmin) return
    await callApi(
      {
        action: "upsert_attendance",
        event_name: eventName,
        event_date: eventDate,
        user_id: att.user_id,
        discord_id: att.discord_id,
        status: newStatus,
        interested_items: newStatus === "want_bid" ? (att.interested_items?.length ? att.interested_items : ITEM_KEYS) : [],
      },
      "✅ เปลี่ยนสถานะคิวสำเร็จ"
    )
  }

  const handleAdjustCredit = async (userId: string, itemType: ItemKey, delta: number) => {
    if (!isAdmin || !userId) return
    const cur = creditMap[`${userId}|${itemType}`] || 0
    const next = Math.max(0, cur + delta)
    await callApi(
      { action: "update_credit", user_id: userId, item_type: itemType, credit: next },
      `✅ ปรับยอดสะสม ${ITEMS_META[itemType].label} เป็น ${next} แต้ม`
    )
  }

  const handleSlotStatus = async (slotIds: string[], status: "allocated" | "awarded" | "skipped") => {
    if (!isAdmin || slotIds.length === 0) return
    await callApi(
      { action: "update_slot_status", slot_ids: slotIds, status },
      `✅ อัปเดตสถานะ ${slotIds.length} สล็อตเรียบร้อยแล้ว`
    )
  }

  return (
    <div className="space-y-6">
      {/* Header & Event Selector */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
              <span>🎯</span>
              <span>จัดคิวและกระดานสล็อต (4 ช่อง/หน้า)</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              ตั้งค่าพิกัดหน้า/ช่อง จัดลำดับคิวผู้เข้าร่วม และคำนวณสล็อตประมูลให้ตรงกับในเกม
            </p>
          </div>

          {/* Event & Date Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {existingEvents.length > 0 && (
              <select
                value={`${eventName}|${eventDate}`}
                onChange={(e) => handleSelectEventPreset(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-purple-300 font-semibold focus:outline-none focus:border-purple-500"
              >
                {existingEvents.map((ev) => {
                  const [en, ed] = ev.split("|")
                  return (
                    <option key={ev} value={ev}>
                      📌 {en} ({ed})
                    </option>
                  )
                })}
              </select>
            )}
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="ชื่ออีเวนต์ เช่น Emperium Overrun"
              className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div
            className={`mt-4 px-4 py-3 rounded-xl text-sm font-semibold border ${
              toast.type === "ok"
                ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                : "bg-rose-950/60 border-rose-700/60 text-rose-300"
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* Sub-navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "board", label: `🎯 กระดานสล็อต 4 ช่อง (${currentSlots.length})` },
              { id: "queue", label: `👥 จัดการคิวผู้เข้าร่วม (${currentAttendance.length})` },
              { id: "config", label: "⚙️ ตั้งค่าพิกัดไอเทม & ลิมิต" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  activeTab === t.id
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/40"
                    : "bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {isAdmin && (
            <button
              onClick={handleRunAllocation}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-sm shadow-lg shadow-orange-900/40 transition-all disabled:opacity-50 cursor-pointer"
            >
              {busy ? "⏳ กำลังคำนวณ..." : "⚡ คำนวณและจัดสรรสล็อตใหม่"}
            </button>
          )}
        </div>
      </div>

      {/* ─── TAB 1: กระดานสล็อต 4 ช่อง/หน้า (4-SLOT BOARD) ─────────────────────── */}
      {activeTab === "board" && (
        <div className="space-y-6">
          {/* Item Filter + Page Controls */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setFilterItem("ALL"); setCurrentPage(1) }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterItem === "ALL" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                ทั้งหมด ({initialSlots.filter((s) => s.event_name === eventName && s.session_date === eventDate).length})
              </button>
              {ITEM_KEYS.map((k) => {
                const count = initialSlots.filter(
                  (s) => s.event_name === eventName && s.session_date === eventDate && s.item_type === k
                ).length
                return (
                  <button
                    key={k}
                    onClick={() => { setFilterItem(k); setCurrentPage(1) }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterItem === k ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {ITEMS_META[k].icon} {ITEMS_META[k].label} ({count})
                  </button>
                )
              })}
            </div>

            {/* Batch Actions */}
            {isAdmin && selectedSlotIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-300 font-semibold">เลือก {selectedSlotIds.size} ช่อง:</span>
                <button
                  onClick={() => handleSlotStatus(Array.from(selectedSlotIds), "awarded")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  ✅ มอบของที่เลือก
                </button>
                <button
                  onClick={() => handleSlotStatus(Array.from(selectedSlotIds), "skipped")}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                >
                  ⏭️ ข้ามคิว
                </button>
                <button
                  onClick={() => setSelectedSlotIds(new Set())}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs cursor-pointer"
                >
                  ล้าง
                </button>
              </div>
            )}
          </div>

          {/* 4-Slot In-Game Page View */}
          {pagesList.length === 0 ? (
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-16 text-center space-y-4">
              <div className="text-5xl">🎲</div>
              <div className="text-lg font-bold text-white">ยังไม่มีสล็อตที่ถูกจัดสรรสำหรับอีเวนต์นี้</div>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                ไปที่แท็บ <b>"⚙️ ตั้งค่าพิกัดไอเทม & ลิมิต"</b> เพื่อระบุจำนวนของและลิมิต จากนั้นกดปุ่ม <b>"⚡ คำนวณและจัดสรรสล็อตใหม่"</b>
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Page Navigation Bar */}
              <div className="flex items-center justify-between bg-slate-900/90 rounded-2xl border border-slate-800 px-5 py-3">
                <div className="text-sm font-bold text-white">
                  📖 หน้าในเกม (In-Game Page):{" "}
                  <span className="text-purple-400 font-mono text-base">
                    Page {activePageObj?.pageNumber} / {activePageObj?.slots[0]?.total_pages || totalBoardPages}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                  >
                    ← หน้าก่อน
                  </button>
                  <span className="text-xs text-slate-400 font-mono px-2">
                    หน้าที่ {currentPage} จาก {pagesList.length} หน้าที่มีของ
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(pagesList.length, p + 1))}
                    disabled={currentPage >= pagesList.length}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                  >
                    หน้าถัดไป →
                  </button>
                </div>
              </div>

              {/* 4 Slots Grid (1 Page = 4 Slots) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((slotNum) => {
                  const slotData = activePageObj?.slots.find((s: any) => Number(s.slot_number) === slotNum)
                  if (!slotData) {
                    return (
                      <div
                        key={slotNum}
                        className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-5 flex flex-col items-center justify-center min-h-48 text-slate-600"
                      >
                        <div className="text-xs font-mono mb-1">
                          Page {activePageObj?.pageNumber} • ช่องที่ {slotNum}
                        </div>
                        <div className="text-sm font-semibold">--- ช่องว่าง ---</div>
                      </div>
                    )
                  }

                  const meta = ITEMS_META[slotData.item_type as ItemKey] || ITEMS_META.Album
                  const isSelected = selectedSlotIds.has(slotData.id)

                  return (
                    <div
                      key={slotData.id}
                      className={`rounded-2xl border p-5 bg-gradient-to-br ${meta.gradient} ${
                        isSelected ? "border-purple-400 ring-2 ring-purple-500/40" : meta.border
                      } flex flex-col justify-between shadow-xl transition-all`}
                    >
                      <div>
                        {/* Top badge row */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-2.5 py-1 rounded-lg bg-black/40 text-white font-mono text-xs font-bold">
                            Page {slotData.page_number}/{slotData.total_pages} • ช่อง {slotData.slot_number}
                          </span>
                          {isAdmin && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedSlotIds)
                                if (e.target.checked) next.add(slotData.id)
                                else next.delete(slotData.id)
                                setSelectedSlotIds(next)
                              }}
                              className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                            />
                          )}
                        </div>

                        {/* Item Badge */}
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-2xl">{meta.icon}</span>
                          <div>
                            <div className="text-xs font-bold text-white">{meta.label}</div>
                            <div className="text-[11px] text-slate-400">ONLY BID ตามช่องที่กำหนด</div>
                          </div>
                        </div>

                        {/* Assigned Member */}
                        <div className="bg-black/30 rounded-xl p-3 border border-white/10 mb-4">
                          <div className="text-[11px] text-slate-400">ผู้ได้รับสิทธิ์ประมูล:</div>
                          <div className="text-base font-extrabold text-white truncate mt-0.5">
                            {slotData.profiles?.display_name || "ไม่ทราบชื่อ"}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                            <span>
                              {slotData.profiles?.job_class
                                ? `${JOB_EMOJI[slotData.profiles.job_class] || "⚔️"} ${slotData.profiles.job_class}`
                                : "ไม่ระบุอาชีพ"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status & Quick Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            slotData.status === "awarded"
                              ? "bg-emerald-950/90 text-emerald-300 border border-emerald-700/50"
                              : slotData.status === "skipped"
                              ? "bg-rose-950/90 text-rose-300 border border-rose-700/50"
                              : "bg-amber-950/90 text-amber-300 border border-amber-700/50"
                          }`}
                        >
                          {slotData.status === "awarded"
                            ? "✅ ประมูลสำเร็จ"
                            : slotData.status === "skipped"
                            ? "⏭️ ข้ามคิว"
                            : "⏳ รอประมูล"}
                        </span>

                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            {slotData.status !== "awarded" && (
                              <button
                                onClick={() => handleSlotStatus([slotData.id], "awarded")}
                                disabled={busy}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                                title="บันทึกว่าได้รับของแล้ว"
                              >
                                🎁 ได้ของ
                              </button>
                            )}
                            {slotData.status !== "allocated" && (
                              <button
                                onClick={() => handleSlotStatus([slotData.id], "allocated")}
                                disabled={busy}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                                title="รีเซ็ตสถานะ"
                              >
                                ↩️
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Kafra Discord Announcement Box (Matches Image 3) */}
              {kafraAnnouncementText && (
                <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                  <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
                    <div className="font-bold text-white text-sm flex items-center gap-2">
                      <span>📢</span>
                      <span>ข้อความสรุปพิกัดบิดรายบุคคล (รูปแบบ Kafra สำหรับส่งใน Discord)</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(kafraAnnouncementText)
                        setToast({ type: "ok", text: "📋 คัดลอกข้อความรูปแบบ Kafra ลง Clipboard แล้ว!" })
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      📋 คัดลอกข้อความ
                    </button>
                  </div>
                  <pre className="p-5 text-xs font-mono text-slate-200 bg-slate-950/70 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-80">
                    {kafraAnnouncementText}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: จัดการคิวผู้เข้าร่วม (QUEUE & ATTENDANCE MANAGER) ────────── */}
      {activeTab === "queue" && (
        <div className="space-y-6">
          {/* Admin Proxy Add Form */}
          {isAdmin && (
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl">
              <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                <span>➕</span>
                <span>ดึงสมาชิกเข้าคิว / ลงชื่อแทนสมาชิก (Proxy Queue)</span>
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-52 flex-1">
                  <label className="block text-xs text-slate-400 mb-1">เลือกสมาชิก</label>
                  <select
                    value={proxyUserId}
                    onChange={(e) => setProxyUserId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- เลือกสมาชิกในกิลด์ --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name} ({m.job_class || "ไม่ระบุอาชีพ"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">สถานะการเข้าร่วม</label>
                  <select
                    value={proxyStatus}
                    onChange={(e) => setProxyStatus(e.target.value as any)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="want_bid">🎮 Join the war / Want to bid</option>
                    <option value="no_bid">🚫 Join the war / Do not want to bid</option>
                    <option value="absent">⛔ Unable to attend</option>
                  </select>
                </div>

                {proxyStatus === "want_bid" && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">ไอเทมที่ต้องการประมูล</label>
                    <div className="flex gap-1.5">
                      {ITEM_KEYS.map((k) => {
                        const active = proxyItems.includes(k)
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() =>
                              setProxyItems((prev) =>
                                prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
                              )
                            }
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              active
                                ? "bg-purple-600/30 border-purple-500 text-white"
                                : "bg-slate-800 border-slate-700 text-slate-500"
                            }`}
                          >
                            {ITEMS_META[k].icon} {ITEMS_META[k].label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleProxyAdd}
                  disabled={!proxyUserId || busy}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-sm font-bold cursor-pointer"
                >
                  ➕ บันทึกเข้าคิว
                </button>
              </div>
            </div>
          )}

          {/* Attendance & Queue Order Table */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">📋 ลำดับคิวผู้เข้าร่วม ({sortedAttendance.length} คน)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  คนที่มียอดค้างสะสม (Credit) สูงกว่าจะได้รับสิทธิ์จัดสรรเศษสล็อตก่อนอัตโนมัติ (คลิกปุ่มไอเทมเพื่อสลับความต้องการได้ทันที)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 text-left">
                    <th className="px-4 py-3 font-semibold text-center w-14">คิวที่</th>
                    <th className="px-4 py-3 font-semibold">สมาชิก</th>
                    <th className="px-4 py-3 font-semibold">สถานะ</th>
                    <th className="px-4 py-3 font-semibold">ไอเทมที่ต้องการประมูล (คลิกเพื่อเปิด/ปิด)</th>
                    <th className="px-4 py-3 font-semibold text-center">ปรับแต้มลัดคิว (Carry Credit)</th>
                    {isAdmin && <th className="px-4 py-3 font-semibold text-right">จัดการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {sortedAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-slate-500 py-12">
                        ยังไม่มีผู้ลงชื่อในอีเวนต์นี้ (สามารถกดเพิ่มจากด้านบน หรือเปิดโพลผ่านบอท /event_poll)
                      </td>
                    </tr>
                  ) : (
                    sortedAttendance.map((att, idx) => {
                      const items: string[] = Array.isArray(att.interested_items) ? att.interested_items : []
                      return (
                        <tr key={att.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-purple-400">
                            #{idx + 1}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-white">
                              {att.profiles?.display_name || "ไม่ทราบชื่อ"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {att.profiles?.job_class
                                ? `${JOB_EMOJI[att.profiles.job_class] || "⚔️"} ${att.profiles.job_class}`
                                : "ไม่ระบุอาชีพ"}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {isAdmin ? (
                              <select
                                value={att.status}
                                onChange={(e) => handleStatusChange(att, e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
                              >
                                <option value="want_bid">🎮 Want to bid</option>
                                <option value="no_bid">🚫 Do not bid (Credit)</option>
                                <option value="absent">⛔ Unable to attend</option>
                              </select>
                            ) : (
                              <span className="text-xs font-semibold text-slate-300">{att.status}</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {att.status === "want_bid" ? (
                              <div className="flex flex-wrap gap-1.5">
                                {ITEM_KEYS.map((k) => {
                                  const active = items.includes(k)
                                  return (
                                    <button
                                      key={k}
                                      onClick={() => handleToggleMemberItem(att, k)}
                                      disabled={!isAdmin || busy}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                        active
                                          ? ITEMS_META[k].badge
                                          : "bg-slate-900 border-slate-800 text-slate-600 opacity-60"
                                      }`}
                                    >
                                      {ITEMS_META[k].icon} {ITEMS_META[k].label}
                                    </button>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600">— ไม่ประมูลในรอบนี้ —</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              {ITEM_KEYS.map((k) => {
                                const cVal = creditMap[`${att.user_id}|${k}`] || 0
                                return (
                                  <div
                                    key={k}
                                    className="inline-flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded-lg px-2 py-1 text-xs"
                                    title={`Carry Credit: ${ITEMS_META[k].label}`}
                                  >
                                    <span>{ITEMS_META[k].icon}</span>
                                    <span className="font-mono font-bold text-amber-400">{cVal}</span>
                                    {isAdmin && (
                                      <div className="flex items-center gap-0.5 ml-1">
                                        <button
                                          onClick={() => handleAdjustCredit(att.user_id, k, -1)}
                                          className="w-4 h-4 rounded bg-slate-700 hover:bg-rose-600 text-white flex items-center justify-center text-[10px] cursor-pointer"
                                        >
                                          -
                                        </button>
                                        <button
                                          onClick={() => handleAdjustCredit(att.user_id, k, 1)}
                                          className="w-4 h-4 rounded bg-slate-700 hover:bg-emerald-600 text-white flex items-center justify-center text-[10px] cursor-pointer"
                                        >
                                          +
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() =>
                                  callApi({ action: "delete_attendance", id: att.id }, "🗑️ ลบคิวเรียบร้อยแล้ว")
                                }
                                className="text-xs font-semibold text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-600 border border-rose-800/50 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                              >
                                🗑️ ลบ
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: ตั้งค่าพิกัดไอเทม & ลิมิต (4 ITEMS CONFIGURATOR) ──────────── */}
      {activeTab === "config" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {ITEM_KEYS.map((key) => {
              const meta = ITEMS_META[key]
              const form = itemForms[key]
              return (
                <div
                  key={key}
                  className={`rounded-2xl border ${meta.border} bg-gradient-to-br ${meta.gradient} p-6 shadow-xl space-y-4`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{meta.icon}</span>
                      <div>
                        <h3 className="text-lg font-extrabold text-white">{meta.label}</h3>
                        <p className="text-xs text-slate-400">{meta.desc}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">จำนวนรวม</div>
                      <div className="text-2xl font-black font-mono text-white">
                        {form.total_quantity || 0} <span className="text-xs font-normal text-slate-400">ชิ้น</span>
                      </div>
                    </div>
                  </div>

                  {/* Option 1: Start/End Page & Slot */}
                  <div className="bg-black/30 rounded-xl p-4 border border-white/10 space-y-3">
                    <div className="text-xs font-bold text-purple-300">
                      📍 วิธีที่ 1: ระบุพิกัดหน้าและช่องในเกม (1 หน้ามี 4 ช่อง)
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">เริ่มต้น (หน้า / ช่อง 1-4)</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            disabled={!isAdmin}
                            value={form.start_page}
                            onChange={(e) => handleCoordChange(key, "start_page", e.target.value)}
                            placeholder="หน้า"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-center font-mono text-sm text-white"
                          />
                          <span className="text-slate-500">:</span>
                          <input
                            type="number"
                            min={1}
                            max={4}
                            disabled={!isAdmin}
                            value={form.start_slot}
                            onChange={(e) => handleCoordChange(key, "start_slot", e.target.value)}
                            placeholder="ช่อง"
                            className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-center font-mono text-sm text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">สิ้นสุด (หน้า / ช่อง 1-4)</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            disabled={!isAdmin}
                            value={form.end_page}
                            onChange={(e) => handleCoordChange(key, "end_page", e.target.value)}
                            placeholder="หน้า"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-center font-mono text-sm text-white"
                          />
                          <span className="text-slate-500">:</span>
                          <input
                            type="number"
                            min={1}
                            max={4}
                            disabled={!isAdmin}
                            value={form.end_slot}
                            onChange={(e) => handleCoordChange(key, "end_slot", e.target.value)}
                            placeholder="ช่อง"
                            className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-center font-mono text-sm text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Direct Quantity & Limit */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/30 rounded-xl p-3.5 border border-white/10">
                      <label className="block text-xs font-bold text-amber-300 mb-1">
                        🔢 วิธีที่ 2: จำนวนชิ้นรวมโดยตรง
                      </label>
                      <input
                        type="number"
                        min={0}
                        disabled={!isAdmin}
                        value={form.total_quantity}
                        onChange={(e) => handleCoordChange(key, "total_quantity", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-center font-mono text-lg font-extrabold text-white"
                      />
                    </div>

                    <div className="bg-black/30 rounded-xl p-3.5 border border-white/10">
                      <label className="block text-xs font-bold text-emerald-300 mb-1">
                        👤 ลิมิตประมูลต่อคน (Limit)
                      </label>
                      <input
                        type="number"
                        min={1}
                        disabled={!isAdmin}
                        value={form.personal_limit}
                        onChange={(e) => handleCoordChange(key, "personal_limit", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-center font-mono text-lg font-extrabold text-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {isAdmin && (
            <div className="flex justify-end gap-3">
              <button
                onClick={handleSaveSessions}
                disabled={busy}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all cursor-pointer"
              >
                💾 บันทึกเฉพาะค่าไอเทม
              </button>
              <button
                onClick={handleRunAllocation}
                disabled={busy}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-purple-900/40 transition-all cursor-pointer"
              >
                ⚡ บันทึกและคำนวณจัดสรรสล็อตทันที
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
