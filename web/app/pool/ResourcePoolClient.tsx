"use client"

import { useState, useMemo } from "react"

type ItemKey = "Album" | "Puppet" | "White" | "RedBlack"

const ITEM_KEYS: ItemKey[] = ["Album", "Puppet", "White", "RedBlack"]

const ITEMS_META: Record<ItemKey, { label: string; badge: string; color: string }> = {
  Album: { label: "สมุดการ์ด", badge: "bg-violet-950 text-violet-300 border border-violet-800/60", color: "violet" },
  Puppet: { label: "เศษการ์ดบอส", badge: "bg-amber-950 text-amber-300 border border-amber-800/60", color: "amber" },
  White: { label: "ขนนกขาว", badge: "bg-zinc-800 text-zinc-200 border border-zinc-600", color: "zinc" },
  RedBlack: { label: "ขนนกดำแดง", badge: "bg-rose-950 text-rose-300 border border-rose-800/60", color: "rose" },
}

interface Session {
  event_name: string
  session_date: string
  item_type: string
  total_quantity: number
  personal_limit: number
  status: string
}

interface Slot {
  event_name: string
  session_date: string
  user_id: string
  item_type: string
  status: string
  page_number: number
  slot_number: number
  profiles?: { display_name: string; discord_id: string }
}

interface Member {
  id: string
  display_name: string
  discord_id: string
}

interface Snapshot {
  id: string
  event_name: string
  event_date: string
  snapshot_label: string
  discord_sent: boolean
  created_at: string
  created_by: string
  pool_data: Record<string, { total: number; limit_per_person: number }>
  member_data: Array<{
    user_id: string
    display_name: string
    discord_id: string
    items: Record<string, number>
  }>
}

interface Props {
  isAdmin: boolean
  initialSessions: Session[]
  initialSlots: Slot[]
  initialMembers: Member[]
  initialSnapshots: Snapshot[]
}

