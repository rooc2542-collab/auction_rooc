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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚔️</div>
          <h1 className="text-2xl font-bold text-white">ระบบประมูล</h1>
          <p className="text-purple-400 font-medium">RoOC Guild Auction</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">เข้าสู่ระบบ</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">ชื่อผู้ใช้</label>
              <input
                name="username"
                type="text"
                placeholder="Admin"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">รหัสผ่าน</label>
              <input
                name="password"
                type="password"
                placeholder="••••••"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-700 hover:bg-purple-600 disabled:bg-purple-900 disabled:text-purple-700 text-white font-medium py-2.5 rounded-lg transition-all text-sm"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ →"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">ROOC Guild Management System</p>
      </div>
    </div>
  )
}
