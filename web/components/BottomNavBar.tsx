"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { ThemeToggle } from "@/components/ThemeToggle"

interface BottomNavBarProps {
  isAdmin?: boolean
}

export default function BottomNavBar({ isAdmin }: BottomNavBarProps) {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Primary 4 tabs + 1 "More" button
  const primaryTabs = [
    {
      href: "/",
      label: "ภาพรวม",
      icon: (active: boolean) => (
        <svg
          className={`w-5 h-5 transition-transform ${active ? "scale-110 text-teal-600 dark:text-teal-400" : "text-zinc-500 dark:text-zinc-400"}`}
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={active ? 1.5 : 2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: "/queues",
      label: "คิว & สล็อต",
      icon: (active: boolean) => (
        <svg
          className={`w-5 h-5 transition-transform ${active ? "scale-110 text-teal-600 dark:text-teal-400" : "text-zinc-500 dark:text-zinc-400"}`}
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={active ? 1.5 : 2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      href: "/members",
      label: "สมาชิก",
      icon: (active: boolean) => (
        <svg
          className={`w-5 h-5 transition-transform ${active ? "scale-110 text-teal-600 dark:text-teal-400" : "text-zinc-500 dark:text-zinc-400"}`}
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={active ? 1.5 : 2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      href: "/credits",
      label: "เครดิต",
      icon: (active: boolean) => (
        <svg
          className={`w-5 h-5 transition-transform ${active ? "scale-110 text-teal-600 dark:text-teal-400" : "text-zinc-500 dark:text-zinc-400"}`}
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={active ? 1.5 : 2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  // Secondary items in Bottom Sheet Drawer
  const secondaryItems = [
    {
      href: "/bench",
      label: "Bench Organizer",
      desc: "จัดคนลงสล็อต Bench สำรอง",
      icon: "🪑",
    },
    {
      href: "/history",
      label: "ประวัติผลการจัด",
      desc: "ย้อนดูประวัติการคำนวณและไอเทม",
      icon: "📜",
    },
    {
      href: "/guide",
      label: "คู่มือการใช้งาน",
      desc: "กฎเกณฑ์และวิธีการจัดคิว",
      icon: "📖",
    },
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: "แอดมิน (Admin Panel)",
            desc: "จัดการสิทธิ์สมาชิกและไอเทม",
            icon: "⚙️",
          },
        ]
      : []),
  ]

  const isSecondaryActive = secondaryItems.some((item) => pathname === item.href)

  return (
    <>
      {/* Bottom Sheet Drawer for "More" Menu */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end animate-in fade-in duration-200">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSheetOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative z-10 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-t-2xl shadow-2xl p-4 max-h-[85vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">เมนูเพิ่มเติม</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">เข้าถึงหน้าย่อยและการตั้งค่าอื่นๆ</p>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Menu List */}
            <div className="space-y-1.5 mb-4">
              {secondaryItems.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      active
                        ? "bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 font-semibold"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800/70 text-zinc-800 dark:text-zinc-200 border border-transparent"
                    }`}
                  >
                    <span className="text-xl shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{item.desc}</div>
                    </div>
                    {active && (
                      <span className="w-2 h-2 rounded-full bg-teal-600 dark:teal-400 shrink-0" />
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Extra Controls (Theme + SignOut) */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">ธีม:</span>
                <ThemeToggle />
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="px-3 py-2 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      >
        <div className="grid grid-cols-5 h-16 max-w-md mx-auto items-stretch">
          {primaryTabs.map((tab) => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-all ${
                  active
                    ? "text-teal-700 dark:text-teal-400 font-bold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <div className="relative">
                  {tab.icon(active)}
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400" />
                  )}
                </div>
                <span className="truncate">{tab.label}</span>
              </Link>
            )
          })}

          {/* 5th Tab: "More" Menu Toggle */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-all cursor-pointer ${
              isSecondaryActive || sheetOpen
                ? "text-teal-700 dark:text-teal-400 font-bold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <div className="relative">
              <svg
                className={`w-5 h-5 transition-transform ${(isSecondaryActive || sheetOpen) ? "scale-110 text-teal-600 dark:text-teal-400" : "text-zinc-500 dark:text-zinc-400"}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {isSecondaryActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400" />
              )}
            </div>
            <span className="truncate">เพิ่มเติม</span>
          </button>
        </div>
      </nav>
    </>
  )
}
