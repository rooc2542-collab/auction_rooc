"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"

const NAV_ITEMS = [
  { href: "/", label: "📊 Dashboard" },
  { href: "/members", label: "👥 สมาชิก" },
  { href: "/credits", label: "💳 Credits" },
  { href: "/history", label: "📋 ประวัติ" },
  { href: "/admin", label: "⚙️ Admin" },
]

export default function NavBar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white hover:text-purple-400 transition-colors">
          <span className="text-purple-400">⚔️</span>
          <span>ระบบประมูล</span>
          <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded-full font-normal">RoOC</span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.filter(item => isAdmin || item.href !== "/admin").map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pathname === item.href
                  ? "bg-purple-700 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {item.label}
            </Link>
          ))}

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="ml-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-all"
          >
            🚪 ออก
          </button>
        </div>
      </div>
    </nav>
  )
}
