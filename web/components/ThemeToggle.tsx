"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="w-24 h-8 rounded-lg bg-zinc-800 border border-zinc-700 animate-pulse" />
    )
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme
  const isDark = currentTheme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold border transition-all cursor-pointer shrink-0
        dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-100
        bg-zinc-100 border-zinc-300 hover:bg-zinc-200 text-zinc-800 shadow-sm"
      title={isDark ? "ธีมปัจจุบัน: โหมดมืด (คลิกเพื่อสลับเป็นโหมดสว่าง)" : "ธีมปัจจุบัน: โหมดสว่าง (คลิกเพื่อสลับเป็นโหมดมืด)"}
      aria-label="Toggle theme"
    >
      <span className="text-sm">{isDark ? "🌙" : "☀️"}</span>
      <span>{isDark ? "โหมดมืด" : "โหมดสว่าง"}</span>
    </button>
  )
}
