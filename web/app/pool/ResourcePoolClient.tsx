"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"

type ItemKey = "Album" | "Puppet" | "White" | "RedBlack"

const ITEM_KEYS: ItemKey[] = ["Album", "Puppet", "White", "RedBlack"]

const ITEM_NAMES: Record<ItemKey, string> = {
  Album: "Card Fragment (สมุด)",
  Puppet: "Illusion Card (เศษบอส)",
  White: "Light-Dark (ขาว)",
  RedBlack: "Time-Space (แดง)",
}

interface Member {
  id: string
  display_name: string
  discord_id: string
}

interface SlotEntry {
  id: string
  item_key: ItemKey
  item_label: string
  slot_index: number
  member_name: string
}

interface PageGroup {
  page_number: number
  slots: SlotEntry[]
}

interface Snapshot {
  id: string
  event_name: string
  event_date: string
  snapshot_label: string
  queue_entries: number
  discord_sent: boolean
  created_at: string
  created_by?: string
  pool_data: Record<string, number>
  slots_data?: SlotEntry[]
}

interface Props {
  isAdmin: boolean
  initialSessions: any[]
  initialSlots: any[]
  initialMembers: Member[]
  initialSnapshots: any[]
}

export default function ResourcePoolClient({
  isAdmin,
  initialSessions,
  initialSlots,
  initialMembers,
  initialSnapshots,
}: Props) {
  const [activeTab, setActiveTab] = useState<"pool" | "snapshots">("pool")

  // Derive event name and quantities from the latest active session in DB
  const latestSession = useMemo(() => {
    if (!initialSessions || initialSessions.length === 0) return null
    // Sort by session_date desc, take first
    const sorted = [...initialSessions].sort(
      (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
    )
    return sorted[0]
  }, [initialSessions])

  const getQtyForItem = (itemType: string) => {
    const found = initialSessions.find((s: any) => s.item_type === itemType && s.session_date === latestSession?.session_date && s.event_name === latestSession?.event_name)
    return found ? String(found.total_quantity ?? 0) : "0"
  }

  const [poolName, setPoolName] = useState(() =>
    latestSession
      ? `${latestSession.event_name} : ${latestSession.session_date}`
      : "Resource Pool"
  )

  // 4 item counts — auto-populated from DB
  const [albumQty, setAlbumQty] = useState<string>(() => getQtyForItem("Album"))
  const [puppetQty, setPuppetQty] = useState<string>(() => getQtyForItem("Puppet"))
  const [whiteQty, setWhiteQty] = useState<string>(() => getQtyForItem("White"))
  const [redBlackQty, setRedBlackQty] = useState<string>(() => getQtyForItem("RedBlack"))

  // Re-populate when initialSessions changes (e.g. after navigation)
  useEffect(() => {
    if (!latestSession) return
    setAlbumQty(getQtyForItem("Album"))
    setPuppetQty(getQtyForItem("Puppet"))
    setWhiteQty(getQtyForItem("White"))
    setRedBlackQty(getQtyForItem("RedBlack"))
    setPoolName(`${latestSession.event_name} : ${latestSession.session_date}`)
  }, [initialSessions])

  // Assigned members: prefer event_attendance (want_bid) from DB, fallback to localStorage
  const getAssignedFromDb = () => {
    if (!initialSlots || initialSlots.length === 0) return null
    // Get unique user_ids from allocated_slots for the latest event
    const userSet = new Set<string>()
    const nameList: string[] = []
    for (const slot of initialSlots) {
      if (
        latestSession &&
        slot.event_name === latestSession.event_name &&
        slot.session_date === latestSession.session_date
      ) {
        const uid = slot.user_id
        if (uid && !userSet.has(uid)) {
          userSet.add(uid)
          const profile = (slot.profiles as any) || {}
          const name = profile.display_name || ""
          if (name) nameList.push(name)
        }
      }
    }
    return nameList.length > 0 ? nameList : null
  }

  const [assignedMemberNames, setAssignedMemberNames] = useState<string[]>(() => {
    // Priority: DB allocated_slots > localStorage > all members
    const fromDb = getAssignedFromDb()
    if (fromDb) return fromDb
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("rooc_assigned_bench_members")
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((m: any) => m.display_name)
          }
        }
      } catch {}
    }
    return initialMembers.map((m) => m.display_name)
  })

  // Read assigned members on mount / when initialSlots changes
  useEffect(() => {
    const fromDb = getAssignedFromDb()
    if (fromDb) {
      setAssignedMemberNames(fromDb)
      return
    }
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("rooc_assigned_bench_members")
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAssignedMemberNames(parsed.map((m: any) => m.display_name))
            return
          }
        }
      } catch {}
    }
    if (initialMembers.length > 0) {
      setAssignedMemberNames(initialMembers.map((m) => m.display_name))
    }
  }, [initialSlots, initialMembers])

  // Generated slots state
  const [slotsList, setSlotsList] = useState<SlotEntry[]>([])
  const [currentPageView, setCurrentPageView] = useState(1)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>(initialSnapshots || [])

  // Generate slots helper
  const computeSlots = (
    qAlbum: number,
    qPuppet: number,
    qWhite: number,
    qRedBlack: number,
    members: string[]
  ): SlotEntry[] => {
    const mems = members.length > 0 ? members : initialMembers.map((m) => m.display_name)
    if (mems.length === 0) return []
    const result: SlotEntry[] = []

    const distribute = (key: ItemKey, qty: number) => {
      if (qty <= 0) return
      // Distribute in blocks of 2 per person (matching image 4) or round robin
      let memIdx = 0
      let memShareCount = 0
      for (let i = 1; i <= qty; i++) {
        const currentMember = mems[memIdx % mems.length]
        result.push({
          id: `${key}-${i}`,
          item_key: key,
          item_label: ITEM_NAMES[key],
          slot_index: i,
          member_name: currentMember,
        })
        memShareCount++
        if (memShareCount >= 2) {
          memShareCount = 0
          memIdx++
        }
      }
    }

    distribute("Album", qAlbum)
    distribute("Puppet", qPuppet)
    distribute("White", qWhite)
    distribute("RedBlack", qRedBlack)

    return result
  }

  // Initial calculation on load and whenever key values change
  useEffect(() => {
    const qA = parseInt(albumQty) || 0
    const qP = parseInt(puppetQty) || 0
    const qW = parseInt(whiteQty) || 0
    const qRB = parseInt(redBlackQty) || 0
    if (qA + qP + qW + qRB > 0 && assignedMemberNames.length > 0) {
      setSlotsList(computeSlots(qA, qP, qW, qRB, assignedMemberNames))
    }
  }, [albumQty, puppetQty, whiteQty, redBlackQty, assignedMemberNames])

  // Handle Apply Pool button
  const handleApplyPool = () => {
    const qA = Math.max(0, parseInt(albumQty) || 0)
    const qP = Math.max(0, parseInt(puppetQty) || 0)
    const qW = Math.max(0, parseInt(whiteQty) || 0)
    const qRB = Math.max(0, parseInt(redBlackQty) || 0)

    const newSlots = computeSlots(qA, qP, qW, qRB, assignedMemberNames)
    setSlotsList(newSlots)
    setCurrentPageView(1)
    setToast({
      type: "ok",
      text: `จัดสรร Pool สำเร็จ! รวม ${newSlots.length} ช่อง (${Math.ceil(newSlots.length / 4)} หน้า)`,
    })
  }

  // Group slots into 4 per page
  const pageGroups: PageGroup[] = useMemo(() => {
    const groups: PageGroup[] = []
    const totalPages = Math.max(1, Math.ceil(slotsList.length / 4))

    for (let p = 1; p <= totalPages; p++) {
      const startIndex = (p - 1) * 4
      const pageSlots = slotsList.slice(startIndex, startIndex + 4)
      groups.push({
        page_number: p,
        slots: pageSlots,
      })
    }
    return groups
  }, [slotsList])

  const totalPages = pageGroups.length || 1

  // Handle editing a member name in a slot
  const handleSlotMemberChange = (slotId: string, newName: string) => {
    setSlotsList((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, member_name: newName } : s))
    )
  }

  // Snapshot modal
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [snapshotLabel, setSnapshotLabel] = useState(poolName)

  const handleSaveSnapshot = async () => {
    if (!snapshotLabel.trim()) return
    setBusy(true)
    try {
      const poolData = {
        Album: parseInt(albumQty) || 0,
        Puppet: parseInt(puppetQty) || 0,
        White: parseInt(whiteQty) || 0,
        RedBlack: parseInt(redBlackQty) || 0,
      }

      const res = await fetch("/api/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_snapshot",
          event_name: poolName.split(":")[0]?.trim() || "Guild League",
          event_date: new Date().toISOString().split("T")[0],
          snapshot_label: snapshotLabel.trim(),
          queue_entries: slotsList.length,
          pool_data: poolData,
          slots_data: slotsList,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึก Snapshot")

      setToast({ type: "ok", text: "บันทึก Snapshot เรียบร้อยแล้ว" })
      setShowSaveModal(false)

      // Refresh snapshots
      const listRes = await fetch("/api/pool?action=snapshots")
      const listData = await listRes.json()
      if (listData.snapshots) setSnapshots(listData.snapshots)
    } catch (e: any) {
      setToast({ type: "err", text: e.message })
    } finally {
      setBusy(false)
    }
  }

  // Select Snapshot (loads into Pool tab)
  const handleSelectSnapshot = (snap: Snapshot) => {
    setPoolName(snap.snapshot_label || snap.event_name)
    if (snap.pool_data) {
      setAlbumQty(String(snap.pool_data.Album ?? 0))
      setPuppetQty(String(snap.pool_data.Puppet ?? 0))
      setWhiteQty(String(snap.pool_data.White ?? 0))
      setRedBlackQty(String(snap.pool_data.RedBlack ?? 0))
    }
    if (Array.isArray(snap.slots_data) && snap.slots_data.length > 0) {
      setSlotsList(snap.slots_data)
    } else {
      const qA = Number(snap.pool_data?.Album ?? 0)
      const qP = Number(snap.pool_data?.Puppet ?? 0)
      const qW = Number(snap.pool_data?.White ?? 0)
      const qRB = Number(snap.pool_data?.RedBlack ?? 0)
      setSlotsList(computeSlots(qA, qP, qW, qRB, assignedMemberNames))
    }
    setActiveTab("pool")
    setCurrentPageView(1)
    setToast({ type: "ok", text: `โหลด Snapshot: ${snap.snapshot_label} เรียบร้อยแล้ว` })
  }

  // Send Snapshot to Discord
  const handleSendToDiscord = async (snap: Snapshot) => {
    setBusy(true)
    try {
      // Build Discord message text
      const lines: string[] = []
      lines.push(`📋 **Resource Pool — ${snap.snapshot_label || snap.event_name}**`)
      lines.push(`📅 วันที่: ${snap.event_date || "วันนี้"}`)
      lines.push(`📦 **สรุป Pool ไอเทม:**`)
      lines.push(`• Card Fragment (สมุด): ${snap.pool_data?.Album ?? 0} ชิ้น`)
      lines.push(`• Illusion Card (เศษบอส): ${snap.pool_data?.Puppet ?? 0} ชิ้น`)
      lines.push(`• Light-Dark (ขาว): ${snap.pool_data?.White ?? 0} ชิ้น`)
      lines.push(`• Time-Space (แดง): ${snap.pool_data?.RedBlack ?? 0} ชิ้น`)
      lines.push(`🔢 รวมทั้งหมด: ${snap.queue_entries} ช่อง (${Math.ceil(snap.queue_entries / 4)} หน้า)`)

      const text = lines.join("\n")

      // Call API
      const res = await fetch("/api/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_to_discord",
          id: snap.id,
          content: text,
        }),
      })

      const data = await res.json()

      // Copy text to clipboard
      try {
        await navigator.clipboard.writeText(text)
      } catch {}

      setToast({
        type: "ok",
        text: data.message || "ส่งเข้า Discord และคัดลอกข้อความลง Clipboard แล้ว",
      })

      // Mark locally as sent
      setSnapshots((prev) =>
        prev.map((s) => (s.id === snap.id ? { ...s, discord_sent: true } : s))
      )
    } catch (e: any) {
      setToast({ type: "err", text: e.message })
    } finally {
      setBusy(false)
    }
  }

  // Capture PNG / Copy Announcement Text
  const handleCapturePNG = () => {
    const textLines: string[] = [
      `=== POOL PREVIEW: ${poolName} ===`,
      `Card Fragment (สมุด): ${albumQty} | Illusion Card (เศษบอส): ${puppetQty} | Light-Dark (ขาว): ${whiteQty} | Time-Space (แดง): ${redBlackQty}`,
      `Total Pages: ${totalPages} (${slotsList.length} slots)`,
      ``,
    ]

    pageGroups.slice(0, 15).forEach((pg) => {
      textLines.push(`PAGE ${pg.page_number}/${totalPages}:`)
      pg.slots.forEach((s) => {
        textLines.push(`  ${s.item_label} #${s.slot_index}: ${s.member_name}`)
      })
    })

    if (totalPages > 15) {
      textLines.push(`... และอีก ${totalPages - 15} หน้า`)
    }

    navigator.clipboard.writeText(textLines.join("\n"))
    setToast({
      type: "ok",
      text: "คัดลอกสรุปหน้า/ช่องของ Pool ลง Clipboard เรียบร้อยแล้ว (สามารถส่งต่อใน Discord ได้ทันที)",
    })
  }

  // Display pagination
  const visiblePages = useMemo(() => {
    // Show up to 10 pages per view or jump
    const start = (currentPageView - 1) * 10
    return pageGroups.slice(start, start + 10)
  }, [pageGroups, currentPageView])

  const totalPageBatches = Math.ceil(totalPages / 10) || 1

  return (
    <div className="space-y-6">
      {/* Quick Navigation / Back Link */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/bench"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-medium border border-zinc-800 transition-all cursor-pointer shadow-sm"
        >
          <span>←</span>
          <span>กลับไป Bench Organizer</span>
        </Link>
        <Link
          href="/queues"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium border border-zinc-800/80 transition-all cursor-pointer shadow-sm"
        >
          <span>จัดคิว & สล็อต</span>
        </Link>
      </div>

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Resource Pool</h1>
          <p className="text-xs text-zinc-500 mt-1">
            ระบุจำนวนไอเทมที่ได้รับในวอร์ คำนวณจัดสรรหน้า/ช่อง (4 ช่อง/หน้า) และส่งเข้า Discord
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setActiveTab("pool")}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "pool"
                ? "bg-teal-700 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            POOL
          </button>
          <button
            onClick={() => setActiveTab("snapshots")}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "snapshots"
                ? "bg-teal-700 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            SNAPSHOTS
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`px-4 py-3 rounded-lg text-xs font-medium border ${
            toast.type === "ok"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* ─── TAB 1: POOL ────────────────────────────────────────── */}
      {activeTab === "pool" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Inputs (4 cols) */}
          <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                POOL NAME
              </label>
              <input
                type="text"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder="Guild League : September 29, 2026"
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-all font-medium"
              />
              {latestSession && (
                <p className="text-[10px] text-emerald-500 mt-1.5 font-mono">
                  โหลดจาก DB: {latestSession.event_name} ({latestSession.session_date})
                </p>
              )}
              {!latestSession && (
                <p className="text-[10px] text-zinc-600 mt-1.5">
                  ยังไม่มีข้อมูล session ใน DB — กรุณาสร้างอีเวนต์ใน /queues ก่อน
                </p>
              )}
            </div>

            {/* 2x2 Grid for 4 Items */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1.5 truncate">
                  Card Fragment (สมุด)
                </label>
                <input
                  type="number"
                  min={0}
                  value={albumQty}
                  onChange={(e) => setAlbumQty(e.target.value)}
                  className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 py-2 text-center text-sm font-bold font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1.5 truncate">
                  Illusion Card (เศษบอส)
                </label>
                <input
                  type="number"
                  min={0}
                  value={puppetQty}
                  onChange={(e) => setPuppetQty(e.target.value)}
                  className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 py-2 text-center text-sm font-bold font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1.5 truncate">
                  Light-Dark (ขาว)
                </label>
                <input
                  type="number"
                  min={0}
                  value={whiteQty}
                  onChange={(e) => setWhiteQty(e.target.value)}
                  className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 py-2 text-center text-sm font-bold font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1.5 truncate">
                  Time-Space (แดง)
                </label>
                <input
                  type="number"
                  min={0}
                  value={redBlackQty}
                  onChange={(e) => setRedBlackQty(e.target.value)}
                  className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 py-2 text-center text-sm font-bold font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {/* Assigned Member Count Indicator */}
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 text-xs text-zinc-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>สมาชิกใน Assigned Bench:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {assignedMemberNames.length} คน
                </span>
              </div>
              <div className="text-[10px] text-zinc-600 font-mono">
                {getAssignedFromDb()
                  ? "แหล่งข้อมูล: allocated_slots (DB)"
                  : "แหล่งข้อมูล: localStorage / ทั้งหมด"}
              </div>
            </div>

            {/* Apply Pool Button (Teal like image 4) */}
            <button
              onClick={handleApplyPool}
              className="w-full py-2.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs transition-all cursor-pointer shadow-md mt-2"
            >
              Apply Pool
            </button>
          </div>

          {/* Right Panel: POOL PREVIEW (8 cols) */}
          <div className="lg:col-span-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
            {/* Preview Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 sm:pb-4 border-b border-zinc-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-0.5">
                  POOL PREVIEW
                </span>
                <h2 className="text-base sm:text-lg font-bold text-zinc-100">{poolName}</h2>
              </div>

              <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setSnapshotLabel(poolName)
                    setShowSaveModal(true)
                  }}
                  className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer shadow-sm text-center"
                >
                  Save Snapshot
                </button>
                <button
                  onClick={handleCapturePNG}
                  className="px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition-all cursor-pointer shadow-sm text-center"
                >
                  Capture PNG
                </button>
              </div>
            </div>

            {/* Summary Pill Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700">
                Card Fragment (สมุด): <b className="text-zinc-100 font-mono">{albumQty}</b>
              </span>
              <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700">
                Illusion Card (เศษบอส): <b className="text-zinc-100 font-mono">{puppetQty}</b>
              </span>
              <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700">
                Light-Dark (ขาว): <b className="text-zinc-100 font-mono">{whiteQty}</b>
              </span>
              <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700">
                Time-Space (แดง): <b className="text-zinc-100 font-mono">{redBlackQty}</b>
              </span>
            </div>

            {/* Page Batches Navigation (if more than 10 pages) */}
            {totalPageBatches > 1 && (
              <div className="flex items-center justify-between bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-2 text-xs">
                <span className="text-zinc-400">
                  แสดงหน้า {((currentPageView - 1) * 10) + 1} - {Math.min(currentPageView * 10, totalPages)} จาก {totalPages} หน้า
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPageView((p) => Math.max(1, p - 1))}
                    disabled={currentPageView <= 1}
                    className="px-2.5 py-1 rounded bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs cursor-pointer"
                  >
                    ← ก่อนหน้า
                  </button>
                  <span className="text-zinc-300 px-1 font-mono">{currentPageView}/{totalPageBatches}</span>
                  <button
                    onClick={() => setCurrentPageView((p) => Math.min(totalPageBatches, p + 1))}
                    disabled={currentPageView >= totalPageBatches}
                    className="px-2.5 py-1 rounded bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs cursor-pointer"
                  >
                    ถัดไป →
                  </button>
                </div>
              </div>
            )}

            {/* Grouped Pages View (4 slots per page, exactly like Image 4) */}
            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
              {visiblePages.map((pg) => (
                <div
                  key={pg.page_number}
                  className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-4 space-y-2.5"
                >
                  <div className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wide">
                    PAGE {pg.page_number}/{totalPages}
                  </div>

                  <div className="space-y-2">
                    {pg.slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-800/80 border border-zinc-700/70 rounded-lg px-3.5 py-2 text-xs"
                      >
                        <span className="text-zinc-300 font-medium whitespace-nowrap">
                          {slot.item_label} #{slot.slot_index}
                        </span>
                        <input
                          type="text"
                          value={slot.member_name}
                          onChange={(e) => handleSlotMemberChange(slot.id, e.target.value)}
                          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-100 font-medium w-full sm:w-56 focus:outline-none focus:border-zinc-500 transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SNAPSHOTS (Image 5 UI) ────────────────────────── */}
      {activeTab === "snapshots" && (
        <div className="space-y-3">
          {snapshots.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl py-16 text-center text-zinc-600 text-xs">
              ยังไม่มี Snapshot ที่บันทึกไว้ (สามารถกด Save Snapshot ในแท็บ POOL ได้)
            </div>
          ) : (
            snapshots.map((snap) => (
              <div
                key={snap.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-zinc-700 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-sm text-zinc-100">
                      {snap.snapshot_label || snap.event_name}
                    </h3>
                    {snap.discord_sent ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-medium">
                        ส่ง Discord แล้ว
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700 font-medium">
                        ยังไม่ส่ง
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 font-mono mt-1">
                    {snap.queue_entries ?? 0} queue entries
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleSelectSnapshot(snap)}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer shadow-sm text-center"
                  >
                    Select
                  </button>
                  <button
                    onClick={() => handleSendToDiscord(snap)}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50 text-center"
                  >
                    Send to Discord
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Save Snapshot Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-zinc-100">บันทึก Snapshot</h3>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">ชื่อ Snapshot</label>
              <input
                type="text"
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder="Guild League : September 29, 2026"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                autoFocus
              />
            </div>

            <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3 text-xs space-y-1">
              <div className="text-zinc-500 text-[11px] mb-1">สรุปข้อมูลที่จะบันทึก:</div>
              <div className="flex justify-between text-zinc-300">
                <span>Card Fragment (สมุด):</span>
                <span className="font-mono font-bold">{albumQty}</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Illusion Card (เศษบอส):</span>
                <span className="font-mono font-bold">{puppetQty}</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Light-Dark (ขาว):</span>
                <span className="font-mono font-bold">{whiteQty}</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Time-Space (แดง):</span>
                <span className="font-mono font-bold">{redBlackQty}</span>
              </div>
              <div className="flex justify-between text-emerald-400 pt-1 border-t border-zinc-700 font-bold">
                <span>จำนวนสล็อตทั้งหมด:</span>
                <span>{slotsList.length} ช่อง ({totalPages} หน้า)</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveSnapshot}
                disabled={busy || !snapshotLabel.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
              >
                {busy ? "กำลังบันทึก..." : "ยืนยันบันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
