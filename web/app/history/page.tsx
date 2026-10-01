import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import NavBar from "@/components/NavBar"
import HistoryView from "./HistoryView"

export const dynamic = "force-dynamic"

export default async function HistoryPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const isAdmin = (session.user as any)?.role === "admin"

  const supabase = createAdminClient()

  // 1. ดึงประวัติการแจกของ (auction_history)
  const { data: history } = await supabase
    .from("auction_history")
    .select("*, profiles:user_id(id, display_name, discord_id, job_class), awarded_by_profile:awarded_by(display_name)")
    .order("awarded_at", { ascending: false })
    .limit(500)

  // 2. ดึงประวัติการโหวต / ลงชื่อ (event_attendance)
  const { data: attendance } = await supabase
    .from("event_attendance")
    .select("*, profiles:user_id(id, display_name, discord_id, job_class)")
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500)

  // 3. ดึงรอบกิจกรรม (event_sessions)
  const { data: sessions } = await supabase
    .from("event_sessions")
    .select("event_name, session_date, item_type, total_quantity, personal_limit, status")
    .order("session_date", { ascending: false })

  return (
    <div className="min-h-screen bg-zinc-950">
      <NavBar isAdmin={isAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <HistoryView
          history={history || []}
          attendance={attendance || []}
          sessions={sessions || []}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  )
}
