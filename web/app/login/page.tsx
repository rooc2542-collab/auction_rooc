"use client"

import { signIn } from "next-auth/react"
import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/ThemeToggle"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const form = new FormData(e.currentTarget)
    const res = await signIn("credentials", {
      username: form.get("username"),
      password: form.get("password"),
      redirect: false,
    })

    if (res?.error) {
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
      setLoading(false)
    } else {
      router.push("/")
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg font-bold text-zinc-100">
            R
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">ระบบประมูล</h1>
          <p className="text-zinc-500 text-sm mt-1">Auction_Rooc</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-7 shadow-xl">
          <h2 className="text-sm font-semibold text-zinc-400 mb-5">เข้าสู่ระบบผู้ดูแล</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">ชื่อผู้ใช้</label>
              <input
                name="username"
                type="text"
                placeholder="Admin"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">รหัสผ่าน</label>
              <input
                name="password"
                type="password"
                placeholder="••••••"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/50 transition-all"
              />
            </div>

            {error && (
              <div className="bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-900 font-semibold py-2.5 rounded-lg transition-all text-sm cursor-pointer"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ →"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">Auction_Rooc • ระบบประมูลไอเทมกิลด์</p>
      </div>
    </div>
  )
}