export default function ResourcePoolClient({
  isAdmin,
  initialSessions,
  initialSlots,
  initialMembers,
  initialSnapshots,
}: Props) {
  const [activeTab, setActiveTab] = useState<"pool" | "snapshots">("pool")
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  // Event selector
  const eventOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of initialSessions) set.add(`${s.event_name}|${s.session_date}`)
    return Array.from(set).sort().reverse()
  }, [initialSessions])

  const defaultEvent = eventOptions[0] || ""
  const [selectedEvent, setSelectedEvent] = useState(defaultEvent)

  const [eventName, eventDate] = selectedEvent.split("|")

  // Pool data from sessions for selected event
  const poolSessions = useMemo(() =>
    initialSessions.filter(s => s.event_name === eventName && s.session_date === eventDate),
    [initialSessions, eventName, eventDate]
  )

  // Manual pool input state (admin can adjust values before snapshotting)
  const buildPoolInputs = (evName: string, evDate: string) => {
    const result: Record<ItemKey, { total: string; limit: string }> = {} as any
    for (const k of ITEM_KEYS) {
      const sess = initialSessions.find(s => s.event_name === evName && s.session_date === evDate && s.item_type === k)
      result[k] = {
        total: String(sess?.total_quantity ?? 0),
        limit: String(sess?.personal_limit ?? 1),
      }
    }
    return result
  }

  const [poolInputs, setPoolInputs] = useState(() => buildPoolInputs(eventName, eventDate))

  const handleEventChange = (val: string) => {
    setSelectedEvent(val)
    const [en, ed] = val.split("|")
    setPoolInputs(buildPoolInputs(en, ed))
  }

  // Slots for selected event
  const eventSlots = useMemo(() =>
    initialSlots.filter(s => s.event_name === eventName && s.session_date === eventDate),
    [initialSlots, eventName, eventDate]
  )

  // Member allocation summary
  const memberSummary = useMemo(() => {
    const map: Record<string, { display_name: string; discord_id: string; items: Record<ItemKey, number> }> = {}
    for (const slot of eventSlots) {
      const uid = slot.user_id
      if (!uid) continue
      if (!map[uid]) {
        map[uid] = {
          display_name: slot.profiles?.display_name || "Unknown",
          discord_id: slot.profiles?.discord_id || "",
          items: { Album: 0, Puppet: 0, White: 0, RedBlack: 0 },
        }
      }
      if (ITEM_KEYS.includes(slot.item_type as ItemKey)) {
        map[uid].items[slot.item_type as ItemKey] += 1
      }
    }
    return Object.entries(map)
      .map(([uid, v]) => ({ user_id: uid, ...v }))
      .sort((a, b) => a.display_name.localeCompare(b.display_name, "th"))
  }, [eventSlots])

  // Generate Discord announcement text
  const buildAnnouncementText = (evName: string, evDate: string, pool: typeof poolInputs, members: typeof memberSummary) => {
    const lines: string[] = []
    lines.push(`Resource Pool — ${evName} (${evDate})`)
    lines.push("")
    lines.push("[ Pool Summary ]")
    for (const k of ITEM_KEYS) {
      const total = pool[k]?.total || "0"
      const limit = pool[k]?.limit || "1"
      lines.push(`${ITEMS_META[k].label}: ${total} ชิ้น (ลิมิต ${limit}/คน)`)
    }
    lines.push("")
    lines.push("[ Member Allocation ]")
    for (const m of members) {
      const parts = ITEM_KEYS.map(k => `${ITEMS_META[k].label}: ${m.items[k]}`).join(" | ")
      const mention = m.discord_id ? `<@${m.discord_id}>` : m.display_name
      lines.push(`${mention} — ${parts}`)
    }
    return lines.join("\n")
  }

  // Snapshot modal state
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [snapshotLabel, setSnapshotLabel] = useState("")

  const handleSaveSnapshot = async () => {
    if (!snapshotLabel.trim()) return
    setBusy(true)
    try {
      const poolData: Record<string, { total: number; limit_per_person: number }> = {}
      for (const k of ITEM_KEYS) {
        poolData[k] = {
          total: Number(poolInputs[k].total) || 0,
          limit_per_person: Number(poolInputs[k].limit) || 1,
        }
      }
      const memberData = memberSummary.map(m => ({
        user_id: m.user_id,
        display_name: m.display_name,
        discord_id: m.discord_id,
        items: m.items,
      }))
      const res = await fetch("/api/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_snapshot",
          event_name: eventName,
          event_date: eventDate,
          snapshot_label: snapshotLabel.trim(),
          pool_data: poolData,
          member_data: memberData,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setToast({ type: "ok", text: "บันทึก Snapshot เรียบร้อยแล้ว" })
      setShowSaveModal(false)
      setSnapshotLabel("")
      setTimeout(() => window.location.reload(), 700)
    } catch (e: any) {
      setToast({ type: "err", text: e.message })
    } finally {
      setBusy(false)
    }
  }

  // Send to Discord (copy + mark sent)
  const handleSendToDiscord = async (snap: Snapshot) => {
    // Build text from snapshot data
    const lines: string[] = []
    lines.push(`Resource Pool — ${snap.event_name} (${snap.event_date})`)
    lines.push(`[ ${snap.snapshot_label} ]`)
    lines.push("")
    lines.push("[ Pool Summary ]")
    for (const k of ITEM_KEYS) {
      const d = snap.pool_data[k]
      if (d) {
        lines.push(`${ITEMS_META[k].label}: ${d.total} ชิ้น (ลิมิต ${d.limit_per_person}/คน)`)
      }
    }
    lines.push("")
    lines.push("[ Member Allocation ]")
    for (const m of snap.member_data) {
      const parts = ITEM_KEYS.map(k => `${ITEMS_META[k].label}: ${m.items[k] || 0}`).join(" | ")
      const mention = m.discord_id ? `<@${m.discord_id}>` : m.display_name
      lines.push(`${mention} — ${parts}`)
    }
    const text = lines.join("\n")

    try {
      await navigator.clipboard.writeText(text)
      setToast({ type: "ok", text: "คัดลอกข้อความสำหรับ Discord แล้ว" })
    } catch {
      // fallback
    }

    // Mark as sent
    if (!snap.discord_sent) {
      await fetch("/api/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_sent", id: snap.id }),
      })
      setTimeout(() => window.location.reload(), 500)
    }
  }

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm("ลบ Snapshot นี้?")) return
    setBusy(true)
    try {
      await fetch("/api/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_snapshot", id }),
      })
      setToast({ type: "ok", text: "ลบ Snapshot เรียบร้อย" })
      setTimeout(() => window.location.reload(), 500)
    } finally {
      setBusy(false)
    }
  }

  const [snapshots, setSnapshots] = useState(initialSnapshots)
  const [selectedSnap, setSelectedSnap] = useState<Snapshot | null>(null)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Resource Pool</h1>
            <p className="text-zinc-500 text-sm mt-0.5">ติดตามการแจกจ่าย Item และบันทึก Snapshot ส่งให้ Discord</p>
          </div>
          <div className="flex gap-2">
            {(["pool", "snapshots"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-700"
                }`}
              >
                {tab === "pool" ? "POOL" : "SNAPSHOTS"}
              </button>
            ))}
          </div>
        </div>

        {toast && (
          <div
            className={`mt-4 px-4 py-3 rounded-lg text-sm font-medium border ${
              toast.type === "ok"
                ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                : "bg-rose-950/40 border-rose-800/60 text-rose-300"
            }`}
          >
            {toast.text}
          </div>
        )}
      </div>

      {/* POOL TAB */}
      {activeTab === "pool" && (
        <div className="space-y-5">
          {/* Event Selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-zinc-300">อีเวนต์:</label>
              {eventOptions.length > 0 ? (
                <select
                  value={selectedEvent}
                  onChange={e => handleEventChange(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2 text-sm text-zinc-100 focus:outline-none"
                >
                  {eventOptions.map(ev => {
                    const [en, ed] = ev.split("|")
                    return <option key={ev} value={ev}>{en} ({ed})</option>
                  })}
                </select>
              ) : (
                <span className="text-zinc-600 text-sm">ยังไม่มีอีเวนต์ในระบบ</span>
              )}
            </div>
          </div>

          {/* Pool Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ITEM_KEYS.map(k => {
              const meta = ITEMS_META[k]
              const allocCount = eventSlots.filter(s => s.item_type === k).length
              const total = Number(poolInputs[k]?.total) || 0
              const limit = Number(poolInputs[k]?.limit) || 1
              return (
                <div key={k} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <span className="text-2xl font-black font-mono text-zinc-100">{total}</span>
                  </div>
                  <div className="text-xs text-zinc-600">ลิมิต {limit} ชิ้น/คน</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">จัดสรรแล้ว</span>
                    <span className="font-mono font-bold text-emerald-400">{allocCount} / {total}</span>
                  </div>
                  {isAdmin && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                      <div>
                        <label className="block text-[10px] text-zinc-600 mb-1">จำนวนรวม</label>
                        <input
                          type="number" min={0}
                          value={poolInputs[k]?.total || "0"}
                          onChange={e => setPoolInputs(prev => ({ ...prev, [k]: { ...prev[k], total: e.target.value } }))}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-center font-mono text-sm text-zinc-100 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-600 mb-1">ลิมิต/คน</label>
                        <input
                          type="number" min={1}
                          value={poolInputs[k]?.limit || "1"}
                          onChange={e => setPoolInputs(prev => ({ ...prev, [k]: { ...prev[k], limit: e.target.value } }))}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-center font-mono text-sm text-emerald-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Member Allocation Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-100 text-sm">การจัดสรรตามสมาชิก ({memberSummary.length} คน)</h3>
                <p className="text-xs text-zinc-600 mt-0.5">สรุปจำนวน Item ที่แต่ละคนได้รับในอีเวนต์นี้</p>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const text = buildAnnouncementText(eventName, eventDate, poolInputs, memberSummary)
                      navigator.clipboard.writeText(text)
                      setToast({ type: "ok", text: "คัดลอกข้อความ Discord แล้ว" })
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-xs font-medium border border-zinc-600 transition-all cursor-pointer"
                  >
                    คัดลอก Discord
                  </button>
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold transition-all cursor-pointer"
                  >
                    บันทึก Snapshot
                  </button>
                </div>
              )}
            </div>

            {memberSummary.length === 0 ? (
              <div className="py-16 text-center text-zinc-600 text-sm">
                ยังไม่มีการจัดสรร Item ในอีเวนต์นี้
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">สมาชิก</th>
                      {ITEM_KEYS.map(k => (
                        <th key={k} className="px-4 py-3 font-medium text-center">
                          {ITEMS_META[k].label}
                        </th>
                      ))}
                      <th className="px-4 py-3 font-medium text-center">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {memberSummary.map((m, idx) => {
                      const total = ITEM_KEYS.reduce((acc, k) => acc + m.items[k], 0)
                      return (
                        <tr key={m.user_id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3.5 text-zinc-600 font-mono text-xs">#{idx + 1}</td>
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-zinc-100">{m.display_name}</div>
                            <div className="text-xs text-zinc-600">
                              {m.discord_id ? `<@${m.discord_id}>` : "ไม่มี Discord ID"}
                            </div>
                          </td>
                          {ITEM_KEYS.map(k => (
                            <td key={k} className="px-4 py-3.5 text-center">
                              {m.items[k] > 0 ? (
                                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${ITEMS_META[k].badge}`}>
                                  {m.items[k]}
                                </span>
                              ) : (
                                <span className="text-zinc-700 text-xs">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3.5 text-center">
                            <span className="font-bold font-mono text-zinc-300">{total}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SNAPSHOTS TAB */}
      {activeTab === "snapshots" && (
        <div className="space-y-4">
          {initialSnapshots.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-16 text-center text-zinc-600 text-sm">
              ยังไม่มี Snapshot ที่บันทึกไว้ ไปที่แท็บ POOL แล้วกด "บันทึก Snapshot"
            </div>
          ) : (
            initialSnapshots.map(snap => (
              <div key={snap.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-zinc-100">{snap.snapshot_label}</h3>
                      {snap.discord_sent ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                          ส่ง Discord แล้ว
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
                          ยังไม่ได้ส่ง
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-600 mt-1">
                      {snap.event_name} ({snap.event_date}) • บันทึกเมื่อ{" "}
                      {new Date(snap.created_at).toLocaleString("th-TH")} • โดย {snap.created_by || "admin"}
                    </div>
                    {/* Mini pool summary */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {ITEM_KEYS.map(k => {
                        const d = snap.pool_data[k]
                        if (!d) return null
                        return (
                          <span key={k} className={`text-xs px-2 py-1 rounded-lg ${ITEMS_META[k].badge}`}>
                            {ITEMS_META[k].label}: {d.total}
                          </span>
                        )
                      })}
                    </div>
                    {/* Queue count */}
                    <div className="text-xs text-zinc-600 mt-1">
                      {snap.member_data.length} คนในคิว
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSnap(selectedSnap?.id === snap.id ? null : snap)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 cursor-pointer transition-all"
                    >
                      {selectedSnap?.id === snap.id ? "ซ่อน" : "ดูรายละเอียด"}
                    </button>
                    <button
                      onClick={() => handleSendToDiscord(snap)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                    >
                      ส่ง Discord
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-500 hover:text-rose-400 text-xs border border-zinc-700 hover:border-rose-800/60 cursor-pointer transition-all"
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {selectedSnap?.id === snap.id && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-zinc-500 border-b border-zinc-800">
                            <th className="px-3 py-2 text-left">สมาชิก</th>
                            {ITEM_KEYS.map(k => (
                              <th key={k} className="px-3 py-2 text-center">{ITEMS_META[k].label}</th>
                            ))}
                            <th className="px-3 py-2 text-center">รวม</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40">
                          {snap.member_data.map((m, idx) => {
                            const total = ITEM_KEYS.reduce((acc, k) => acc + (m.items[k] || 0), 0)
                            return (
                              <tr key={idx} className="hover:bg-zinc-800/20">
                                <td className="px-3 py-2 text-zinc-300 font-medium">{m.display_name}</td>
                                {ITEM_KEYS.map(k => (
                                  <td key={k} className="px-3 py-2 text-center">
                                    {(m.items[k] || 0) > 0 ? (
                                      <span className={`px-2 py-0.5 rounded ${ITEMS_META[k].badge}`}>
                                        {m.items[k]}
                                      </span>
                                    ) : (
                                      <span className="text-zinc-700">—</span>
                                    )}
                                  </td>
                                ))}
                                <td className="px-3 py-2 text-center font-bold font-mono text-zinc-400">{total}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Save Snapshot Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-100 mb-4">บันทึก Snapshot</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">ชื่อ Snapshot (เช่น รอบที่ 3 สัปดาห์นี้)</label>
                <input
                  type="text"
                  value={snapshotLabel}
                  onChange={e => setSnapshotLabel(e.target.value)}
                  placeholder="ระบุชื่อ Snapshot..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                  autoFocus
                />
              </div>
              <div className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-3 space-y-1">
                <div className="text-xs text-zinc-500 mb-2">Pool ที่จะบันทึก:</div>
                {ITEM_KEYS.map(k => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-zinc-400">{ITEMS_META[k].label}</span>
                    <span className="font-mono text-zinc-300">{poolInputs[k]?.total || 0} ชิ้น (ลิมิต {poolInputs[k]?.limit || 1}/คน)</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowSaveModal(false); setSnapshotLabel("") }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium border border-zinc-700 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveSnapshot}
                disabled={busy || !snapshotLabel.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-900 text-sm font-bold cursor-pointer"
              >
                {busy ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
