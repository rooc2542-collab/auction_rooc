"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ITEM_CONFIG } from "@/lib/constants"

type ItemKey = "Album" | "Puppet" | "White" | "RedBlack"
const ITEM_KEYS: ItemKey[] = ["Album", "Puppet", "White", "RedBlack"]

export interface CreditUser {
  user_id: string
  display_name: string
  discord_id: string
  job_class?: string | null
  items: Record<ItemKey, number>
}

export interface ProfileMember {
  id: string
  display_name: string
  discord_id: string
  job_class?: string | null
  role?: string
}

interface CreditsManagerClientProps {
  initialUsers: CreditUser[]
  allMembers: ProfileMember[]
  isAdmin: boolean
}

export default function CreditsManagerClient({
  initialUsers,
  allMembers,
  isAdmin,
}: CreditsManagerClientProps) {
  const router = useRouter()
  const [users, setUsers] = useState<CreditUser[]>(initialUsers)
  const [search, setSearch] = useState("")

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<CreditUser | null>(null)
  const [editForm, setEditForm] = useState<Record<ItemKey, number>>({
    Album: 0,
    Puppet: 0,
    White: 0,
    RedBlack: 0,
  })

  // Add Member Modal State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedAddUserId, setSelectedAddUserId] = useState("")
  const [addForm, setAddForm] = useState<Record<ItemKey, number>>({
    Album: 0,
    Puppet: 0,
    White: 0,
    RedBlack: 0,
  })

  // Saving / Toast state
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null)

  function showToast(text: string, type: "success" | "error" = "success") {
    setToast({ type, text })
    setTimeout(() => {
      setToast(null)
    }, 3500)
  }

  // Filtered users for table
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.display_name?.toLowerCase().includes(q) ||
        u.discord_id?.toLowerCase().includes(q) ||
        u.job_class?.toLowerCase().includes(q)
    )
  }, [users, search])

  // Open Edit Modal for existing row
  function openEdit(u: CreditUser) {
    setEditingUser(u)
    setEditForm({
      Album: u.items.Album || 0,
      Puppet: u.items.Puppet || 0,
      White: u.items.White || 0,
      RedBlack: u.items.RedBlack || 0,
    })
  }

  // Open Add Member Modal
  function openAddModal() {
    setIsAddOpen(true)
    const firstNonExisting = allMembers.find((m) => !users.some((u) => u.user_id === m.id))
    setSelectedAddUserId(firstNonExisting ? firstNonExisting.id : allMembers[0]?.id || "")
    setAddForm({
      Album: 0,
      Puppet: 0,
      White: 0,
      RedBlack: 0,
    })
  }

  // Save Edit
  async function handleSaveEdit() {
    if (!editingUser) return
    setSaving(true)
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: editingUser.user_id,
          credits: editForm,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึก")

      // Update state locally
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === editingUser.user_id ? { ...u, items: { ...editForm } } : u
        )
      )

      showToast(`บันทึกยอดค้างสะสมของ ${editingUser.display_name} เรียบร้อยแล้ว`, "success")
      setEditingUser(null)
      router.refresh()
    } catch (err: any) {
      showToast(err.message || "บันทึกไม่สำเร็จ", "error")
    } finally {
      setSaving(false)
    }
  }

  // Save New Member Credit
  async function handleSaveAdd() {
    if (!selectedAddUserId) return
    const targetMember = allMembers.find((m) => m.id === selectedAddUserId)
    if (!targetMember) return

    setSaving(true)
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: targetMember.id,
          credits: addForm,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึก")

      // Update or insert into users list
      setUsers((prev) => {
        const existingIdx = prev.findIndex((u) => u.user_id === targetMember.id)
        if (existingIdx >= 0) {
          const updated = [...prev]
          updated[existingIdx] = {
            ...updated[existingIdx],
            items: { ...addForm },
          }
          return updated
        }
        return [
          {
            user_id: targetMember.id,
            display_name: targetMember.display_name,
            discord_id: targetMember.discord_id,
            job_class: targetMember.job_class,
            items: { ...addForm },
          },
          ...prev,
        ]
      })

      showToast(`เพิ่มยอดค้างสะสมของ ${targetMember.display_name} เรียบร้อยแล้ว`, "success")
      setIsAddOpen(false)
      router.refresh()
    } catch (err: any) {
      showToast(err.message || "บันทึกไม่สำเร็จ", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold flex items-center gap-2 transition-all ${
            toast.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
              : "bg-rose-600 text-white border-rose-500 shadow-rose-500/20"
          }`}
        >
          <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            ยอดค้างสะสม (Carry Credits)
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            สะสมจากการเลือก &quot;Join / Do not bid&quot; — นำไปใช้ต่อรอบถัดไป
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="ค้นหาสมาชิก..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 sm:w-60 px-3 py-1.5 pl-8 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
              🔍
            </span>
          </div>

          {/* Add / Adjust Credit Button for Admin */}
          {isAdmin && (
            <button
              onClick={openAddModal}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm shadow-blue-600/20"
            >
              <span>➕ ปรับเครดิตสมาชิก</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Card */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-16 text-center space-y-2 shadow-xs">
          <div className="text-3xl">📋</div>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            {search ? "ไม่พบสมาชิกที่ตรงกับการค้นหา" : "ยังไม่มียอดค้างสะสมในระบบ"}
          </p>
          {isAdmin && (
            <button
              onClick={openAddModal}
              className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>➕ ปรับเครดิตสมาชิก</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-left bg-zinc-50/50 dark:bg-zinc-900/50">
                  <th className="px-5 py-3 font-semibold">สมาชิก</th>
                  {ITEM_KEYS.map((key) => (
                    <th key={key} className="px-4 py-3 font-semibold text-center">
                      {ITEM_CONFIG[key].label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-center">รวม</th>
                  {isAdmin && (
                    <th className="px-5 py-3 font-semibold text-center w-24">จัดการ</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredUsers.map((u) => {
                  const total = Object.values(u.items).reduce((a, b) => a + (Number(b) || 0), 0)
                  return (
                    <tr
                      key={u.user_id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Member Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200 font-bold text-xs shrink-0">
                            {u.display_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {u.display_name}
                            </div>
                            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                              {u.job_class && <span>{u.job_class}</span>}
                              {u.discord_id && (
                                <span className="font-mono text-zinc-400 dark:text-zinc-500">
                                  ID: {u.discord_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Items Credits */}
                      {ITEM_KEYS.map((key) => {
                        const val = u.items[key] || 0
                        return (
                          <td key={key} className="px-4 py-3.5 text-center">
                            {val > 0 ? (
                              <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                                +{val}
                              </span>
                            ) : (
                              <span className="text-zinc-300 dark:text-zinc-700 font-medium">—</span>
                            )}
                          </td>
                        )
                      })}

                      {/* Total */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-zinc-800 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-0.5 rounded-full text-xs">
                          +{total}
                        </span>
                      </td>

                      {/* Admin Actions */}
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => openEdit(u)}
                            className="px-3 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1 mx-auto"
                          >
                            <span>✏️</span>
                            <span>แก้ไข</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Modal 1: แก้ไขยอดค้างสะสม (Edit Modal) ──────────────── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>✏️ แก้ไขยอดค้างสะสม (Carry Credits)</span>
                </h3>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                    {editingUser.display_name}
                  </span>
                  {editingUser.job_class && <span>({editingUser.job_class})</span>}
                  {editingUser.discord_id && (
                    <span className="font-mono text-zinc-400">ID: {editingUser.discord_id}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Item Inputs */}
            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              {ITEM_KEYS.map((key) => {
                const cfg = ITEM_CONFIG[key]
                const val = editForm[key] || 0
                return (
                  <div
                    key={key}
                    className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {cfg.desc}
                      </div>
                    </div>

                    {/* Stepper Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            [key]: Math.max(0, val - 1),
                          }))
                        }
                        className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold text-zinc-700 dark:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={val}
                        onChange={(e) => {
                          const num = Math.max(0, parseInt(e.target.value) || 0)
                          setEditForm((prev) => ({ ...prev, [key]: num }))
                        }}
                        className="w-14 text-center py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-bold text-amber-600 dark:text-amber-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            [key]: val + 1,
                          }))
                        }
                        className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold text-zinc-700 dark:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        +
                      </button>

                      {/* Quick Shortcut Buttons */}
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            [key]: val + 5,
                          }))
                        }
                        className="px-1.5 py-1 text-[10px] font-semibold rounded bg-zinc-100 dark:bg-zinc-700/60 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                        title="บวก 5"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            [key]: 0,
                          }))
                        }
                        className="px-1.5 py-1 text-[10px] font-semibold rounded bg-zinc-100 dark:bg-zinc-700/60 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                        title="รีเซ็ตเป็น 0"
                      >
                        0
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Total Preview */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/50 flex items-center justify-between text-xs sm:text-sm">
              <span className="text-blue-800 dark:text-blue-300 font-medium">
                ยอดรวมสะสมหลังแก้ไข:
              </span>
              <span className="font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-blue-900/60 border border-blue-200 dark:border-blue-800 px-3 py-0.5 rounded-full text-xs">
                +{Object.values(editForm).reduce((a, b) => a + (Number(b) || 0), 0)} แต้ม
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm cursor-pointer transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? "กำลังบันทึก..." : "💾 บันทึกการเปลี่ยนแปลง"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 2: ปรับเครดิตสมาชิกใหม่ (Add / Select Member Modal) ── */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>➕ ปรับเครดิตสะสมให้สมาชิก</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  เลือกสมาชิกและกำหนดจำนวนยอดสะสมที่ต้องการให้
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Member Selection */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                เลือกสมาชิก:
              </label>
              <select
                value={selectedAddUserId}
                onChange={(e) => {
                  const uid = e.target.value
                  setSelectedAddUserId(uid)
                  const existingUser = users.find((u) => u.user_id === uid)
                  if (existingUser) {
                    setAddForm({
                      Album: existingUser.items.Album || 0,
                      Puppet: existingUser.items.Puppet || 0,
                      White: existingUser.items.White || 0,
                      RedBlack: existingUser.items.RedBlack || 0,
                    })
                  } else {
                    setAddForm({ Album: 0, Puppet: 0, White: 0, RedBlack: 0 })
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {allMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name} {m.job_class ? `(${m.job_class})` : ""} - ID: {m.discord_id}
                  </option>
                ))}
              </select>
            </div>

            {/* Item Inputs */}
            <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1">
              {ITEM_KEYS.map((key) => {
                const cfg = ITEM_CONFIG[key]
                const val = addForm[key] || 0
                return (
                  <div
                    key={key}
                    className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {cfg.desc}
                      </div>
                    </div>

                    {/* Stepper Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setAddForm((prev) => ({
                            ...prev,
                            [key]: Math.max(0, val - 1),
                          }))
                        }
                        className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold text-zinc-700 dark:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={val}
                        onChange={(e) => {
                          const num = Math.max(0, parseInt(e.target.value) || 0)
                          setAddForm((prev) => ({ ...prev, [key]: num }))
                        }}
                        className="w-14 text-center py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-bold text-amber-600 dark:text-amber-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setAddForm((prev) => ({
                            ...prev,
                            [key]: val + 1,
                          }))
                        }
                        className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold text-zinc-700 dark:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        +
                      </button>

                      {/* Quick Shortcut Buttons */}
                      <button
                        type="button"
                        onClick={() =>
                          setAddForm((prev) => ({
                            ...prev,
                            [key]: val + 5,
                          }))
                        }
                        className="px-1.5 py-1 text-[10px] font-semibold rounded bg-zinc-100 dark:bg-zinc-700/60 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                        title="บวก 5"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAddForm((prev) => ({
                            ...prev,
                            [key]: 0,
                          }))
                        }
                        className="px-1.5 py-1 text-[10px] font-semibold rounded bg-zinc-100 dark:bg-zinc-700/60 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                        title="รีเซ็ตเป็น 0"
                      >
                        0
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Total Preview */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/50 flex items-center justify-between text-xs sm:text-sm">
              <span className="text-blue-800 dark:text-blue-300 font-medium">
                ยอดรวมสะสม:
              </span>
              <span className="font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-blue-900/60 border border-blue-200 dark:border-blue-800 px-3 py-0.5 rounded-full text-xs">
                +{Object.values(addForm).reduce((a, b) => a + (Number(b) || 0), 0)} แต้ม
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveAdd}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs sm:text-sm cursor-pointer transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? "กำลังบันทึก..." : "💾 บันทึกยอดสะสม"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
