"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"

const NAV_ITEMS = [
  { href: "/", label: "📊 ภาพรวม" },
  { href: "/queues", label: "🎯 จัดคิว & สล็อต" },
  { href: "/members", label: "👥 จัดการสมาชิก" },
  { href: "/credits", label: "💳 ยอดสะสม" },
  { href: "/history", label: "📋 ประวัติ" },
  { href: "/admin", label: "⚙️ แอดมิน" },
]

export default function NavBar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-extrabold text-xl text-white hover:text-purple-400 transition-colors">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-lg shadow-md shadow-purple-900/40">
            ⚔️
          </span>
          <span className="tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            ระบบประมูล
          </span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {NAV_ITEMS.filter(item => isAdmin || item.href !== "/admin").map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                  active
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/40"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                }`}
              >
                {item.label}
              </Link>
            )
          })}

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="ml-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-800/40 transition-all whitespace-nowrap"
          >
            🚪 ออกจากระบบ
          </button>
        </div>
      </div>
    </nav>
  )
}
