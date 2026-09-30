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

  // Load profiles, attendance, and event sessions in parallel
  const [
    { data: members },
    { data: attendance },
    { data: eventSessions },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, discord_id, job_class, role, created_at")
      .order("display_name"),
    supabase
      .from("event_attendance")
      .select("event_name, event_date, discord_id, status, user_id, message_id")
      .order("created_at", { ascending: false }),
    supabase
      .from("event_sessions")
      .select("event_name, session_date")
      .order("session_date", { ascending: false }),
  ])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <NavBar isAdmin={isAdmin} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <BenchOrganizerClient
          isAdmin={isAdmin}
          initialMembers={members || []}
          initialAttendance={attendance || []}
          initialSessions={eventSessions || []}
        />
      </main>
    </div>
  )
}
