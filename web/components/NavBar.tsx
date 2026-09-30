"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"

const NAV_ITEMS = [
  { href: "/", label: "ภาพรวม" },
  { href: "/queues", label: "จัดคิวและสล็อต" },
  { href: "/members", label: "สมาชิก" },
  { href: "/credits", label: "เครดิตสะสม" },
  { href: "/history", label: "ประวัติ" },
  { href: "/admin", label: "แอดมิน" },
]

export default function NavBar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()

  return (
    <header className="bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14 gap-4">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold text-sm text-zinc-100 hover:text-white transition-colors shrink-0"
        >
          <span className="w-6 h-6 rounded-md bg-zinc-100 text-zinc-950 flex items-center justify-center text-xs font-bold tracking-tighter">
            R
          </span>
          <span className="tracking-tight whitespace-nowrap">ระบบประมูล</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {NAV_ITEMS.filter((item) => isAdmin || item.href !== "/admin").map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-zinc-800/90 text-zinc-100 border border-zinc-700/70"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {item.label}
              </Link>
            )
          })}

          <div className="h-4 w-px bg-zinc-800 mx-1 shrink-0" />

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </header>
  )
}
