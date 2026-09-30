"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="w-20 h-8 rounded-md bg-zinc-800 border border-zinc-700 animate-pulse" />
    )
  }

  const isDark = theme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium border transition-colors cursor-pointer shrink-0
        dark:bg-zinc-900 dark:border-zinc-700/80 dark:hover:bg-zinc-800 dark:text-zinc-200
        bg-zinc-200/80 border-zinc-300 hover:bg-zinc-300/80 text-zinc-800"
      title={isDark ? "สลับเป็นโหมดสว่าง (Light Mode)" : "สลับเป็นโหมดมืด (Dark Mode)"}
      aria-label="Toggle theme"
    >
      <span>{isDark ? "โหมดสว่าง" : "โหมดมืด"}</span>
    </button>
  )
}
