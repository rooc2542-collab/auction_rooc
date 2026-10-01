import { auth } from "@/auth"
import NavBar from "@/components/NavBar"
import GuideClient from "./GuideClient"

export const metadata = {
  title: "คู่มือการใช้งาน — ระบบประมูล RoOC",
  description: "คู่มือการใช้งานระบบประมูลและจัดสรรไอเทมกิลด์ RoOC Geffen สำหรับสมาชิกและแอดมิน",
}

export default async function GuidePage() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.role === "admin"

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <NavBar isAdmin={isAdmin} />
      <GuideClient isAdmin={isAdmin} />
    </div>
  )
}
