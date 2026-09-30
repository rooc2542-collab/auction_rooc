import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import NavBar from "@/components/NavBar"
import BenchOrganizerClient from "./BenchOrganizerClient"

export const dynamic = "force-dynamic"

export default async function BenchPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const isAdmin = (session.user as any)?.role === "admin"
  const supabase = createAdminClient()

  // Load all profiles
  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, discord_id, job_class, role, created_at")
    .order("display_name")

  // Load recent attendance to see current assigned bench
  const { data: recentAttendance } = await supabase
    .from("event_attendance")
    .select("event_name, event_date, discord_id, status, user_id")
    .order("event_date", { ascending: false })
    .limit(100)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <NavBar isAdmin={isAdmin} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <BenchOrganizerClient
          isAdmin={isAdmin}
          initialMembers={members || []}
          initialAttendance={recentAttendance || []}
        />
      </main>
    </div>
  )
}
