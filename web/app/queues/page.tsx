import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import NavBar from "@/components/NavBar"
import QueueManagerClient from "./QueueManagerClient"

export default async function QueuesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const isAdmin = (session.user as any)?.role === "admin"

  const supabase = createAdminClient()

  const [
    { data: members },
    { data: attendance },
    { data: eventSessions },
    { data: allocatedSlots },
    { data: carryCredits },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, discord_id, job_class, role")
      .order("display_name", { ascending: true }),
    supabase
      .from("event_attendance")
      .select("*, profiles:user_id(display_name, discord_id, job_class)")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("event_sessions")
      .select("*")
      .order("session_date", { ascending: false }),
    supabase
      .from("allocated_slots")
      .select("*, profiles:user_id(display_name, discord_id, job_class)")
      .order("page_number", { ascending: true })
      .order("slot_number", { ascending: true }),
    supabase
      .from("carry_credits")
      .select("*"),
  ])

  return (
    <div className="min-h-screen bg-zinc-950">
      <NavBar isAdmin={isAdmin} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Suspense fallback={<div className="text-zinc-500 py-10 text-center text-sm font-medium">กำลังโหลดข้อมูล...</div>}>
          <QueueManagerClient
            isAdmin={isAdmin}
            members={members || []}
            initialAttendance={attendance || []}
            initialSessions={eventSessions || []}
            initialSlots={allocatedSlots || []}
            initialCredits={carryCredits || []}
          />
        </Suspense>
      </main>
    </div>
  )
}
