"use client"

import { useState, useEffect } from "react"
import { ITEM_CONFIG } from "@/lib/constants"

export interface Candidate {
  user_id: string
  display_name: string
  discord_id: string
  carry_credit: number
  roll?: number
  won?: boolean
}

export interface ShortageItemData {
  item_type: string
  label: string
  total_quantity: number
  personal_limit: number
  guaranteedCandidates: Candidate[]
  rollCandidates: Candidate[]
  remainingSlotsToRoll: number
}

interface RandomRollModalProps {
  isOpen: boolean
  onClose: () => void
  shortageItems: ShortageItemData[]
  onApplyRolls: (
    itemType: string,
    results: Array<{ user_id: string; roll: number; won: boolean }>
  ) => void
}

export default function RandomRollModal({
  isOpen,
  onClose,
  shortageItems,
  onApplyRolls,
}: RandomRollModalProps) {
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const [isRolling, setIsRolling] = useState(false)
  const [rolls, setRolls] = useState<Record<string, number>>({})
  const [tempDisplayRolls, setTempDisplayRolls] = useState<Record<string, number>>({})

  // Reset or pick first item when opening
  useEffect(() => {
    if (isOpen) {
      setActiveItemIndex(0)
      setRolls({})
    }
  }, [isOpen])

  if (!isOpen || shortageItems.length === 0) return null

  const currentItem = shortageItems[activeItemIndex] || shortageItems[0]
  const itemConfig = (ITEM_CONFIG as any)[currentItem.item_type] || {
    label: currentItem.label,
    badge: "bg-purple-100 text-purple-800",
  }

  // Handle Batch Roll: rolls for all competing candidates at once
  const handleRollAll = () => {
    if (isRolling || currentItem.rollCandidates.length === 0) return

    setIsRolling(true)

    // Generate unique random numbers between 1 and 100 for all candidates
    const usedNumbers = new Set<number>()
    const newRolls: Record<string, number> = {}

    currentItem.rollCandidates.forEach((c) => {
      let r = Math.floor(Math.random() * 100) + 1
      while (usedNumbers.has(r)) {
        r = Math.floor(Math.random() * 100) + 1
      }
      usedNumbers.add(r)
      newRolls[c.user_id] = r
    })

    // Animation: rapidly cycle numbers for 1.2s
    let intervalCount = 0
    const interval = setInterval(() => {
      intervalCount++
      const fakeRolls: Record<string, number> = {}
      currentItem.rollCandidates.forEach((c) => {
        fakeRolls[c.user_id] = Math.floor(Math.random() * 100) + 1
      })
      setTempDisplayRolls(fakeRolls)

      if (intervalCount > 10) {
        clearInterval(interval)
        setRolls(newRolls)
        setIsRolling(false)
      }
    }, 100)
  }

  // Check if roll is done
  const hasRolled = currentItem.rollCandidates.some((c) => rolls[c.user_id] !== undefined)

  // Sort candidates by roll if available
  const sortedRollCandidates = [...currentItem.rollCandidates].sort((a, b) => {
    const rollA = rolls[a.user_id] ?? -1
    const rollB = rolls[b.user_id] ?? -1
    if (rollB !== rollA) return rollB - rollA
    return a.display_name.localeCompare(b.display_name)
  })

  // Apply to parent
  const handleConfirm = () => {
    const results = sortedRollCandidates.map((c, index) => ({
      user_id: c.user_id,
      roll: rolls[c.user_id] || 0,
      won: index < currentItem.remainingSlotsToRoll,
    }))

    onApplyRolls(currentItem.item_type, results)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-5 sm:p-7 w-full max-w-2xl shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎲</span>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                สุ่มผู้โชคดี (Random Roll ผู้ขอมากกว่าจำนวนของ)
              </h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              สุ่มจับฉลากทีเดียวพร้อมกันทั้งหมดอย่างโปร่งใส ผู้ที่ไม่ได้รับของจะได้รับแต้มชดเชย Carry Credit +1 สำหรับรอบถัดไป
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Item Tabs if multiple shortage items */}
        {shortageItems.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {shortageItems.map((item, idx) => (
              <button
                key={item.item_type}
                onClick={() => {
                  setActiveItemIndex(idx)
                  setRolls({})
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  activeItemIndex === idx
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {item.label} (ของ {item.total_quantity} / ขอ {item.guaranteedCandidates.length + item.rollCandidates.length})
              </button>
            ))}
          </div>
        )}

        {/* Current Item Info Card */}
        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${itemConfig.badge}`}>
              {currentItem.label}
            </span>
            <span className="text-zinc-600 dark:text-zinc-300 font-medium">
              จำนวนของในคลัง: <b className="text-zinc-900 dark:text-zinc-100">{currentItem.total_quantity} ชิ้น</b>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-semibold">
              โควตาที่ต้องสุ่ม: {currentItem.remainingSlotsToRoll} สล็อต
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-semibold">
              ตกรอบได้แต้มชดเชย: {Math.max(0, currentItem.rollCandidates.length - currentItem.remainingSlotsToRoll)} คน
            </span>
          </div>
        </div>

        {/* Section 1: Guaranteed by Carry Credit (if any) */}
        {currentItem.guaranteedCandidates.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <span>⭐ ได้รับสิทธิ์ก่อนแน่นอน (มี Carry Credit สะสมจากรอบก่อน)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentItem.guaranteedCandidates.map((c) => (
                <div
                  key={c.user_id}
                  className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">{c.display_name}</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                    +{c.carry_credit} Credit (การันตี)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 2: Competing Candidates to Roll */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <span>🎯 ผู้เข้าชิงที่ต้องสุ่ม ({currentItem.rollCandidates.length} คน แย่ง {currentItem.remainingSlotsToRoll} สล็อต)</span>
            </div>

            {/* Single Click Roll All Button */}
            <button
              type="button"
              onClick={handleRollAll}
              disabled={isRolling}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white transition-all cursor-pointer flex items-center gap-2 shadow-md ${
                isRolling
                  ? "bg-amber-600 animate-pulse cursor-not-allowed"
                  : hasRolled
                  ? "bg-purple-600 hover:bg-purple-500 active:scale-95"
                  : "bg-blue-600 hover:bg-blue-500 active:scale-95 shadow-blue-600/30"
              }`}
            >
              <span className={isRolling ? "animate-spin" : ""}>🎲</span>
              <span>{isRolling ? "กำลังทอยแต้ม..." : hasRolled ? "ทอยสุ่มใหม่อีกครั้ง" : "สุ่มผู้โชคดีทั้งหมดทันที (Roll All)"}</span>
            </button>
          </div>

          {/* Candidates List with Dice Roll Display */}
          <div className="max-h-[42vh] overflow-y-auto space-y-2 pr-1 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-2 bg-zinc-50/50 dark:bg-zinc-950/40">
            {sortedRollCandidates.map((c, index) => {
              const displayRoll = isRolling ? tempDisplayRolls[c.user_id] : rolls[c.user_id]
              const isWinner = hasRolled && !isRolling && index < currentItem.remainingSlotsToRoll
              const isCompensated = hasRolled && !isRolling && index >= currentItem.remainingSlotsToRoll

              return (
                <div
                  key={c.user_id}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isWinner
                      ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                      : isCompensated
                      ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        isWinner
                          ? "bg-emerald-600 text-white"
                          : isCompensated
                          ? "bg-amber-500 text-white"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      {hasRolled && !isRolling ? `#${index + 1}` : index + 1}
                    </div>

                    <div>
                      <div className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                        {c.display_name}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {isWinner ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                            🟢 ชนะการสุ่ม (ได้รับสล็อต)
                          </span>
                        ) : isCompensated ? (
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">
                            🎟️ ได้รับแต้มสะสมชดเชย +1 สำหรับรอบหน้า
                          </span>
                        ) : (
                          <span>รอกดสุ่มลูกเต๋า</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dice Score Box */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-sm min-w-16 text-center ${
                        displayRoll !== undefined
                          ? isWinner
                            ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                            : isCompensated
                            ? "bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                            : "bg-blue-100 text-blue-900 border-blue-300"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      {displayRoll !== undefined ? `🎲 ${displayRoll}` : "🎲 --"}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!hasRolled || isRolling}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm cursor-pointer transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span>✅ ยืนยันผลการสุ่มและจัดสล็อต</span>
          </button>
        </div>
      </div>
    </div>
  )
}
