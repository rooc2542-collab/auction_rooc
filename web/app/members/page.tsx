import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import NavBar from "@/components/NavBar"
import MemberTable from "./MemberTable"

export const dynamic = "force-dynamic"

export default async function MembersPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const isAdmin = (session.user as any)?.role === "admin"

  const supabase = createAdminClient()

  // 1. ดึงรายชื่อสมาชิกทั้งหมดจาก profiles
  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, discord_id, job_class, role, created_at")
    .order("created_at", { ascending: true })

  // 2. ดึงสถิติสล็อตที่จัดสรรแล้วจาก allocated_slots
  const { data: slots } = await supabase
    .from("allocated_slots")
    .select("user_id, item_type, status")

  // 3. ดึงยอดสะสม Carry Credit (แทนจำนวนที่ข้ามหรือสะสมไว้)
  const { data: credits } = await supabase
    .from("carry_credits")
    .select("user_id, item_type, credit")

  // 4. ดึงสถิติ attendance (จำนวนรอบที่ no_bid หรือ absent)
  const { data: attendance } = await supabase
    .from("event_attendance")
    .select("user_id, status, interested_items")

  const { count: totalCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })

  return (
    <div className="min-h-screen bg-zinc-950">
      <NavBar isAdmin={isAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">จัดการสมาชิก</h1>
            <p className="text-zinc-500 text-sm mt-1">
              สมาชิกทั้งหมด {totalCount ?? members?.length ?? 0} คน (ดึงข้อมูลจริงจาก Supabase Database)
            </p>
          </div>
        </div>

        <MemberTable
          members={members || []}
          slots={slots || []}
          credits={credits || []}
          attendance={attendance || []}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  )
}
