"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { ThemeToggle } from "@/components/ThemeToggle"
import BottomNavBar from "@/components/BottomNavBar"

const NAV_ITEMS = [
  { href: "/", label: "ภาพรวม" },
  { href: "/bench", label: "Bench Organizer" },
  { href: "/queues", label: "จัดคิวและสล็อต" },
  { href: "/members", label: "สมาชิก" },
  { href: "/credits", label: "เครดิตสะสม" },
  { href: "/history", label: "ประวัติ" },
  { href: "/guide", label: "คู่มือ" },
  { href: "/admin", label: "แอดมิน" },
]

export default function NavBar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()

  const visibleNavItems = NAV_ITEMS.filter((item) => isAdmin || item.href !== "/admin")

  return (
    <header className="bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14 gap-3">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold text-sm text-zinc-900 dark:text-zinc-100 hover:text-black dark:hover:text-white transition-colors shrink-0"
        >
          <span className="w-6 h-6 rounded-md bg-teal-700 text-white flex items-center justify-center text-xs font-bold tracking-tighter shadow-sm">
            R
          </span>
          <span className="tracking-tight font-bold whitespace-nowrap text-zinc-900 dark:text-zinc-100">
            ระบบประมูล RoOC
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {visibleNavItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-teal-700 text-white shadow-sm font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                }`}
              >
                {item.label}
              </Link>
            )
          })}

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800 mx-1 shrink-0" />
          <ThemeToggle />
          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800 mx-1 shrink-0" />

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            ออกจากระบบ
          </button>
        </div>

        {/* Mobile Header Controls */}
        <div className="flex lg:hidden items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Modern Thumb-Friendly Mobile Bottom Navigation Bar */}
      <BottomNavBar isAdmin={isAdmin} />
    </header>
  )
}
