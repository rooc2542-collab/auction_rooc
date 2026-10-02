import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import NavBar from "@/components/NavBar"
import CreditsManagerClient from "./CreditsManagerClient"
import type { CreditUser, ProfileMember } from "./CreditsManagerClient"

export const dynamic = "force-dynamic"

export default async function CreditsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const isAdmin = (session.user as any)?.role === "admin"

  const supabase = createAdminClient()

  // 1. ดึงข้อมูลยอดค้างสะสม (carry_credits)
  const { data: credits } = await supabase
    .from("carry_credits")
    .select("*, profiles:user_id(id, display_name, discord_id, job_class)")
    .order("credit", { ascending: false })

  // 2. ดึงรายชื่อสมาชิกทั้งหมดสำหรับ Modal ปรับเครดิต
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, discord_id, job_class, role")
    .order("display_name", { ascending: true })

  const userMap: Record<string, CreditUser> = {}
  for (const c of credits || []) {
    const uid = c.user_id
    if (!userMap[uid]) {
      userMap[uid] = {
        user_id: uid,
        display_name: (c.profiles as any)?.display_name || "Unknown",
        discord_id: (c.profiles as any)?.discord_id || "",
        job_class: (c.profiles as any)?.job_class || null,
        items: {
          Album: 0,
          Puppet: 0,
          White: 0,
          RedBlack: 0,
        },
      }
    }
    const it = c.item_type as "Album" | "Puppet" | "White" | "RedBlack"
    if (it in userMap[uid].items) {
      userMap[uid].items[it] = c.credit
    }
  }

  const initialUsers = Object.values(userMap).filter((u) =>
    Object.values(u.items).some((v) => v > 0)
  )

  const allMembers: ProfileMember[] = (profiles || []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    discord_id: p.discord_id,
    job_class: p.job_class,
    role: p.role,
  }))

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      <NavBar isAdmin={isAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <CreditsManagerClient
          initialUsers={initialUsers}
          allMembers={allMembers}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  )
}
