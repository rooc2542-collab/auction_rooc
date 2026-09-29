"use client"

import { signIn } from "next-auth/react"
import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"

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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-3xl shadow-xl shadow-purple-900/50">
            ⚔️
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">ระบบประมูล</h1>
          <p className="text-purple-400 text-sm font-medium mt-1">Auction_Rooc</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800 p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-6">เข้าสู่ระบบผู้ดูแล</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">ชื่อผู้ใช้</label>
              <input
                name="username"
                type="text"
                placeholder="Admin"
                required
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">รหัสผ่าน</label>
              <input
                name="password"
                type="password"
                placeholder="••••••"
                required
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
              />
            </div>

            {error && (
              <div className="bg-rose-950/50 border border-rose-800/60 text-rose-300 text-sm px-4 py-3 rounded-xl">
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-purple-900/40 transition-all text-sm cursor-pointer"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ →"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">Auction_Rooc • ระบบประมูลไอเทมกิลด์</p>
      </div>
    </div>
  )
}
