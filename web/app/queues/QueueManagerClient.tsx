"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useMutation } from "@tanstack/react-query"

type ItemKey = "Album" | "Puppet" | "White" | "RedBlack"

const ITEMS_META: Record<
  ItemKey,
  {
    label: string
    desc: string
    badge: string
    icon: string
    color: string
    border: string
  }
> = {
  Album: {
    label: "สมุดการ์ด",
    desc: "สมุดเลือกการ์ดส้ม / การ์ดบอสปลอม",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60",
    icon: "/auction/Puppet.png",
    color: "from-purple-500/20 to-indigo-500/10",
    border: "border-purple-300 dark:border-purple-800/50",
  },
  Puppet: {
    label: "เศษการ์ดบอส",
    desc: "เศษการ์ดบอสปลอมสำหรับสะสม",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60",
    icon: "/auction/Illusion.png",
    color: "from-amber-500/20 to-orange-500/10",
    border: "border-amber-300 dark:border-amber-800/50",
  },
  White: {
    label: "ขนนกขาว",
    desc: "ขนนกขาวเกรดอัปเกรดสเตตัส",
    badge: "bg-sky-100 text-sky-800 dark:bg-zinc-800 dark:text-zinc-200 border border-sky-200 dark:border-zinc-600",
    icon: "/auction/Light-Dark Opt.Chest.png",
    color: "from-sky-500/20 to-blue-500/10",
    border: "border-sky-300 dark:border-sky-800/50",
  },
  RedBlack: {
    label: "ขนนกดำแดง",
    desc: "ขนนกแดง/ดำสเตตัสขั้นสูง",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60",
    icon: "/auction/Time-Space Opt.Chest.png",
    color: "from-red-500/20 to-rose-500/10",
    border: "border-rose-300 dark:border-rose-800/50",
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramEvent = searchParams.get("event")
  const paramDate = searchParams.get("date")
  const todayStr = new Date().toISOString().split("T")[0]

  // Local state for dynamic data (prevents full-page reloads and white flashes)
  const [sessions, setSessions] = useState(initialSessions)
  const [slots, setSlots] = useState(initialSlots)
  const [attendance, setAttendance] = useState(initialAttendance)
  const [credits, setCredits] = useState(initialCredits)

  useEffect(() => { setSessions(initialSessions) }, [initialSessions])
  useEffect(() => { setSlots(initialSlots) }, [initialSlots])
  useEffect(() => { setAttendance(initialAttendance) }, [initialAttendance])
  useEffect(() => { setCredits(initialCredits) }, [initialCredits])

  const existingEvents = useMemo(() => {
    const set = new Set<string>()
    for (const a of attendance) {
      if (a.event_name && a.event_date) set.add(`${a.event_name}|${a.event_date}`)
    }
    return Array.from(set)
  }, [attendance])

  const defaultPair = useMemo(() => {
    if (paramEvent) {
      return [paramEvent, paramDate || todayStr]
    }
    return existingEvents[0] ? existingEvents[0].split("|") : ["", todayStr]
  }, [paramEvent, paramDate, existingEvents, todayStr])

  const [eventName, setEventName] = useState(defaultPair[0] || "")
  const [eventDate, setEventDate] = useState(defaultPair[1] || todayStr)

  useEffect(() => {
    if (paramEvent) {
      setEventName(paramEvent)
      if (paramDate) setEventDate(paramDate)
    }
  }, [paramEvent, paramDate])
  const [activeTab, setActiveTab] = useState<"board" | "queue" | "config">("board")
  const [filterItem, setFilterItem] = useState<"ALL" | ItemKey>("ALL")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showSaveHistoryModal, setShowSaveHistoryModal] = useState(false)

  // Proxy add member state
  const [proxyUserId, setProxyUserId] = useState("")
  const [proxyStatus, setProxyStatus] = useState<"want_bid" | "no_bid" | "absent">("want_bid")
  const [proxyItems, setProxyItems] = useState<ItemKey[]>(["Album", "Puppet", "White", "RedBlack"])

  const buildInitialForm = (evName: string, evDate: string): Record<ItemKey, ItemFormEntry> => {
    const result = {} as Record<ItemKey, ItemFormEntry>
    for (const k of ITEM_KEYS) {
      const found = sessions.find(
        (s) => s.event_name === evName && s.session_date === evDate && s.item_type === k
      )
      const tot = found?.total_quantity ?? 0
      result[k] = {
        start_page: String(tot === 0 ? 0 : found?.start_page ?? 1),
        start_slot: String(tot === 0 ? 0 : found?.start_slot ?? 1),
        end_page: String(tot === 0 ? 0 : found?.end_page ?? 1),
        end_slot: String(tot === 0 ? 0 : found?.end_slot ?? 4),
        total_quantity: String(tot),
        personal_limit: String(found?.personal_limit ?? 1),
      }
    }
    return result
  }

  const [autoLinkCoords, setAutoLinkCoords] = useState(true)

  const computeNextSlot = (page: number, slot: number): { page: number; slot: number } => {
    const p = Math.max(1, page || 1)
    const s = Math.min(4, Math.max(1, slot || 1))
    if (s < 4) return { page: p, slot: s + 1 }
    return { page: p + 1, slot: 1 }
  }

  const computeEndSlot = (
    startPage: number,
    startSlot: number,
    totalQty: number
  ): { page: number; slot: number } => {
    const tot = Math.max(0, totalQty || 0)
    if (tot <= 0 || startPage <= 0) return { page: 0, slot: 0 }
    const sp = Math.max(1, startPage || 1)
    const ss = Math.min(4, Math.max(1, startSlot || 1))
    const offset = ss - 1 + tot - 1
    return {
      page: sp + Math.floor(offset / 4),
      slot: (offset % 4) + 1,
    }
  }

  const computeQty = (
    startPage: number,
    startSlot: number,
    endPage: number,
    endSlot: number
  ): number => {
    if (startPage <= 0 || endPage <= 0) return 0
    if (endPage < startPage || (endPage === startPage && endSlot < startSlot)) return 0
    return (endPage - startPage) * 4 + (endSlot - startSlot) + 1
  }

  const recalculateContinuousChain = (
    forms: Record<ItemKey, ItemFormEntry>
  ): Record<ItemKey, ItemFormEntry> => {
    const nextForms = { ...forms }
    let curStartPage = 1
    let curStartSlot = 1

    const firstNonZero = ITEM_KEYS.find((k) => (parseInt(nextForms[k]?.total_quantity) || 0) > 0)
    if (firstNonZero) {
      curStartPage = Math.max(1, parseInt(nextForms[firstNonZero]?.start_page) || 1)
      curStartSlot = Math.min(4, Math.max(1, parseInt(nextForms[firstNonZero]?.start_slot) || 1))
    }

    for (const k of ITEM_KEYS) {
      const cur = { ...nextForms[k] }
      const tot = Math.max(0, parseInt(cur.total_quantity) || 0)

      if (tot > 0) {
        cur.start_page = String(curStartPage)
        cur.start_slot = String(curStartSlot)
        const end = computeEndSlot(curStartPage, curStartSlot, tot)
        cur.end_page = String(end.page)
        cur.end_slot = String(end.slot)

        const next = computeNextSlot(end.page, end.slot)
        curStartPage = next.page
        curStartSlot = next.slot
      } else {
        cur.start_page = "0"
        cur.start_slot = "0"
        cur.end_page = "0"
        cur.end_slot = "0"
      }

      nextForms[k] = cur
    }

    return nextForms
  }

  const [itemForms, setItemForms] = useState<Record<ItemKey, ItemFormEntry>>(() => {
    const raw = buildInitialForm(defaultPair[0], defaultPair[1])
    return recalculateContinuousChain(raw)
  })

  const handleSelectEventPreset = (val: string) => {
    if (!val) return
    const [en, ed] = val.split("|")
    setEventName(en)
    setEventDate(ed)
    const initial = buildInitialForm(en, ed)
    setItemForms(autoLinkCoords ? recalculateContinuousChain(initial) : initial)
    setCurrentPage(1)
    setConfirmDelete(false)
  }

  const handleCoordChange = (key: ItemKey, field: keyof ItemFormEntry, val: string) => {
    setItemForms((prev) => {
      const updated = { ...prev, [key]: { ...prev[key], [field]: val } }

      if (field === "personal_limit") {
        return updated
      }

      if (field === "total_quantity") {
        const tot = Math.max(0, parseInt(val) || 0)
        if (tot === 0) {
          updated[key].start_page = "0"
          updated[key].start_slot = "0"
          updated[key].end_page = "0"
          updated[key].end_slot = "0"
        } else {
          let sp = parseInt(updated[key].start_page) || 1
          if (sp === 0) sp = 1
          let ss = parseInt(updated[key].start_slot) || 1
          if (ss === 0) ss = 1
          const end = computeEndSlot(sp, ss, tot)
          updated[key].start_page = String(sp)
          updated[key].start_slot = String(ss)
          updated[key].end_page = String(end.page)
          updated[key].end_slot = String(end.slot)
        }
      } else if (field === "end_page" || field === "end_slot") {
        const sp = parseInt(updated[key].start_page) || 0
        const ss = parseInt(updated[key].start_slot) || 0
        const ep = parseInt(field === "end_page" ? val : updated[key].end_page) || 0
        const es = parseInt(field === "end_slot" ? val : updated[key].end_slot) || 0
        if (sp <= 0 || ep <= 0) {
          updated[key].total_quantity = "0"
        } else {
          const tot = computeQty(sp, ss, ep, es)
          updated[key].total_quantity = String(tot)
        }
      } else if (field === "start_page" || field === "start_slot") {
        const sp = parseInt(field === "start_page" ? val : updated[key].start_page) || 0
        const ss = parseInt(field === "start_slot" ? val : updated[key].start_slot) || 0
        if (sp <= 0) {
          updated[key].start_page = "0"
          updated[key].start_slot = "0"
          updated[key].end_page = "0"
          updated[key].end_slot = "0"
          updated[key].total_quantity = "0"
        } else {
          const tot = Math.max(0, parseInt(updated[key].total_quantity) || 0)
          const end = computeEndSlot(sp, ss, tot)
          updated[key].end_page = String(end.page)
          updated[key].end_slot = String(end.slot)
        }
      }

      if (autoLinkCoords) {
        return recalculateContinuousChain(updated)
      }

      return updated
    })
  }

  // สถานะการปิดโหวตของรอบที่เลือก
  const isPollClosed = useMemo(() => {
    const rows = sessions.filter((s) => s.event_name === eventName && s.session_date === eventDate)
    if (rows.length === 0) return false
    return rows.every((r) => r.status === "closed")
  }, [sessions, eventName, eventDate])

  // ข้อมูลที่กรองตาม Event ปัจจุบัน
  const currentAttendance = useMemo(
    () => attendance.filter((a) => a.event_name === eventName && a.event_date === eventDate),
    [attendance, eventName, eventDate]
  )

  const wantBidMembers = useMemo(
    () => currentAttendance.filter((a) => a.status === "want_bid"),
    [currentAttendance]
  )

  // ตรวจสอบความพร้อม: การโหวตสิ้นสุดแล้ว (isPollClosed) และโหมด Bench ลงตัวแล้ว (มีคนต้องการประมูล)
  const isBenchReady = useMemo(() => {
    return isPollClosed && currentAttendance.length > 0 && wantBidMembers.length > 0
  }, [isPollClosed, currentAttendance, wantBidMembers])

  const creditMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of credits) {
      map[`${c.user_id}|${c.item_type}`] = c.credit || 0
    }
    return map
  }, [credits])

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
      const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (timeDiff !== 0) return timeDiff
      return (a.id || "").localeCompare(b.id || "")
    })
  }, [currentAttendance, creditMap])

  // รายชื่อสมาชิกที่ยังไม่ได้ลงชื่อในอีเวนต์นี้ (สำหรับดึงเข้าคิวแทน)
  const availableMembersForProxy = useMemo(() => {
    const attendedUserIds = new Set((currentAttendance || []).map((a) => a.user_id))
    return members.filter((m) => !attendedUserIds.has(m.id))
  }, [members, currentAttendance])

  const currentSlots = useMemo(() => {
    return slots.filter(
      (s) =>
        s.event_name === eventName &&
        s.session_date === eventDate &&
        (filterItem === "ALL" || s.item_type === filterItem)
    )
  }, [slots, eventName, eventDate, filterItem])

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

  // สร้างข้อความ Kafra Format
  const kafraAnnouncementText = useMemo(() => {
    const allEventSlots = slots.filter(
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
  }, [slots, eventName, eventDate])

  async function refreshData(evName = eventName, evDate = eventDate) {
    try {
      const res = await fetch(
        `/api/queues?event_name=${encodeURIComponent(evName)}&session_date=${encodeURIComponent(evDate)}`
      )
      if (res.ok) {
        const data = await res.json()
        if (data.sessions) setSessions(data.sessions)
        if (data.slots) setSlots(data.slots)
        if (data.attendance) setAttendance(data.attendance)
        if (data.credits) setCredits(data.credits)
      }
    } catch (err) {
      console.error("refreshData error", err)
    }
  }

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
      await refreshData()
      router.refresh()
    } catch (e: any) {
      setToast({ type: "err", text: `${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  const handleTogglePollStatus = async () => {
    const nextStatus = isPollClosed ? "active" : "closed"
    const msg = nextStatus === "closed" ? "ปิดโหวตเรียบร้อยแล้ว" : "เปิดโหวตอีกครั้งเรียบร้อยแล้ว"
    // Optimistic update
    setSessions((prev) =>
      prev.map((s) =>
        s.event_name === eventName && s.session_date === eventDate
          ? { ...s, status: nextStatus }
          : s
      )
    )
    await callApi(
      { action: "set_poll_status", event_name: eventName, session_date: eventDate, status: nextStatus },
      msg
    )
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
      "บันทึกพิกัดและจำนวนไอเทมทั้ง 4 ชนิดเรียบร้อยแล้ว"
    )
  }

  const handleRunAllocation = async () => {
    if (!isPollClosed) {
      setToast({
        type: "err",
        text: "ไม่สามารถจัดคิวหรือจัดสล็อตได้: การโหวตยังไม่สิ้นสุด กรุณาไปที่ Bench Organizer เพื่อตรวจเช็กผังคนและปิดโหวตก่อน",
      })
      return
    }
    if (currentAttendance.length === 0 || wantBidMembers.length === 0) {
      setToast({
        type: "err",
        text: "ไม่สามารถจัดคิวหรือจัดสล็อตได้: โหมด Bench ยังไม่ลงตัว กรุณาจัดผังคนใน Bench Organizer ให้เรียบร้อยก่อน",
      })
      return
    }

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
      setToast({ type: "ok", text: `จัดสรรสล็อตสำเร็จทั้งหมด ${data.allocated_count} ช่อง` })
      await refreshData()
      router.refresh()
    } catch (e: any) {
      setToast({ type: "err", text: `${e.message}` })
    } finally {
      setBusy(false)
    }
  }

  const handleSaveRoundToHistory = async () => {
    if (!isAdmin) return
    setBusy(true)
    setToast(null)
    try {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_round_history",
          event_name: eventName,
          session_date: eventDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึกประวัติ")

      // Optimistically update all non-skipped slots to awarded
      setSlots((prev) =>
        prev.map((s) =>
          s.event_name === eventName && s.session_date === eventDate && s.status !== "skipped"
            ? { ...s, status: "awarded" }
            : s
        )
      )

      setShowSaveHistoryModal(false)
      setToast({
        type: "ok",
        text: `บันทึกเป็นประวัติการประมูลเรียบร้อยแล้ว (${data.saved_count} รายการใหม่ จากทั้งหมด ${data.total_awarded} ช่อง)`,
      })
      await refreshData()
      router.refresh()
    } catch (e: any) {
      setToast({ type: "err", text: e.message })
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteEvent = async () => {
    await callApi(
      { action: "delete_event", event_name: eventName, session_date: eventDate },
      `ลบรอบ "${eventName}" (${eventDate}) เรียบร้อยแล้ว`
    )
    setConfirmDelete(false)
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
      `เพิ่ม ${member.display_name} เข้าคิวเรียบร้อยแล้ว`
    )
    setProxyUserId("")
  }

  // TanStack Query Mutation: Toggle Member Item (Super smooth optimistic update, zero lag, no button disable freeze)
  const toggleMemberItemMutation = useMutation({
    mutationFn: async ({ att, nextItems }: { att: any; nextItems: string[] }) => {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_attendance",
          event_name: eventName,
          event_date: eventDate,
          user_id: att.user_id,
          discord_id: att.discord_id,
          status: att.status,
          interested_items: nextItems,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึก")
      }
      return res.json()
    },
    onMutate: async ({ att, nextItems }) => {
      // Instant 0ms update in UI state
      setAttendance((prev) =>
        prev.map((a) => (a.id === att.id ? { ...a, interested_items: nextItems } : a))
      )
    },
    onError: (err) => {
      setToast({ type: "err", text: `เกิดข้อผิดพลาด: ${err.message}` })
      refreshData()
    },
    onSuccess: () => {
      router.refresh()
    },
  })

  const handleToggleMemberItem = (att: any, itemKey: ItemKey) => {
    if (!isAdmin) return
    const current: string[] = Array.isArray(att.interested_items) ? att.interested_items : []
    const next = current.includes(itemKey)
      ? current.filter((x) => x !== itemKey)
      : [...current, itemKey]

    toggleMemberItemMutation.mutate({ att, nextItems: next })
  }

  // TanStack Query Mutation: Status Change (want_bid / no_bid / absent)
  const statusChangeMutation = useMutation({
    mutationFn: async ({
      att,
      newStatus,
      nextItems,
    }: {
      att: any
      newStatus: string
      nextItems: string[]
    }) => {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_attendance",
          event_name: eventName,
          event_date: eventDate,
          user_id: att.user_id,
          discord_id: att.discord_id,
          status: newStatus,
          interested_items: nextItems,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "เกิดข้อผิดพลาดในการเปลี่ยนสถานะ")
      }
      return res.json()
    },
    onMutate: async ({ att, newStatus, nextItems }) => {
      setAttendance((prev) =>
        prev.map((a) => (a.id === att.id ? { ...a, status: newStatus, interested_items: nextItems } : a))
      )
    },
    onError: (err) => {
      setToast({ type: "err", text: `เกิดข้อผิดพลาด: ${err.message}` })
      refreshData()
    },
    onSuccess: () => {
      router.refresh()
    },
  })

  const handleStatusChange = (att: any, newStatus: string) => {
    if (!isAdmin) return
    const nextItems = newStatus === "want_bid" ? (att.interested_items?.length ? att.interested_items : ITEM_KEYS) : []
    statusChangeMutation.mutate({ att, newStatus, nextItems })
  }

  // TanStack Query Mutation: Adjust Credit (+ / -)
  const adjustCreditMutation = useMutation({
    mutationFn: async ({ userId, itemType, next }: { userId: string; itemType: ItemKey; next: number }) => {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_credit", user_id: userId, item_type: itemType, credit: next }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "เกิดข้อผิดพลาดในการปรับแต้ม")
      }
      return res.json()
    },
    onMutate: async ({ userId, itemType, next }) => {
      setCredits((prev) => {
        const idx = prev.findIndex((c) => c.user_id === userId && c.item_type === itemType)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = { ...copy[idx], credit: next }
          return copy
        }
        return [...prev, { id: "temp-" + Date.now(), user_id: userId, item_type: itemType, credit: next }]
      })
    },
    onError: (err) => {
      setToast({ type: "err", text: `เกิดข้อผิดพลาด: ${err.message}` })
      refreshData()
    },
    onSuccess: () => {
      router.refresh()
    },
  })

  const handleAdjustCredit = (userId: string, itemType: ItemKey, delta: number) => {
    if (!isAdmin || !userId) return
    const cur = creditMap[`${userId}|${itemType}`] || 0
    const next = Math.max(0, cur + delta)
    adjustCreditMutation.mutate({ userId, itemType, next })
  }

  // TanStack Query Mutation: Update Slot Status (Instant 0ms Optimistic UI, zero freeze, super snappy "ติดมือ")
  const slotStatusMutation = useMutation({
    mutationFn: async ({
      slotIds,
      status,
    }: {
      slotIds: string[]
      status: "allocated" | "awarded" | "skipped"
    }) => {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_slot_status", slot_ids: slotIds, status }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "เกิดข้อผิดพลาดในการอัปเดตสล็อต")
      }
      return res.json()
    },
    onMutate: async ({ slotIds, status }) => {
      // 1. Instant 0ms optimistic update in local state
      setSlots((prev) =>
        prev.map((s) => (slotIds.includes(s.id) ? { ...s, status } : s))
      )
      // 2. Clear selections if any
      setSelectedSlotIds((prev) => {
        const next = new Set(prev)
        slotIds.forEach((id) => next.delete(id))
        return next
      })
    },
    onError: (err) => {
      setToast({ type: "err", text: `เกิดข้อผิดพลาด: ${err.message}` })
      refreshData()
    },
  })

  const handleSlotStatus = (slotIds: string[], status: "allocated" | "awarded" | "skipped") => {
    if (!isAdmin || slotIds.length === 0) return
    slotStatusMutation.mutate({ slotIds, status })
  }

  const handleSelectCurrentPageSlots = () => {
    const pageUnawardedIds = (activePageObj?.slots || [])
      .filter((s: any) => s.status !== "awarded")
      .map((s: any) => s.id)
    setSelectedSlotIds((prev) => {
      const next = new Set(prev)
      pageUnawardedIds.forEach((id: string) => next.add(id))
      return next
    })
  }

  const handleSelectAllSlots = () => {
    const allUnawardedIds = currentSlots
      .filter((s: any) => s.status !== "awarded")
      .map((s: any) => s.id)
    setSelectedSlotIds(new Set(allUnawardedIds))
  }

  const handleDeleteAttendance = async (attId: string) => {
    setAttendance((prev) => prev.filter((a) => a.id !== attId))
    await callApi({ action: "delete_attendance", id: attId }, "ลบคิวเรียบร้อยแล้ว")
  }

  return (
    <div className="space-y-5">
      {/* Header & Event Selector */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-zinc-100">
                จัดคิวและกระดานสล็อต (4 ช่อง/หน้า)
              </h1>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  isPollClosed
                    ? "bg-emerald-950 text-emerald-400 border-emerald-800/60"
                    : "bg-amber-950 text-amber-400 border-amber-800/60"
                }`}
              >
                {isPollClosed ? "สถานะ: ปิดโหวตแล้ว" : "สถานะ: กำลังเปิดโหวต"}
              </span>
            </div>
            <p className="text-zinc-500 text-sm mt-1">
              ตั้งค่าพิกัดหน้า/ช่อง จัดลำดับคิวผู้เข้าร่วม และคำนวณสล็อตประมูล (ต้องปิดโหวตก่อนคำนวณสล็อต)
            </p>
          </div>

          {/* Event & Date Controls */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {existingEvents.length > 0 ? (
              <select
                value={`${eventName}|${eventDate}`}
                onChange={(e) => handleSelectEventPreset(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 w-full sm:w-auto font-medium cursor-pointer"
              >
                {existingEvents.map((ev) => {
                  const [en, ed] = ev.split("|")
                  return (
                    <option key={ev} value={ev}>
                      {en} ({ed})
                    </option>
                  )
                })}
              </select>
            ) : (
              <div className="text-xs text-zinc-500 bg-zinc-800/60 px-3.5 py-2 rounded-lg border border-zinc-700">
                ไม่มีรอบกิจกรรมที่ผ่านการโหวตจากสมาชิก
              </div>
            )}
          </div>
        </div>

      {/* Toast Notification - Floating to prevent Layout Shift */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold border shadow-2xl flex items-center gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === "ok"
              ? "bg-zinc-900/95 border-emerald-500/60 text-emerald-300 shadow-emerald-950/50 backdrop-blur-md"
              : "bg-zinc-900/95 border-rose-500/60 text-rose-300 shadow-rose-950/50 backdrop-blur-md"
          }`}
        >
          <span>{toast.type === "ok" ? "✓" : "⚠️"}</span>
          <span>{toast.text}</span>
          {toast.type === "ok" && toast.text.includes("ประวัติ") && (
            <Link
              href="/history"
              className="text-xs text-emerald-400 hover:text-emerald-300 underline font-semibold ml-1 cursor-pointer"
            >
              ดูหน้าประวัติการประมูล →
            </Link>
          )}
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

        {/* Guard Warning Banner if Poll not closed or Bench not ready */}
        {!isBenchReady && (
          <div className="mt-4 p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 text-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="text-xs sm:text-sm">
                <p className="font-bold text-amber-100">
                  ระบบระงับการจัดคิวและคำนวณสล็อตชั่วคราว (กันคนตกหล่น)
                </p>
                <div className="text-amber-300/80 mt-0.5 space-y-0.5">
                  {!isPollClosed && (
                    <p>• <b>การโหวตรอบนี้ยังไม่สิ้นสุด</b>: ต้องปิดโหวตก่อนเพื่อป้องกันสมาชิกโหวตแทรกแล้วตกหล่น</p>
                  )}
                  {currentAttendance.length === 0 ? (
                    <p>• <b>ยังไม่มีข้อมูลลงชื่อสมาชิก</b>: กรุณาไปที่ผัง Bench เพื่อจัดผังรายชื่อ</p>
                  ) : wantBidMembers.length === 0 ? (
                    <p>• <b>โหมด Bench ยังไม่ลงตัว</b>: ยังไม่มีสมาชิกที่ต้องการประมูล (Want Bid) ในรอบนี้</p>
                  ) : null}
                </div>
              </div>
            </div>
            <Link
              href={`/bench?event=${encodeURIComponent(eventName)}&date=${encodeURIComponent(eventDate)}`}
              className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 self-end md:self-auto cursor-pointer shadow-sm"
            >
              <span>ไปที่ Bench Organizer</span>
              <span>→</span>
            </Link>
          </div>
        )}

        {/* Sub-navigation Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mt-5 pt-5 border-t border-zinc-800">
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 w-full lg:w-auto">
            {[
              { id: "board", label: `กระดานสล็อต (${currentSlots.length})` },
              { id: "queue", label: `จัดการคิว (${currentAttendance.length})` },
              { id: "config", label: "ตั้งค่าพิกัด & ลิมิต" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer text-center ${
                  activeTab === t.id
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 border border-zinc-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
            {isAdmin && !isPollClosed && (
              <button
                onClick={handleTogglePollStatus}
                disabled={busy}
                className="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-all disabled:opacity-50 cursor-pointer text-center bg-amber-950 hover:bg-amber-900/60 text-amber-300 border-amber-800/60"
              >
                ปิดโหวตรอบนี้
              </button>
            )}
            {isAdmin && currentSlots.length > 0 && (
              <button
                onClick={() => setShowSaveHistoryModal(true)}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm border border-emerald-500 transition-all disabled:opacity-50 cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>💾 บันทึกเป็นประวัติรอบนี้</span>
              </button>
            )}
            <Link
              href="/history"
              className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs sm:text-sm border border-zinc-700 transition-all text-center flex items-center justify-center gap-1.5"
            >
              <span>📜 ดูประวัติ</span>
              <span className="text-zinc-500">→</span>
            </Link>
            {isAdmin && existingEvents.length > 0 && (
              confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-rose-400 font-medium">ยืนยันลบรอบนี้?</span>
                  <button
                    onClick={handleDeleteEvent}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    ยืนยัน
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs cursor-pointer border border-zinc-700"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-500 hover:text-rose-400 text-sm border border-zinc-700 hover:border-rose-800/60 transition-all cursor-pointer"
                  title="ลบรอบนี้ทั้งหมด"
                >
                  ลบรอบ
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* ─── TAB 1: กระดานสล็อต / แถวรายการ ─────────────────────── */}
      {activeTab === "board" && (
        <div className="space-y-5">
          {/* Item Filter + Page Controls */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setFilterItem("ALL"); setCurrentPage(1) }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  filterItem === "ALL"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
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
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      filterItem === k
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {ITEMS_META[k].label} ({count})
                  </button>
                )
              })}
            </div>

            {/* Batch Actions & History Save */}
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && selectedSlotIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">เลือก {selectedSlotIds.size} ช่อง:</span>
                  <button
                    onClick={() => handleSlotStatus(Array.from(selectedSlotIds), "awarded")}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold cursor-pointer transition-transform duration-75 shadow-xs"
                  >
                    มอบของที่เลือก
                  </button>
                  <button
                    onClick={() => handleSlotStatus(Array.from(selectedSlotIds), "skipped")}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold cursor-pointer transition-transform duration-75 shadow-xs"
                  >
                    ข้ามคิว
                  </button>
                  <button
                    onClick={() => setSelectedSlotIds(new Set())}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold cursor-pointer border border-zinc-200 dark:border-zinc-700"
                  >
                    ล้าง
                  </button>
                </div>
              )}
              {isAdmin && currentSlots.length > 0 && (
                <button
                  onClick={() => setShowSaveHistoryModal(true)}
                  disabled={busy}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
                >
                  <span>💾 บันทึกผลรอบนี้เป็นประวัติ</span>
                </button>
              )}
            </div>
          </div>

          {/* 4-Slot In-Game Page View */}
          {pagesList.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-16 text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mx-auto flex items-center justify-center text-2xl">
                {!isBenchReady ? "🔒" : "📋"}
              </div>
              <div className="space-y-1">
                <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {!isBenchReady ? "ยังไม่สามารถจัดคิวหรือจัดสรรสล็อตได้" : "ยังไม่มีสล็อตที่ถูกจัดสรรสำหรับอีเวนต์นี้"}
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-md mx-auto">
                  {!isBenchReady ? (
                    <>
                      เพื่อป้องกันสมาชิกตกหล่น กรุณาจัดการใน{" "}
                      <Link
                        href={`/bench?event=${encodeURIComponent(eventName)}&date=${encodeURIComponent(eventDate)}`}
                        className="text-amber-500 hover:text-amber-400 underline font-semibold"
                      >
                        Bench Organizer
                      </Link>{" "}
                      ให้เรียบร้อยและปิดโหวตก่อนเริ่มการจัดคิวและสล็อต
                    </>
                  ) : (
                    <>
                      ไปที่แท็บ <b className="text-zinc-800 dark:text-zinc-200">ตั้งค่าพิกัด &amp; ลิมิต</b> เพื่อระบุจำนวนและลิมิต จากนั้นกด{" "}
                      <b className="text-zinc-800 dark:text-zinc-200">คำนวณสล็อตใหม่</b>
                    </>
                  )}
                </p>
              </div>
              {!isBenchReady && (
                <div className="pt-2">
                  <Link
                    href={`/bench?event=${encodeURIComponent(eventName)}&date=${encodeURIComponent(eventDate)}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-sm transition-all"
                  >
                    <span>ไปที่ Bench Organizer</span>
                    <span>→</span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Top Page Navigation Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-3 shadow-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 font-mono">
                    {currentSlots.length} Total Slots
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    หน้าในเกม:{" "}
                    <span className="font-black text-zinc-900 dark:text-zinc-100 font-mono">
                      Page {activePageObj?.pageNumber || currentPage} / {activePageObj?.slots[0]?.total_pages || totalBoardPages}
                    </span>
                  </span>
                  {/* Batch Select Buttons (moved from Batch Award bar) */}
                  {isAdmin && currentSlots.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleSelectCurrentPageSlots}
                        className="px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <span>📄</span>
                        <span>เลือกหน้านี้ (Page {activePageObj?.pageNumber || currentPage})</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectAllSlots}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-black transition shadow-sm shadow-blue-500/25 cursor-pointer flex items-center gap-1.5"
                      >
                        <span>⚡</span>
                        <span>
                          เลือกทั้งหมดทุกหน้า ({currentSlots.filter((s) => s.status !== "awarded").length} ช่อง)
                        </span>
                      </button>
                      {selectedSlotIds.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedSlotIds(new Set())}
                          className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition cursor-pointer"
                        >
                          ยกเลิกที่เลือก ({selectedSlotIds.size})
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Top Pagination Controls */}
                  <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage <= 1}
                      className="px-2.5 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
                      title="หน้าแรก"
                    >
                      &lt;&lt;
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-2.5 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
                      title="หน้าก่อนหน้า"
                    >
                      &lt;
                    </button>
                    <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200 font-mono px-2">
                      Page {currentPage} of {pagesList.length || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(pagesList.length, p + 1))}
                      disabled={currentPage >= pagesList.length}
                      className="px-2.5 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
                      title="หน้าถัดไป"
                    >
                      &gt;
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(pagesList.length)}
                      disabled={currentPage >= pagesList.length}
                      className="px-2.5 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
                      title="หน้าสุดท้าย"
                    >
                      &gt;&gt;
                    </button>
                  </div>
                </div>
              </div>


              {/* SLOTS DISPLAY: List View */}
              <div className="flex flex-col gap-4">
                {[1, 2, 3, 4].map((slotNum) => {
                  const slotData = activePageObj?.slots.find((s: any) => Number(s.slot_number) === slotNum)
                  if (!slotData) {
                      return (
                        <div
                          key={`empty-${slotNum}`}
                          className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 p-4 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-zinc-400"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center text-xs font-mono text-zinc-400 shrink-0 bg-white/50 dark:bg-zinc-800/40">
                              <span className="text-[10px] uppercase font-bold text-zinc-400">Slot</span>
                              <span className="text-base font-black">#{slotNum}</span>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                                Assigned To
                              </div>
                              <div className="text-base sm:text-lg font-bold text-zinc-400 dark:text-zinc-500">
                                ไม่มีผู้ลงคิวล่วงหน้า
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                                  หน้า {activePageObj?.pageNumber || currentPage} ช่องที่ {slotNum}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-center w-full xl:w-auto bg-zinc-100 dark:bg-zinc-800/50 px-6 py-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 shrink-0">
                            <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                              ไม่มีใครจอง
                            </span>
                          </div>
                        </div>
                      )
                    }

                    const meta = ITEMS_META[slotData.item_type as ItemKey] || ITEMS_META.Album
                    const isSelected = selectedSlotIds.has(slotData.id)
                    const isAwarded = slotData.status === "awarded"
                    const isSkipped = slotData.status === "skipped"

                    // Compute Member Slot Ratio (Total / Awarded | Remaining)
                    const userSlots = slots.filter(
                      (s) =>
                        s.event_name === eventName &&
                        s.session_date === eventDate &&
                        s.user_id === slotData.user_id &&
                        s.item_type === slotData.item_type
                    )
                    const userTotal = userSlots.length
                    const userAwarded = userSlots.filter((s) => s.status === "awarded").length
                    const userRemaining = Math.max(0, userTotal - userAwarded)

                    return (
                      <div
                        key={slotData.id}
                        className={`flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
                          isSelected
                            ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500 shadow-sm"
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md"
                        }`}
                      >
                        {/* Left: Item 3D Icon + Assigned Info */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="shrink-0 flex items-center justify-center">
                            <div
                              className={`w-16 h-16 sm:w-20 sm:h-20 bg-linear-to-b ${meta.color} ${meta.border} rounded-2xl border flex items-center justify-center relative shadow-inner p-2`}
                            >
                              <img
                                src={encodeURI(meta.icon)}
                                alt={meta.label}
                                className="w-full h-full object-contain filter drop-shadow-md select-none"
                                loading="lazy"
                              />
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                              Assigned To
                            </div>
                            <div className="text-base sm:text-lg font-black truncate text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                              <span>{slotData.profiles?.display_name || "ไม่ทราบชื่อ"}</span>
                              {slotData.profiles?.job_class && (
                                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                  ({slotData.profiles.job_class})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                หน้า {slotData.page_number} ช่องที่ {slotData.slot_number}
                              </span>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${meta.badge}`}>
                                {meta.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Status Badge + Ratio Counter Box + Action Buttons */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 pt-3 xl:pt-0 border-t xl:border-t-0 border-zinc-100 dark:border-zinc-800/80 w-full xl:w-auto xl:justify-end shrink-0">
                          {/* Status Badge */}
                          <div className="flex flex-col justify-center order-1">
                            {isAwarded ? (
                              <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold whitespace-nowrap border border-emerald-300 dark:border-emerald-800/60">
                                ประมูลเสร็จแล้ว
                              </span>
                            ) : isSelected ? (
                              <span className="text-xs px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold whitespace-nowrap animate-pulse border border-blue-300 dark:border-blue-700">
                                เลือกไว้แล้ว
                              </span>
                            ) : isSkipped ? (
                              <span className="text-xs px-3 py-1.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold whitespace-nowrap border border-rose-300 dark:border-rose-800/60">
                                ข้ามคิว
                              </span>
                            ) : (
                              <span className="text-xs px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-bold whitespace-nowrap border border-zinc-200 dark:border-zinc-700">
                                รอประมูล
                              </span>
                            )}
                          </div>

                          {/* Ratio Counter Box: จอง/ได้แล้ว | เหลือ */}
                          {isAdmin && (
                            <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-950/60 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 order-2">
                              <div className="text-center">
                                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                  {userTotal}{" "}
                                  <span className="text-zinc-400 dark:text-zinc-600 mx-0.5">/</span>{" "}
                                  <span className="text-blue-600 dark:text-blue-400">{userAwarded}</span>
                                </div>
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wide">
                                  จอง/ได้แล้ว
                                </div>
                              </div>
                              <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800"></div>
                              <div className="text-center">
                                <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                                  {userRemaining}
                                </div>
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wide">
                                  เหลือ
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action Buttons: Main ประมูล + Quick 1-click ได้ของ/รีเซ็ต */}
                          {isAdmin && (
                            <div className="flex items-center gap-2 w-full sm:w-auto order-3 mt-2 sm:mt-0 xl:ml-2">
                              <button
                                type="button"
                                disabled={isAwarded}
                                onClick={() => {
                                  if (isAwarded) return
                                  setSelectedSlotIds((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(slotData.id)) next.delete(slotData.id)
                                    else next.add(slotData.id)
                                    return next
                                  })
                                }}
                                className={`w-full sm:w-auto rounded-xl text-sm font-bold px-6 py-3 disabled:opacity-50 transition-all shadow-md whitespace-nowrap flex items-center justify-center gap-2 ${
                                  isAwarded
                                    ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed shadow-none"
                                    : isSelected
                                    ? "cursor-pointer bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-500/30 ring-2 ring-blue-400"
                                    : "cursor-pointer bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-500/20"
                                }`}
                              >
                                {isAwarded ? (
                                  <>
                                    <span>✅</span> สำเร็จ
                                  </>
                                ) : isSelected ? (
                                  <>
                                    <span>✓</span> เลือกแล้ว
                                  </>
                                ) : (
                                  <>ประมูล</>
                                )}
                              </button>

                              {/* Quick direct 1-click award for individual slot */}
                              {!isAwarded ? (
                                <button
                                  type="button"
                                  onClick={() => handleSlotStatus([slotData.id], "awarded")}
                                  title="ได้ของทันที (1-Click Instant Award)"
                                  className="px-3 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
                                >
                                  ได้ของ
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSlotStatus([slotData.id], "allocated")}
                                  title="รีเซ็ตสถานะช่องนี้กลับเป็นรอประมูล"
                                  className="px-3 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
                                >
                                  รีเซ็ต
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                })}
              </div>

              {/* Bottom Page Navigation Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-3 shadow-xs">
                <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 font-mono">
                  {currentSlots.length} Total Slots
                </span>

                <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage <= 1}
                    className="px-2.5 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
                    title="หน้าแรก"
                  >
                    &lt;&lt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-2.5 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
                    title="หน้าก่อนหน้า"
                  >
                    &lt;
                  </button>
                  <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200 font-mono px-2">
                    Page {currentPage} of {pagesList.length || 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(pagesList.length, p + 1))}
                    disabled={currentPage >= pagesList.length}
                    className="px-2.5 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
                    title="หน้าถัดไป"
                  >
                    &gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(pagesList.length)}
                    disabled={currentPage >= pagesList.length}
                    className="px-2.5 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
                    title="หน้าสุดท้าย"
                  >
                    &gt;&gt;
                  </button>
                </div>
              </div>

              {/* Kafra Discord Announcement Box */}
              {kafraAnnouncementText && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                      ข้อความสรุปพิกัด (รูปแบบ Kafra สำหรับ Discord)
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(kafraAnnouncementText)
                        setToast({ type: "ok", text: "คัดลอกข้อความลง Clipboard แล้ว" })
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100 text-xs font-bold transition-all cursor-pointer border border-zinc-200 dark:border-zinc-600"
                    >
                      คัดลอก
                    </button>
                  </div>
                  <pre className="p-5 text-xs font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950/60 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-80">
                    {kafraAnnouncementText}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Floating Sticky Batch Action Bar */}
          {isAdmin && selectedSlotIds.size > 0 && (
            <div className="fixed bottom-6 inset-x-0 z-40 max-w-xl mx-auto px-4 animate-in slide-in-from-bottom duration-200">
              <div className="bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-zinc-700/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-blue-400 font-black font-mono text-base">
                    {selectedSlotIds.size}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold truncate flex items-center gap-1.5">
                      <span>เลือกประมูลแล้ว</span>
                      <span className="font-extrabold text-blue-400 font-mono">{selectedSlotIds.size}</span>
                      <span>ช่อง</span>
                    </div>
                    <div className="text-[10px] sm:text-xs text-zinc-400 truncate">
                      คลิกช่องอื่นๆ เพื่อเลือกเพิ่ม หรือกดยืนยันบันทึกผล
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedSlotIds(new Set())}
                    className="px-3 py-2 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSlotStatus(Array.from(selectedSlotIds), "skipped")}
                    className="px-3 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl border border-rose-800/50 transition cursor-pointer"
                  >
                    ข้ามคิว
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSlotStatus(Array.from(selectedSlotIds), "awarded")}
                    className="px-4 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black transition shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
                  >
                    <span>✅ ยืนยันผลประมูล ({selectedSlotIds.size})</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: จัดการคิวผู้เข้าร่วม ────────── */}
      {activeTab === "queue" && (
        <div className="space-y-5">
          {/* Admin Proxy Add Form */}
          {isAdmin && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="font-semibold text-zinc-100 text-sm mb-3">
                ดึงสมาชิกเข้าคิว / ลงชื่อแทนสมาชิก (Proxy Queue)
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-52 flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">เลือกสมาชิก</label>
                  <select
                    value={proxyUserId}
                    onChange={(e) => setProxyUserId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="">
                      {availableMembersForProxy.length === 0 ? "-- สมาชิกทุกคนลงชื่อแล้ว --" : "-- เลือกสมาชิกในกิลด์ --"}
                    </option>
                    {availableMembersForProxy.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name} ({m.job_class || "ไม่ระบุอาชีพ"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 mb-1">สถานะการเข้าร่วม</label>
                  <select
                    value={proxyStatus}
                    onChange={(e) => setProxyStatus(e.target.value as any)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="want_bid">Join the war / Want to bid</option>
                    <option value="no_bid">Join the war / Do not want to bid</option>
                    <option value="absent">Unable to attend</option>
                  </select>
                </div>

                {proxyStatus === "want_bid" && (
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">ไอเทมที่ต้องการประมูล</label>
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
                            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                              active
                                ? "bg-zinc-700 border-zinc-500 text-zinc-100"
                                : "bg-zinc-800 border-zinc-700 text-zinc-600 hover:text-zinc-400"
                            }`}
                          >
                            {ITEMS_META[k].label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleProxyAdd}
                  disabled={!proxyUserId || busy}
                  className="px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-900 text-sm font-semibold cursor-pointer"
                >
                  บันทึกเข้าคิว
                </button>
              </div>
            </div>
          )}

          {/* Attendance & Queue Order Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="font-semibold text-zinc-100 text-sm">ลำดับคิวผู้เข้าร่วม ({sortedAttendance.length} คน)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                คนที่มียอดค้างสะสม (Credit) สูงกว่าจะได้รับสิทธิ์จัดสรรเศษสล็อตก่อนอัตโนมัติ
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                    <th className="px-4 py-3 font-medium text-center w-14">คิวที่</th>
                    <th className="px-4 py-3 font-medium">สมาชิก</th>
                    <th className="px-4 py-3 font-medium">สถานะ</th>
                    <th className="px-4 py-3 font-medium">ไอเทมที่ต้องการ</th>
                    <th className="px-4 py-3 font-medium text-center">Carry Credit</th>
                    {isAdmin && <th className="px-4 py-3 font-medium text-right">จัดการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {sortedAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-zinc-600 py-12 text-sm">
                        ยังไม่มีผู้ลงชื่อในอีเวนต์นี้ (สามารถกดเพิ่มจากด้านบน หรือเปิดโพลผ่านบอท /event_poll)
                      </td>
                    </tr>
                  ) : (
                    sortedAttendance.map((att, idx) => {
                      const items: string[] = Array.isArray(att.interested_items) ? att.interested_items : []
                      return (
                        <tr key={att.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-zinc-500">
                            #{idx + 1}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-zinc-100">
                              {att.profiles?.display_name || "ไม่ทราบชื่อ"}
                            </div>
                            <div className="text-xs text-zinc-600">
                              {att.profiles?.job_class || "ไม่ระบุอาชีพ"}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {isAdmin ? (
                              <select
                                value={att.status}
                                onChange={(e) => handleStatusChange(att, e.target.value)}
                                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                              >
                                <option value="want_bid">Want to bid</option>
                                <option value="no_bid">Do not bid (Credit)</option>
                                <option value="absent">Unable to attend</option>
                              </select>
                            ) : (
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                                att.status === "want_bid"
                                  ? "bg-emerald-950 text-emerald-400 border-emerald-800/60"
                                  : att.status === "no_bid"
                                  ? "bg-amber-950 text-amber-400 border-amber-800/60"
                                  : "bg-rose-950 text-rose-400 border-rose-800/60"
                              }`}>{att.status}</span>
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
                                      type="button"
                                      onClick={() => handleToggleMemberItem(att, k)}
                                      disabled={!isAdmin}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all duration-150 active:scale-95 cursor-pointer ${
                                        active
                                          ? ITEMS_META[k].badge + " shadow-sm ring-1 ring-white/10"
                                          : "bg-zinc-900/90 border-zinc-800 text-zinc-600 hover:text-zinc-300 hover:border-zinc-700"
                                      }`}
                                    >
                                      {ITEMS_META[k].label}
                                    </button>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-700">— ไม่ประมูลในรอบนี้ —</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {ITEM_KEYS.map((k) => {
                                const cVal = creditMap[`${att.user_id}|${k}`] || 0
                                return (
                                  <div
                                    key={k}
                                    className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs"
                                    title={`Carry Credit: ${ITEMS_META[k].label}`}
                                  >
                                    <span className="text-zinc-400">{ITEMS_META[k].label}:</span>
                                    <span className="font-mono font-bold text-amber-400">{cVal}</span>
                                    {isAdmin && (
                                      <div className="flex items-center gap-0.5 ml-1">
                                        <button
                                          onClick={() => handleAdjustCredit(att.user_id, k, -1)}
                                          className="w-4 h-4 rounded bg-zinc-700 hover:bg-rose-700 text-zinc-200 flex items-center justify-center text-[10px] cursor-pointer"
                                        >
                                          -
                                        </button>
                                        <button
                                          onClick={() => handleAdjustCredit(att.user_id, k, 1)}
                                          className="w-4 h-4 rounded bg-zinc-700 hover:bg-emerald-700 text-zinc-200 flex items-center justify-center text-[10px] cursor-pointer"
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
                                onClick={() => handleDeleteAttendance(att.id)}
                                className="text-xs font-medium text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-700 border border-rose-800/50 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                              >
                                ลบ
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

      {/* ─── TAB 3: ตั้งค่าพิกัดไอเทม & ลิมิต ──────────── */}
      {activeTab === "config" && (
        <div className="space-y-5">
          {/* Continuous Coordinates Linking Banner */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔗</span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-zinc-100">
                    ลิงก์พิกัดหน้า/ช่องต่อเนื่องอัตโนมัติ (Continuous Coordinates)
                  </h4>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      autoLinkCoords
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    }`}
                  >
                    {autoLinkCoords ? "เปิดใช้งานอยู่" : "ปิดอยู่"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  เมื่อปรับจำนวนชิ้นหรือพิกัด พิกัดจะรันต่อกันทันที: สมุดการ์ด → เศษการ์ดบอส → ขนนกขาว → ขนนกดำแดง
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => {
                  const next = !autoLinkCoords
                  setAutoLinkCoords(next)
                  if (next) {
                    setItemForms((prev) => recalculateContinuousChain(prev))
                    setToast({ type: "ok", text: "เปิดระบบลิงก์พิกัดต่อเนื่องแล้ว" })
                  }
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  autoLinkCoords
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {autoLinkCoords ? "✓ ลิงก์ต่อเนื่อง (เปิด)" : "ปิดลิงก์ (แยกอิสระ)"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setItemForms((prev) => recalculateContinuousChain(prev))
                  setToast({ type: "ok", text: "จัดเรียงพิกัดทั้ง 4 ไอเทมให้ต่อเนื่องกันเรียบร้อยแล้ว" })
                }}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer"
              >
                จัดเรียงใหม่เดี๋ยวนี้
              </button>
              {isAdmin && (
                <button
                  onClick={handleRunAllocation}
                  disabled={busy || !isBenchReady}
                  title={!isBenchReady ? "กรุณาปิดโหวตและจัดผัง Bench ให้เรียบร้อยก่อน" : "คำนวณสล็อตใหม่"}
                  className={`px-4 py-1.5 rounded-lg font-bold text-xs border transition-all cursor-pointer ${
                    !isBenchReady
                      ? "bg-zinc-800/60 text-zinc-500 border-zinc-700/50 cursor-not-allowed opacity-60"
                      : "bg-zinc-100 hover:bg-white text-zinc-900 border-zinc-200"
                  }`}
                >
                  {busy ? "กำลังคำนวณ..." : !isBenchReady ? "🔒 รอปิดโหวต & Bench" : "คำนวณสล็อตใหม่"}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ITEM_KEYS.map((key, idx) => {
              const meta = ITEMS_META[key]
              const form = itemForms[key]
              const prevKey = idx > 0 ? ITEM_KEYS[idx - 1] : null
              return (
                <div
                  key={key}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-zinc-100">{meta.label}</h3>
                        {autoLinkCoords && prevKey && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-950/70 text-teal-300 border border-teal-800/50 font-medium">
                            🔗 ต่อจาก {ITEMS_META[prevKey].label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600">{meta.desc}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-zinc-600">จำนวนรวม</div>
                      <div className="text-2xl font-black font-mono text-zinc-100">
                        {form.total_quantity || 0}{" "}
                        <span className="text-xs font-normal text-zinc-600">ชิ้น</span>
                      </div>
                    </div>
                  </div>

                  {/* Coord Input */}
                  <div className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-semibold text-zinc-400">
                      ระบุพิกัดหน้าและช่องในเกม (1 หน้ามี 4 ช่อง)
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-zinc-500 mb-1">เริ่มต้น (หน้า / ช่อง 1-4)</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            disabled={!isAdmin}
                            value={form.start_page}
                            onChange={(e) => handleCoordChange(key, "start_page", e.target.value)}
                            placeholder="หน้า"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-center font-mono text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                          />
                          <span className="text-zinc-600">:</span>
                          <input
                            type="number"
                            min={0}
                            max={4}
                            disabled={!isAdmin}
                            value={form.start_slot}
                            onChange={(e) => handleCoordChange(key, "start_slot", e.target.value)}
                            placeholder="ช่อง"
                            className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-center font-mono text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-500 mb-1">สิ้นสุด (หน้า / ช่อง 1-4)</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            disabled={!isAdmin}
                            value={form.end_page}
                            onChange={(e) => handleCoordChange(key, "end_page", e.target.value)}
                            placeholder="หน้า"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-center font-mono text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                          />
                          <span className="text-zinc-600">:</span>
                          <input
                            type="number"
                            min={0}
                            max={4}
                            disabled={!isAdmin}
                            value={form.end_slot}
                            onChange={(e) => handleCoordChange(key, "end_slot", e.target.value)}
                            placeholder="ช่อง"
                            className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-center font-mono text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Limit */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-3.5">
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">
                        จำนวนชิ้นรวมโดยตรง
                      </label>
                      <input
                        type="number"
                        min={0}
                        disabled={!isAdmin}
                        value={form.total_quantity}
                        onChange={(e) => handleCoordChange(key, "total_quantity", e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-center font-mono text-lg font-bold text-zinc-100 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                      />
                    </div>
                    <div className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-3.5">
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">
                        ลิมิตต่อคน (Limit)
                      </label>
                      <input
                        type="number"
                        min={1}
                        disabled={!isAdmin}
                        value={form.personal_limit}
                        onChange={(e) => handleCoordChange(key, "personal_limit", e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-center font-mono text-lg font-bold text-emerald-400 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

        </div>

      )}

      {/* Modal: ยืนยันบันทึกเป็นประวัติการประมูล */}
      {showSaveHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-xl">
                💾
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">บันทึกเป็นประวัติการประมูล</h3>
                <p className="text-xs text-zinc-400">รอบ: {eventName} ({eventDate})</p>
              </div>
            </div>

            <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700/60 text-xs text-zinc-300 space-y-2">
              <p>
                ระบบจะทำการ:
              </p>
              <ul className="list-disc list-inside space-y-1 text-zinc-400">
                <li>ปรับสถานะสล็อตทั้งหมด ({currentSlots.length} ช่อง) เป็น <b className="text-emerald-400">&quot;ประมูลสำเร็จ&quot;</b></li>
                <li>บันทึกประวัติการรับไอเทมของสมาชิกทุกคนลงใน <b className="text-zinc-200">ประวัติการประมูล (Auction History)</b></li>
                <li>รายการที่เคยบันทึกไปแล้วจะไม่ถูกบันทึกซ้ำซ้อน</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveHistoryModal(false)}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 cursor-pointer transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveRoundToHistory}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-950/50"
              >
                {busy ? "กำลังบันทึก..." : "💾 ยืนยันบันทึกประวัติ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
