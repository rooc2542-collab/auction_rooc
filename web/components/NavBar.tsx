"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { ThemeToggle } from "@/components/ThemeToggle"

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen((p) => !p)}
            className="p-2 rounded-lg bg-zinc-200/80 hover:bg-zinc-300/80 text-zinc-800 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer border border-zinc-300 dark:border-zinc-700/60"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? (
              // Close icon
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Hamburger icon
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-4 py-3 space-y-1.5 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-1.5 pb-2">
            {visibleNavItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold text-center transition-all ${
                    active
                      ? "bg-teal-700 hover:bg-teal-600 text-white border border-teal-600 shadow-sm"
                      : "bg-zinc-200/70 hover:bg-zinc-300/70 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-800"
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">ระบบประมูล ROOC Geffen</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
