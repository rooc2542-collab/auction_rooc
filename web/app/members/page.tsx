import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import NavBar from "@/components/NavBar"
import MemberTable from "./MemberTable"

export default async function MembersPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const isAdmin = (session.user as any)?.role === "admin"

  const supabase = createAdminClient()
  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, discord_id, job_class, role, created_at")
    .order("created_at", { ascending: false })

  const { count: totalCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar isAdmin={isAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">👥 จัดการสมาชิก</h1>
            <p className="text-slate-400 text-sm mt-1">สมาชิกทั้งหมด {totalCount ?? 0} คน</p>
          </div>
        </div>

        <MemberTable members={members || []} isAdmin={isAdmin} />
      </main>
    </div>
  )
}
